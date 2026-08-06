import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { asegurarCarpetaRaiz, subirArchivo } from '@/lib/server/googleDrive'
import { estadoHttpParaClase } from '@/lib/integraciones/googleDrive'
import { esRutaDelUsuario } from '@/lib/server/rutaStorage'
import { crearArchivoSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Sprint Archivos / Tramo 2a — Fase 3.
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

export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

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

  // tareaId/materiaId son referencias libres en el schema (zod no conoce al
  // usuario autenticado); se verifica acá que, si vienen, sean del mismo
  // usuario — supabaseServer usa service_role y salta RLS, así que sin esto
  // cualquier sesión podría enlazar su propio archivo a una tarea/materia
  // ajena adivinando su id.
  if (tareaId) {
    const { data } = await supabaseServer.from('tareas').select('id').eq('id', tareaId).eq('user_id', userId).maybeSingle()
    if (!data) return errorJson('tareaId no corresponde a una tarea tuya', 400)
  }
  if (materiaId) {
    const { data } = await supabaseServer.from('materias').select('id').eq('id', materiaId).eq('user_id', userId).maybeSingle()
    if (!data) return errorJson('materiaId no corresponde a una materia tuya', 400)
  }

  const { data: objeto, error: errorDescarga } = await supabaseServer.storage.from(BUCKET_STAGING).download(ruta)
  if (errorDescarga || !objeto) {
    return errorJson(`No se pudo leer el archivo subido: ${errorDescarga?.message ?? 'no encontrado'}`, 404)
  }

  const carpeta = await asegurarCarpetaRaiz(userId)
  if (!carpeta.ok) return errorJson(`No se pudo preparar la carpeta de Drive: ${carpeta.detalle}`, estadoHttpParaClase(carpeta.clase))

  const mimeType = objeto.type || 'application/octet-stream'
  const subida = await subirArchivo(userId, { bytes: objeto, nombre, mimeType, carpetaId: carpeta.datos.carpetaId })
  if (!subida.ok) return errorJson(`No se pudo subir el archivo a Drive: ${subida.detalle}`, estadoHttpParaClase(subida.clase))

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

  // El archivo ya está en Drive pero la fila no se pudo crear: se expone el
  // driveFileId para poder reconciliar a mano (huérfano de baja
  // probabilidad, no vale la pena una transacción distribuida para esto).
  if (errorInsert) {
    console.error('[api/archivos] subida a Drive OK pero insert falló, archivo huérfano en Drive:', subida.datos.driveFileId, errorInsert.message)
    return errorJson(`El archivo se subió a Drive pero no se pudo registrar (driveFileId=${subida.datos.driveFileId}): ${errorInsert.message}`, 500)
  }

  // Best-effort: el objeto de staging ya cumplió su propósito. Si el borrado
  // falla, no afecta al archivo real (ya está en Drive + Postgres) — queda
  // como basura en staging hasta la próxima limpieza.
  const { error: errorLimpieza } = await supabaseServer.storage.from(BUCKET_STAGING).remove([ruta])
  if (errorLimpieza) console.warn('[api/archivos] no se pudo limpiar el objeto de staging:', errorLimpieza.message)

  return ok({ archivo: fila }, 201)
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
