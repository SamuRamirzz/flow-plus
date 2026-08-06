import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { guardarConversacion, type MensajeConversacion } from '@/lib/ai/conversaciones/guardar'
import { guardarConversacionSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Sprint Archivos / Fase 5.1/5.2.

const LIMITE_PAGINA = 20

export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = guardarConversacionSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const ahora = new Date().toISOString()
  const mensajes: MensajeConversacion[] = parsed.data.mensajes.map((m) => ({ rol: m.rol, texto: m.texto, en: m.en ?? ahora }))

  const resultado = await guardarConversacion(userId, mensajes)
  if (!resultado.ok) return errorJson(resultado.error, 500)

  return ok({ id: resultado.id, resumen: resultado.resumen }, 201)
}

export async function GET(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  const { searchParams } = new URL(request.url)
  const pagina = Math.max(1, Number(searchParams.get('pagina')) || 1)
  const desde = (pagina - 1) * LIMITE_PAGINA
  const hasta = desde + LIMITE_PAGINA - 1

  const { data, error, count } = await supabaseServer
    .from('conversaciones_ia')
    .select('id, resumen, created_at, updated_at', { count: 'exact' })
    .eq('user_id', userId)
    .eq('archivada', false)
    .order('updated_at', { ascending: false })
    .range(desde, hasta)

  if (error) return errorJson(error.message, 500)

  return ok({ conversaciones: data ?? [], pagina, totalPaginas: Math.max(1, Math.ceil((count ?? 0) / LIMITE_PAGINA)) })
}
