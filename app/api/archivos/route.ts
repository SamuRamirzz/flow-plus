import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { asegurarCarpetaRaiz, obtenerOCrearCarpetaMateria, subirArchivo, subirArchivoResumable } from '@/lib/server/googleDrive'
import { estadoHttpParaClase } from '@/lib/integraciones/googleDrive'
import { esRutaDelUsuario } from '@/lib/server/rutaStorage'
import { crearArchivoSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Sprint Archivos / Tramo 2a — Fase 3. Ampliado (Upload resumable) para
// archivos grandes.
//
// El archivo llega en dos pasos, mismo patrón que ya usa
// app/api/ai/horario/route.ts con las fotos: el cliente sube primero al
// bucket de staging (`archivos-staging`) y este endpoint solo recibe la
// ruta — nunca el binario en el body JSON.
//
// Valida el prefijo antes de tocar Storage con esRutaDelUsuario() — mismo
// helper compartido que corrige el hallazgo de IDOR en
// app/api/ai/horario/route.ts y app/api/ai/tareas/route.ts (ver
// lib/server/rutaStorage.ts).
export const BUCKET_STAGING = 'archivos-staging'

// maxDuration=60: mismo tope que los dos crons existentes (recordatorios,
// eliminar-cuentas) — sin confirmación de un plan con Fluid Compute, se
// asume el límite conservador. Es la restricción real que fijó el tope de
// tamaño del bucket de staging en 200MB (ver la migración
// 20260810000100_staging_archivos_grandes.sql para el razonamiento
// completo).
export const maxDuration = 60

// Por debajo: multipart simple (`subirArchivo`), un solo request, más
// rápido para lo chico. Por encima: resumable, con progreso real chunk a
// chunk — necesario tanto por confiabilidad (un solo POST de 150MB tiene
// más superficie para fallar a mitad de camino sin poder reanudar) como
// para poder reportar progreso de verdad en vez de una barra indeterminada.
const UMBRAL_RESUMABLE = 20 * 1024 * 1024

/**
 * Eventos NDJSON (uno por línea) que este endpoint transmite mientras dura
 * la subida a Drive. Reemplaza la respuesta JSON única de antes — ver
 * `lib/archivos/api.ts::subirArchivoCompleto()` para el lado cliente que
 * lee este stream.
 */
type EventoSubida =
  | { fase: 'registrando' }
  | { fase: 'subiendo_drive'; porcentaje: number }
  | { fase: 'completo'; archivo: Record<string, unknown> }
  | { fase: 'error'; mensaje: string; status: number }

/**
 * Arma un `ReadableStream` de líneas NDJSON a partir de una función que
 * recibe un emisor. Cualquier excepción no atrapada dentro de `ejecutar` se
 * traduce a un evento `error` en vez de romper el stream a medio camino sin
 * explicación — el cliente siempre recibe una última línea que le dice qué
 * pasó, éxito o fallo.
 */
function crearStreamNDJSON(ejecutar: (emitir: (evento: EventoSubida) => void) => Promise<void>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      const emitir = (evento: EventoSubida) => controller.enqueue(encoder.encode(`${JSON.stringify(evento)}\n`))
      try {
        await ejecutar(emitir)
      } catch (error) {
        emitir({ fase: 'error', mensaje: error instanceof Error ? error.message : String(error), status: 500 })
      } finally {
        controller.close()
      }
    },
  })
}

