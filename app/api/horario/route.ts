import { requerirUsuario } from '@/lib/server/usuario'
import { crearBloqueHorarioSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'
import { crearBloque } from '@/lib/server/horario'

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

  const resultado = await crearBloque(auth.userId, {
    tipo: parsed.data.tipo,
    materiaId: parsed.data.materiaId,
    diaSemana: parsed.data.diaSemana,
    horaInicio: parsed.data.horaInicio ?? null,
    horaFin: parsed.data.horaFin ?? null,
  })

  if (!resultado.ok) return errorJson(resultado.error, 500)
  return ok(resultado.bloque, 201)
}
