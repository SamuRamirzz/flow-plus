import { requerirUsuario } from '@/lib/server/usuario'
import { actualizarBloqueHorarioSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'
import { actualizarBloque, borrarBloque } from '@/lib/server/horario'

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

  const resultado = await actualizarBloque(auth.userId, id, parsed.data)

  if (!resultado.ok) {
    if (resultado.noEncontrado) return errorJson('Bloque de horario no encontrado', 404)
    return errorJson(resultado.error, 500)
  }
  return ok(resultado.bloque)
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  const { id } = await params

  const resultado = await borrarBloque(auth.userId, id)

  if (!resultado.ok) return errorJson(resultado.error, 500)
  return ok({ eliminado: true })
}
