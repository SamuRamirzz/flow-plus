import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { ok, errorJson } from '@/lib/server/respuestas'

// C.5 — solo el número de no leídas, para el badge de la campana. Un
// `count: 'exact', head: true` no trae ninguna fila (Postgres solo cuenta),
// más liviano que pedir la lista completa solo para mostrar un número —
// relevante porque Parte E lo consulta por polling/al recibir un evento de
// Realtime, no una vez por carga de página.
export async function GET() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  const { count, error } = await supabaseServer
    .from('notificaciones')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('leida', false)

  if (error) return errorJson(error.message, 500)

  return ok({ noLeidas: count ?? 0 })
}
