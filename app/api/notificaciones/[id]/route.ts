import { z } from 'zod'
import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// `params` es una Promise en esta versión de Next.js (App Router) — ver el
// mismo comentario en app/api/tareas/[id]/route.ts.
type Contexto = { params: Promise<{ id: string }> }

const actualizarNotificacionSchema = z.object({
  leida: z.boolean({ error: 'leida debe ser true o false' }),
})

// C.2 — marca una notificación puntual como leída (o no leída, aunque hoy
// solo la UI dispara `leida: true`; se acepta el valor que mande el body en
// vez de fijarlo a `true` a mano, sin costo extra de código).
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

  const parsed = actualizarNotificacionSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const { data, error } = await supabaseServer
    .from('notificaciones')
    .update({ leida: parsed.data.leida })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error) return errorJson(error.message, 500)
  if (!data) return errorJson('Notificación no encontrada', 404)

  return ok({ notificacion: data })
}

// C.4 — borra una notificación puntual. Misma validación de propiedad que
// PATCH (`.eq('user_id', userId)`): sin esto, cualquier sesión podría borrar
// notificaciones de otro usuario adivinando su id — mismo tipo de bug IDOR
// ya corregido antes en /api/ai/horario/route.ts.
export async function DELETE(_request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId
  const { id } = await params

  const { data, error } = await supabaseServer
    .from('notificaciones')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error) return errorJson(error.message, 500)
  if (!data) return errorJson('Notificación no encontrada', 404)

  return ok({ eliminada: true })
}
