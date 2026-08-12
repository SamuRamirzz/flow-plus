import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { sincronizarNotaADrive } from '@/lib/server/notas'
import { borrarArchivo } from '@/lib/server/googleDrive'
import { actualizarNotaSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// `params` es una Promise en esta versión de Next.js (App Router) — ver el
// mismo comentario en app/api/tareas/[id]/route.ts.
type Contexto = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = actualizarNotaSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const { titulo, contenido, tareaId, bloqueHorarioId, archivoId } = parsed.data

  if (tareaId) {
    const { data } = await supabaseServer.from('tareas').select('id').eq('id', tareaId).eq('user_id', userId).maybeSingle()
    if (!data) return errorJson('tareaId no corresponde a una tarea tuya', 400)
  }
  if (bloqueHorarioId) {
    const { data } = await supabaseServer.from('horario').select('id').eq('id', bloqueHorarioId).eq('user_id', userId).maybeSingle()
    if (!data) return errorJson('bloqueHorarioId no corresponde a un bloque tuyo', 400)
  }
  if (archivoId) {
    const { data } = await supabaseServer.from('archivos').select('id').eq('id', archivoId).eq('user_id', userId).maybeSingle()
    if (!data) return errorJson('archivoId no corresponde a un archivo tuyo', 400)
  }

  const cambios: Record<string, unknown> = {}
  if (titulo !== undefined) cambios.titulo = titulo
  if (contenido !== undefined) cambios.contenido = contenido
  if (tareaId !== undefined) cambios.tarea_id = tareaId
  if (bloqueHorarioId !== undefined) cambios.bloque_horario_id = bloqueHorarioId
  if (archivoId !== undefined) cambios.archivo_id = archivoId

  const { data, error } = await supabaseServer.from('notas').update(cambios).eq('id', id).eq('user_id', userId).select().single()

  if (error) {
    // PGRST116 = PostgREST "0 o más de 1 fila" — el id no existe o no es
    // del usuario. Cualquier otro error (ej. `notas_ancla_chk`, si el body
    // solo tocó UN ancla pero la fila ya tenía la otra puesta — zod no
    // puede ver ese estado previo) se refleja como 400.
    if (error.code === 'PGRST116') return errorJson('Nota no encontrada', 404)
    return errorJson(error.message, 400)
  }

  // Resync a Drive SOLO si `contenido` cambió — nunca por un cambio de
  // `titulo`/ancla en solitario (ver lib/server/notas.ts: evita gastar
  // cuota de Drive en cada edición de metadata; la UI futura debe
  // debounced/throttled esta llamada si autoguarda mientras se escribe).
  let sync = { driveFileId: data.drive_file_id as string | null, driveSyncError: data.drive_sync_error as string | null }
  if (contenido !== undefined) {
    sync = await sincronizarNotaADrive(userId, {
      notaId: id,
      contenido: data.contenido,
      titulo: data.titulo,
      driveFileIdAnterior: data.drive_file_id,
    })
  }

  return ok({ nota: { ...data, drive_file_id: sync.driveFileId, drive_sync_error: sync.driveSyncError } })
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId
  const { id } = await params

  // Postgres es la fuente de verdad del contenido (a diferencia de
  // `archivos`, donde Drive es la única copia real) — se borra la fila
  // primero; el archivo de Drive es un espejo, su borrado es best-effort y
  // nunca bloquea si falla.
  const { data, error } = await supabaseServer.from('notas').delete().eq('id', id).eq('user_id', userId).select().maybeSingle()

  if (error) return errorJson(error.message, 500)
  if (!data) return errorJson('Nota no encontrada', 404)

  if (data.drive_file_id) {
    const borrado = await borrarArchivo(userId, data.drive_file_id)
    if (!borrado.ok) console.warn('[api/notas/[id]] no se pudo borrar el archivo de Drive tras eliminar la nota:', borrado.detalle)
  }

  return ok({ eliminado: true, nota: data })
}
