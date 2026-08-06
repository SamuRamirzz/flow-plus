import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { ok, errorJson } from '@/lib/server/respuestas'

// `params` es una Promise en esta versión de Next.js (App Router) — ver el
// mismo comentario en app/api/tareas/[id]/route.ts.
type Contexto = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId
  const { id } = await params

  const { data, error } = await supabaseServer.from('conversaciones_ia').select('*').eq('id', id).eq('user_id', userId).maybeSingle()

  if (error) return errorJson(error.message, 500)
  if (!data) return errorJson('Conversación no encontrada', 404)

  return ok({ conversacion: data })
}
