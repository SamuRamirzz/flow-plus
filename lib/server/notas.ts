import { supabaseServer } from './supabaseServer'
import { asegurarCarpetaRaiz, asegurarSubcarpeta, subirArchivo, borrarArchivo } from './googleDrive'

// Sprint Archivos / Fase 4.1 — reflejo de una nota como archivo de texto en
// Drive, dentro de una subcarpeta "Notas" en "Flow+". Postgres es la FUENTE
// DE VERDAD del contenido (a diferencia de `archivos`, donde Drive es la
// única copia real) — Drive acá es un espejo de exportación, así que un
// fallo de sincronización nunca debe poder perder ni bloquear la nota.

const NOMBRE_SUBCARPETA_NOTAS = 'Notas'

export type FilaNota = {
  id: string
  user_id: string
  titulo: string | null
  contenido: string
  tarea_id: string | null
  bloque_horario_id: string | null
  archivo_id: string | null
  drive_file_id: string | null
  drive_sync_error: string | null
  creado_por: 'usuario' | 'ia'
  created_at: string
  updated_at: string
}

/**
 * Único punto de creación de notas — usado tanto por `POST /api/notas`
 * (usuario) como por `app/api/ai/tareas/route.ts` cuando `TaskManagementAgent`
 * resuelve una intención `crear_nota` (ia). Inserta en Postgres primero (la
 * fuente de verdad) y sincroniza con Drive después, best-effort — un fallo
 * de Drive nunca impide que la nota quede creada.
 */
export async function crearNota(
  userId: string,
  input: {
    titulo: string | null
    contenido: string
    tareaId: string | null
    bloqueHorarioId: string | null
    archivoId?: string | null
    creadoPor: 'usuario' | 'ia'
  }
): Promise<{ ok: true; nota: FilaNota } | { ok: false; error: string }> {
  const { data: nota, error } = await supabaseServer
    .from('notas')
    .insert({
      user_id: userId,
      titulo: input.titulo,
      contenido: input.contenido,
      tarea_id: input.tareaId,
      bloque_horario_id: input.bloqueHorarioId,
      archivo_id: input.archivoId ?? null,
      creado_por: input.creadoPor,
    })
    .select()
    .single<FilaNota>()

  if (error) return { ok: false, error: error.message }

  const sync = await sincronizarNotaADrive(userId, { notaId: nota.id, contenido: nota.contenido, titulo: nota.titulo, driveFileIdAnterior: null })

  return { ok: true, nota: { ...nota, drive_file_id: sync.driveFileId, drive_sync_error: sync.driveSyncError } }
}

// Prefijo con los primeros 8 caracteres del id: Drive no impone unicidad de
// nombre, así que sin esto dos notas de la misma tarea aparecerían con el
// mismo nombre visible al abrir la carpeta a mano.
function nombreArchivoNota(notaId: string, titulo: string | null): string {
  const base = (titulo ?? 'Nota').trim().slice(0, 60).replace(/[\\/:*?"<>|]/g, '_')
  return `${notaId.slice(0, 8)}-${base || 'Nota'}.txt`
}

type ResultadoSyncNota = { driveFileId: string | null; driveSyncError: string | null }

// `driveFileIdSinCambios`: la actualización de error NUNCA toca la columna
// `drive_file_id` — este parámetro es solo para que el resultado devuelto
// refleje correctamente que el id (si había uno de una subida previa) sigue
// intacto, en vez de reportar `null` cuando en realidad no cambió nada.
async function marcarError(notaId: string, userId: string, detalle: string, driveFileIdSinCambios: string | null): Promise<ResultadoSyncNota> {
  const { error } = await supabaseServer
    .from('notas')
    .update({ drive_sync_error: detalle, updated_at: new Date().toISOString() })
    .eq('id', notaId)
    .eq('user_id', userId)
  if (error) console.error('[notas] no se pudo registrar drive_sync_error:', error.message)
  return { driveFileId: driveFileIdSinCambios, driveSyncError: detalle }
}

/**
 * Sube (o re-sube) el contenido de una nota a Drive. Nunca lanza — cualquier
 * fallo marca `notas.drive_sync_error` para poder reconciliar después, sin
 * tocar el contenido ya guardado en Postgres.
 *
 * Sube el archivo NUEVO primero y borra el VIEJO después, nunca al revés: si
 * la subida nueva falla, el viejo (si había) sigue siendo un respaldo
 * válido. El peor caso con este orden es un archivo huérfano en Drive
 * (aceptable); el peor caso con el orden inverso sería perder el único
 * respaldo por una subida que después falla.
 *
 * No existe (ni se construye acá) una función de "renombrar/actualizar
 * contenido" de un archivo de Drive — Tramo 2a solo construyó crear/leer/
 * listar/borrar. Por eso cada sincronización es subir-uno-nuevo-y-borrar-el-
 * viejo, no una edición in-place. Consecuencia deliberada: el nombre del
 * archivo en Drive se fija en la creación y NO se actualiza si solo cambia
 * `titulo` después (el llamador decide cuándo invocar esta función; no debe
 * hacerlo en cada edición de metadata, solo cuando cambia `contenido`).
 */
export async function sincronizarNotaADrive(
  userId: string,
  input: { notaId: string; contenido: string; titulo: string | null; driveFileIdAnterior: string | null }
): Promise<ResultadoSyncNota> {
  try {
    const carpetaRaiz = await asegurarCarpetaRaiz(userId)
    if (!carpetaRaiz.ok) return marcarError(input.notaId, userId, carpetaRaiz.detalle, input.driveFileIdAnterior)

    const subcarpeta = await asegurarSubcarpeta(userId, NOMBRE_SUBCARPETA_NOTAS, carpetaRaiz.datos.carpetaId)
    if (!subcarpeta.ok) return marcarError(input.notaId, userId, subcarpeta.detalle, input.driveFileIdAnterior)

    const bytes = new Blob([input.contenido], { type: 'text/plain' })
    const subida = await subirArchivo(userId, {
      bytes,
      nombre: nombreArchivoNota(input.notaId, input.titulo),
      mimeType: 'text/plain',
      carpetaId: subcarpeta.datos.carpetaId,
    })
    if (!subida.ok) return marcarError(input.notaId, userId, subida.detalle, input.driveFileIdAnterior)

    const { error } = await supabaseServer
      .from('notas')
      .update({ drive_file_id: subida.datos.driveFileId, drive_sync_error: null, updated_at: new Date().toISOString() })
      .eq('id', input.notaId)
      .eq('user_id', userId)
    if (error) console.error('[notas] sync a Drive OK pero no se pudo guardar drive_file_id:', error.message)

    // Best-effort, DESPUÉS del éxito de arriba — ver el comentario de la
    // cabecera sobre por qué este orden y no el inverso.
    if (input.driveFileIdAnterior) {
      const borrado = await borrarArchivo(userId, input.driveFileIdAnterior)
      if (!borrado.ok) console.warn('[notas] no se pudo borrar el archivo viejo de Drive tras sincronizar:', borrado.detalle)
    }

    return { driveFileId: subida.datos.driveFileId, driveSyncError: null }
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error)
    console.error('[notas] excepción sincronizando con Drive:', error)
    return marcarError(input.notaId, userId, detalle, input.driveFileIdAnterior).catch(() => ({
      driveFileId: input.driveFileIdAnterior,
      driveSyncError: detalle,
    }))
  }
}
