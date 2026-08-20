import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { ok, errorJson } from '@/lib/server/respuestas'

// Sprint 1/3 — lista de notificaciones del usuario (tabla `notificaciones`,
// el modelo de producto general). Hasta este sprint este mismo endpoint leía
// `notificaciones_enviadas` (el ledger interno de deduplicación del cron de
// recordatorios, Sprint 11) — ese uso queda reemplazado por este, que es lo
// que ahora consume la campana (components/ui/NotificationBell.tsx).
// `notificaciones_enviadas` sigue existiendo e intacta, solo que ya no la
// lee ningún cliente: el cron sigue escribiendo ahí para su propia
// deduplicación (ver app/api/cron/recordatorios/route.ts).
const LIMITE_DEFECTO = 20
const LIMITE_MAXIMO = 100

export async function GET(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  const { searchParams } = new URL(request.url)
  const leidaParam = searchParams.get('leida')
  const limiteParam = Number(searchParams.get('limit'))
  const offsetParam = Number(searchParams.get('offset'))

  const limite = Number.isFinite(limiteParam) && limiteParam > 0 ? Math.min(limiteParam, LIMITE_MAXIMO) : LIMITE_DEFECTO
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0

  let query = supabaseServer
    .from('notificaciones')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('creada_en', { ascending: false })
    .range(offset, offset + limite - 1)

  if (leidaParam === 'true') query = query.eq('leida', true)
  else if (leidaParam === 'false') query = query.eq('leida', false)

  const { data, error, count } = await query
  if (error) return errorJson(error.message, 500)

  return ok({ notificaciones: data ?? [], total: count ?? 0, limite, offset })
}
