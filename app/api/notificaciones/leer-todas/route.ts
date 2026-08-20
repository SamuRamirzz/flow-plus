import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { ok, errorJson } from '@/lib/server/respuestas'

// C.3 — marca TODAS las notificaciones no leídas del usuario como leídas,
// en una sola operación (el botón "Marcar todas como leídas" del panel).
// Ruta estática, hermana de `[id]/route.ts` — Next.js resuelve el segmento
// literal `leer-todas` antes que el dinámico `[id]` para esta ruta exacta,
// mismo patrón ya usado en el proyecto (ver app/api/notificaciones/contador).
export async function PATCH() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  const { data, error } = await supabaseServer
    .from('notificaciones')
    .update({ leida: true })
    .eq('user_id', userId)
    .eq('leida', false)
    .select('id')

  if (error) return errorJson(error.message, 500)

  return ok({ actualizadas: data?.length ?? 0 })
}
