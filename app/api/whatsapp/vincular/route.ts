import { randomInt } from 'node:crypto'
import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { enviarMensajeWhatsApp } from '@/lib/server/whatsapp'
import { normalizarNumero } from '@/lib/whatsapp/whapi'
import { vincularWhatsAppSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Sprint 2/3 — paso 1 de la vinculación: manda un código de 6 dígitos al
// número que dice el usuario. Confirmarlo (paso 2) vive en ./verificar.
//
// Separar los dos pasos es lo que prueba que el usuario controla ESE
// teléfono: sin el segundo paso, cualquiera podría escribir el número de
// otra persona y quedarse recibiendo sus recordatorios.

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

  // Un número ya verificado por OTRA cuenta no se puede reclamar. El índice
  // único parcial de la migración lo impediría igualmente al confirmar,
  // pero fallar acá evita gastar un mensaje y da un error entendible en vez
  // de un choque de constraint.
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

  // Tope de solicitudes: sin esto, este endpoint es una forma gratuita de
  // mandarle mensajes repetidos a un número ajeno.
  const desde = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await supabaseServer
    .from('whatsapp_codigos_verificacion')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('creado_en', desde)

  if ((count ?? 0) >= MAX_SOLICITUDES_POR_HORA) {
    return errorJson('Demasiados intentos. Espera un rato antes de pedir otro código.', 429)
  }

  // randomInt de node:crypto, no Math.random(): es un código de
  // verificación, y un generador predecible haría adivinable el código de
  // otra persona dentro de su ventana de 10 minutos.
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const expiraEn = new Date(Date.now() + VIGENCIA_MINUTOS * 60_000).toISOString()

  const { error } = await supabaseServer.from('whatsapp_codigos_verificacion').insert({
    user_id: userId,
    numero,
    codigo,
    expira_en: expiraEn,
  })
  if (error) return errorJson(error.message, 500)

  const envio = await enviarMensajeWhatsApp(
    numero,
    `Tu código para vincular WhatsApp con Flow+ es *${codigo}*\n\nVence en ${VIGENCIA_MINUTOS} minutos. Si no lo pediste tú, ignora este mensaje.`
  )
  if (!envio.ok) {
    return errorJson('No pudimos enviar el código a ese número. Revisa que sea correcto y que tenga WhatsApp.', 502)
  }

  return ok({ enviado: true, expiraEn })
}

// Desvincular. No borra el historial de `whatsapp_comandos_log` — es un
// registro de diagnóstico, no datos de la vinculación.
export async function DELETE() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  const { error } = await supabaseServer
    .from('perfil_academico')
    .update({ whatsapp_numero: null, whatsapp_verificado: false, whatsapp_notificaciones: false })
    .eq('user_id', userId)

  if (error) return errorJson(error.message, 500)

  // Los códigos pendientes dejan de servir: si no se invalidan, uno emitido
  // antes de desvincular seguiría siendo canjeable después.
  await supabaseServer.from('whatsapp_codigos_verificacion').update({ usado: true }).eq('user_id', userId).eq('usado', false)

  return ok({ desvinculado: true })
}
