import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { crearBloqueHorarioSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = crearBloqueHorarioSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const { data, error } = await supabaseServer
    .from('horario')
    .insert({
      user_id: auth.userId,
      tipo: parsed.data.tipo,
      materia_id: parsed.data.materiaId,
      dia_semana: parsed.data.diaSemana,
      hora_inicio: parsed.data.horaInicio ?? null,
      hora_fin: parsed.data.horaFin ?? null,
    })
    .select()
    .single()

  if (error) return errorJson(error.message, 500)
  return ok(data, 201)
}
