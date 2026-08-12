import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { actualizarBloqueHorarioSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// `params` es una Promise en esta versión de Next.js (App Router) — ver
// app/api/tareas/[id]/route.ts para la misma nota y la fuente verificada.
type Contexto = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = actualizarBloqueHorarioSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  // zod usa camelCase (horaInicio/horaFin); la tabla usa snake_case — se
  // traduce acá en vez de en el schema, para que crearBloqueHorarioSchema
  // y actualizarBloqueHorarioSchema sigan describiendo la forma que ve el
  // cliente, no la de la tabla.
  const cambios: Record<string, unknown> = {}
  if (parsed.data.tipo !== undefined) cambios.tipo = parsed.data.tipo
  if (parsed.data.activo !== undefined) cambios.activo = parsed.data.activo
  if (parsed.data.materiaId !== undefined) cambios.materia_id = parsed.data.materiaId
  if (parsed.data.horaInicio !== undefined) cambios.hora_inicio = parsed.data.horaInicio
  if (parsed.data.horaFin !== undefined) cambios.hora_fin = parsed.data.horaFin
  if (parsed.data.aula !== undefined) cambios.aula = parsed.data.aula
  if (parsed.data.profesor !== undefined) cambios.profesor = parsed.data.profesor

  const { data, error } = await supabaseServer
    .from('horario')
    .update(cambios)
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') return errorJson('Bloque de horario no encontrado', 404)
    return errorJson(error.message, 500)
  }
  return ok(data)
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  const { id } = await params

  const { error } = await supabaseServer.from('horario').delete().eq('id', id).eq('user_id', auth.userId)

  if (error) return errorJson(error.message, 500)
  return ok({ eliminado: true })
}