export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  // Todo lo de acá abajo es rápido (parseo, validación, una descarga de
  // Storage que en la práctica es de pocos segundos incluso para 200MB
  // dentro de la misma nube) — se mantiene como respuestas de error
  // NORMALES (JSON + status HTTP), no streamed. Streaming arranca recién
  // cuando se confirma que hay que hablarle a Drive, que es la parte de
  // duración variable real.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = crearArchivoSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const { ruta, nombre, tareaId, materiaId, categoria } = parsed.data

  if (!esRutaDelUsuario(ruta, userId)) {
    return errorJson('La ruta del archivo no pertenece a tu sesión', 403)
  }

  if (tareaId) {
    const { data } = await supabaseServer.from('tareas').select('id').eq('id', tareaId).eq('user_id', userId).maybeSingle()
    if (!data) return errorJson('tareaId no corresponde a una tarea tuya', 400)
  }
  let nombreMateria: string | null = null
  if (materiaId) {
    const { data } = await supabaseServer.from('materias').select('id, nombre').eq('id', materiaId).eq('user_id', userId).maybeSingle<{ id: string; nombre: string }>()
    if (!data) return errorJson('materiaId no corresponde a una materia tuya', 400)
    nombreMateria = data.nombre
  }

  const { data: objeto, error: errorDescarga } = await supabaseServer.storage.from(BUCKET_STAGING).download(ruta)
  if (errorDescarga || !objeto) {
    return errorJson(`No se pudo leer el archivo subido: ${errorDescarga?.message ?? 'no encontrado'}`, 404)
  }

  const stream = crearStreamNDJSON(async (emitir) => {
    emitir({ fase: 'registrando' })

    // Carpeta destino: la subcarpeta de la materia si el archivo tiene una,
    // la raíz "Flow+" si no (ver la decisión completa en el sprint de
    // subcarpetas — los archivos sin materia van a la raíz, nunca a una
    // subcarpeta "Sin materia").
    const carpeta = materiaId && nombreMateria ? await obtenerOCrearCarpetaMateria(userId, materiaId, nombreMateria) : await asegurarCarpetaRaiz(userId)
    if (!carpeta.ok) {
      emitir({ fase: 'error', mensaje: `No se pudo preparar la carpeta de Drive: ${carpeta.detalle}`, status: estadoHttpParaClase(carpeta.clase) })
      return
    }

    const mimeType = objeto.type || 'application/octet-stream'

    const subida =
      objeto.size < UMBRAL_RESUMABLE
        ? await (async () => {
            const r = await subirArchivo(userId, { bytes: objeto, nombre, mimeType, carpetaId: carpeta.datos.carpetaId })
            if (r.ok) emitir({ fase: 'subiendo_drive', porcentaje: 100 })
            return r
          })()
        : await subirArchivoResumable(
            userId,
            { bytes: objeto, nombre, mimeType, carpetaId: carpeta.datos.carpetaId },
            (p) => emitir({ fase: 'subiendo_drive', porcentaje: Math.round((p.bytesConfirmados / p.bytesTotal) * 100) }),
            request.signal,
          )

    if (!subida.ok) {
      emitir({ fase: 'error', mensaje: `No se pudo subir el archivo a Drive: ${subida.detalle}`, status: estadoHttpParaClase(subida.clase) })
      return
    }

    const { data: fila, error: errorInsert } = await supabaseServer
      .from('archivos')
      .insert({
        user_id: userId,
        tarea_id: tareaId ?? null,
        materia_id: materiaId ?? null,
        nombre,
        mime_type: mimeType,
        tamano_bytes: subida.datos.tamanoBytes,
        drive_file_id: subida.datos.driveFileId,
        drive_web_view_link: subida.datos.webViewLink,
        categoria: categoria ?? null,
        origen: 'usuario',
      })
      .select()
      .single()

    // El archivo ya está en Drive pero la fila no se pudo crear: se expone
    // el driveFileId para poder reconciliar a mano (huérfano de baja
    // probabilidad, no vale la pena una transacción distribuida para esto).
    if (errorInsert) {
      console.error('[api/archivos] subida a Drive OK pero insert falló, archivo huérfano en Drive:', subida.datos.driveFileId, errorInsert.message)
      emitir({ fase: 'error', mensaje: `El archivo se subió a Drive pero no se pudo registrar (driveFileId=${subida.datos.driveFileId}): ${errorInsert.message}`, status: 500 })
      return
    }

    // Best-effort: el objeto de staging ya cumplió su propósito.
    const { error: errorLimpieza } = await supabaseServer.storage.from(BUCKET_STAGING).remove([ruta])
    if (errorLimpieza) console.warn('[api/archivos] no se pudo limpiar el objeto de staging:', errorLimpieza.message)

    emitir({ fase: 'completo', archivo: fila })
  })

  return new Response(stream, { status: 200, headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } })
}

export async function GET(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  const { searchParams } = new URL(request.url)
  const tareaId = searchParams.get('tareaId')
  const materiaId = searchParams.get('materiaId')
  const categoria = searchParams.get('categoria')

  let query = supabaseServer.from('archivos').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (tareaId) query = query.eq('tarea_id', tareaId)
  if (materiaId) query = query.eq('materia_id', materiaId)
  if (categoria) query = query.eq('categoria', categoria)

  const { data, error } = await query
  if (error) return errorJson(error.message, 500)

  return ok({ archivos: data ?? [] })
}
