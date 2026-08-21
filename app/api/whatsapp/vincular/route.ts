import { randomInt } from 'node:crypto'
import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { normalizarNumero } from '@/lib/whatsapp/whapi'
import { vincularWhatsAppSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Sprint 2/3 — genera el código de vinculación y lo DEVUELVE para mostrarlo
// en la app. No lo manda por WhatsApp.
//
// ─────────────────────────────────────────────────────────────────────────
// Por qué el código se muestra y NO se envía (bug real corregido)
// ─────────────────────────────────────────────────────────────────────────
// La primera versión tenía dos caminos que se contradecían: la app mandaba
// el código por WhatsApp y el usuario lo confirmaba EN LA APP. Ese segundo
// paso no puede funcionar, y el motivo es estructural: la app nunca ve un
// mensaje de WhatsApp, así que jamás puede aprender el `chat_id` con el que
// esa persona escribe. Resultado observado en producción: el usuario
// verificó bien (código marcado como usado, número actualizado) y el bot
// siguió respondiéndole "no estás vinculado" para siempre, porque su
// `whatsapp_chat_id` seguía apuntando al chat anterior.
//
// Ahora hay UN solo camino: la app enseña el código, y la vinculación
// ocurre cuando la persona responde `/vincular <código>` DESDE el WhatsApp
// que quiere vincular. Ese mensaje es lo único que revela el identificador
// real — imprescindible cuando llega como `@lid`, que no contiene teléfono.
//
// Además es más seguro que enviarlo: si el usuario se equivoca al teclear
// su número, el código ya no acaba en el teléfono de un desconocido.
//
// `numero` se sigue pidiendo, pero solo como destino de las notificaciones
// salientes (Parte F) — no interviene en la autenticación.

const VIGENCIA_MINUTOS = 10
const MAX_SOLICITUDES_POR_HORA = 5

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

  const parsed = vincularWhatsAppSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)
  const numero = parsed.data.numero

  const digitos = normalizarNumero(numero)
  const { data: ocupados } = await supabaseServer
    .from('perfil_academico')
    .select('user_id, whatsapp_numero')
    .eq('whatsapp_verificado', true)
    .not('whatsapp_numero', 'is', null)

  const ocupadoPorOtro = (ocupados ?? []).some(
    (p) => normalizarNumero(p.whatsapp_numero as string) === digitos && p.user_id !== userId
  )
  if (ocupadoPorOtro) return errorJson('Ese número ya está vinculado a otra cuenta de Flow+', 409)

  const desde = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await supabaseServer
    .from('whatsapp_codigos_verificacion')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('creado_en', desde)

  if ((count ?? 0) >= MAX_SOLICITUDES_POR_HORA) {
    return errorJson('Pediste demasiados códigos. Espera un rato antes de pedir otro.', 429)
  }

  // randomInt de node:crypto, no Math.random(): es una credencial, y un
  // generador predecible haría adivinable el código de otra persona dentro
  // de su ventana de 10 minutos.
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const expiraEn = new Date(Date.now() + VIGENCIA_MINUTOS * 60_000).toISOString()

  const { error } = await supabaseServer.from('whatsapp_codigos_verificacion').insert({
    user_id: userId,
    numero,
    codigo,
    expira_en: expiraEn,
  })
  if (error) return errorJson(error.message, 500)

  return ok({ codigo, expiraEn, vigenciaMinutos: VIGENCIA_MINUTOS })
}

// Desvincular. Limpia TAMBIÉN `whatsapp_chat_id` — dejarlo puesto es
// exactamente el bug que hacía imposible vincular un teléfono distinto
// después: el chat viejo seguía reclamando la cuenta.
export async function DELETE() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  const { error } = await supabaseServer
    .from('perfil_academico')
    .update({ whatsapp_numero: null, whatsapp_chat_id: null, whatsapp_verificado: false, whatsapp_notificaciones: false })
    .eq('user_id', userId)

  if (error) return errorJson(error.message, 500)

  // Los códigos pendientes dejan de servir: uno emitido antes de
  // desvincular seguiría siendo canjeable después.
  await supabaseServer.from('whatsapp_codigos_verificacion').update({ usado: true }).eq('user_id', userId).eq('usado', false)

  return ok({ desvinculado: true })
}
