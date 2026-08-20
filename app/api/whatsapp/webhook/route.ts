import { supabaseServer } from '@/lib/server/supabaseServer'
import { enviarMensajeWhatsApp } from '@/lib/server/whatsapp'
import { ejecutarComando } from '@/lib/server/whatsapp/ejecutarComando'
import { parsearComando } from '@/lib/whatsapp/parser'
import { extraerMensajesDeTexto, debeProcesarse, canalDelPayload, normalizarNumero } from '@/lib/whatsapp/whapi'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'

// Sprint 2/3 — recepción de mensajes de WhatsApp (Whapi.Cloud).
//
// ─────────────────────────────────────────────────────────────────────────
// SEGURIDAD — limitación real, documentada, no disfrazada
// ─────────────────────────────────────────────────────────────────────────
// Whapi.Cloud NO firma sus webhooks. Se revisó su documentación de webhooks
// (formato, eventos, reintentos, modos) y no existe firma HMAC, secreto
// compartido ni cabecera de autenticación verificable. Eso significa que
// NO hay verificación criptográfica posible acá — cualquier cosa que se
// haga es mitigación, no prueba de origen. Se aplican tres capas, y se
// nombran por lo que son:
//
//   1. Secreto en la URL (`?s=...`, WHAPI_WEBHOOK_SECRET). Es el control
//      más fuerte disponible: quien no conozca la URL completa no puede
//      invocar el endpoint. Sigue siendo un secreto que viaja en la URL
//      (puede acabar en logs de intermediarios), así que es más débil que
//      una firma — pero es exactamente el mismo patrón que este proyecto ya
//      usa para los crons (`CRON_SECRET`).
//   2. `channel_id` del payload contra WHAPI_CHANNEL_ID. Barato y descarta
//      tráfico de otro canal; no es secreto, así que no cuenta como
//      autenticación.
//   3. Límite de comandos por número y por hora, contra
//      `whatsapp_comandos_log` (que ya existía). Acota el daño de un abuso
//      en vez de prevenirlo.
//
// Un fallo de la capa 1 responde 404, no 401: a un escáner no se le
// confirma que la ruta existe.
//
// ─────────────────────────────────────────────────────────────────────────
// Siempre 200 salvo secreto inválido
// ─────────────────────────────────────────────────────────────────────────
// Whapi reintenta con backoff los webhooks que no reciben 2xx. Un error
// nuestro procesando un comando no debe provocar que reintente el mismo
// mensaje durante 15 minutos, así que todo lo demás (payload raro, evento
// que no nos interesa, fallo del ejecutor) se responde 200 y se registra.
export const dynamic = 'force-dynamic'

const MAX_COMANDOS_POR_HORA = 30

async function registrar(entrada: {
  userId: string | null
  numero: string
  mensaje: string
  comando: string | null
  resultado: 'ejecutado' | 'error' | 'no_reconocido'
  detalleError?: string
}): Promise<void> {
  const { error } = await supabaseServer.from('whatsapp_comandos_log').insert({
    user_id: entrada.userId,
    numero_origen: entrada.numero,
    mensaje_crudo: entrada.mensaje,
    comando_detectado: entrada.comando,
    resultado: entrada.resultado,
    detalle_error: entrada.detalleError ?? null,
  })
  if (error) console.error('[whatsapp/webhook] no se pudo registrar el comando:', error.message)
}

/** Capa 3 — cuántos comandos lleva este número en la última hora. */
async function superaLimite(numero: string): Promise<boolean> {
  const desde = new Date(Date.now() - 3_600_000).toISOString()
  // `creado_en`, NO `creada_en`: esta tabla usa la forma masculina, a
  // diferencia de `notificaciones.creada_en`. Un error real encontrado en la
  // verificación, y del tipo peor: la consulta fallaba, el `catch` de abajo
  // lo interpretaba como "no bloquear" (fail-open deliberado) y el límite
  // quedaba desactivado EN SILENCIO, con el endpoint respondiendo 200 como
  // si todo estuviera bien.
  const { count, error } = await supabaseServer
    .from('whatsapp_comandos_log')
    .select('id', { count: 'exact', head: true })
    .eq('numero_origen', numero)
    .gte('creado_en', desde)

  if (error) {
    // Si el propio control falla, se deja pasar: bloquear al usuario por un
    // fallo de nuestra base sería peor que el abuso que intenta evitar.
    console.error('[whatsapp/webhook] no se pudo comprobar el límite:', error.message)
    return false
  }
  return (count ?? 0) >= MAX_COMANDOS_POR_HORA
}

export async function POST(request: Request) {
  const secretoEsperado = process.env.WHAPI_WEBHOOK_SECRET
  const { searchParams } = new URL(request.url)
  if (!secretoEsperado || searchParams.get('s') !== secretoEsperado) {
    return new Response('Not found', { status: 404 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ ok: true, ignorado: 'body no es JSON' })
  }

  const canalEsperado = process.env.WHAPI_CHANNEL_ID
  const canal = canalDelPayload(payload)
  if (canalEsperado && canal && canal !== canalEsperado) {
    console.warn('[whatsapp/webhook] payload de un canal distinto:', canal)
    return Response.json({ ok: true, ignorado: 'canal no coincide' })
  }

  const mensajes = extraerMensajesDeTexto(payload).filter(debeProcesarse)
  if (mensajes.length === 0) return Response.json({ ok: true, procesados: 0 })

  let procesados = 0
  for (const mensaje of mensajes) {
    const numero = normalizarNumero(mensaje.numero)

    try {
      if (await superaLimite(numero)) {
        await registrar({ userId: null, numero, mensaje: mensaje.texto, comando: null, resultado: 'error', detalleError: 'límite por hora superado' })
        continue
      }

      // Identificación del usuario POR el número. La comparación se hace
      // sobre dígitos en los dos lados (la UI guarda E.164 con `+`, Whapi
      // manda solo dígitos) — sin esto, un número perfectamente válido no
      // casaría nunca.
      const { data: perfiles } = await supabaseServer
        .from('perfil_academico')
        .select('user_id, whatsapp_numero')
        .eq('whatsapp_verificado', true)
        .not('whatsapp_numero', 'is', null)

      const perfil = (perfiles ?? []).find((p) => normalizarNumero(p.whatsapp_numero as string) === numero)

      if (!perfil) {
        await enviarMensajeWhatsApp(
          numero,
          'Este número no está vinculado a ninguna cuenta de Flow+.\n\nEntra a *Ajustes → WhatsApp* en la app para vincularlo.'
        )
        await registrar({ userId: null, numero, mensaje: mensaje.texto, comando: null, resultado: 'no_reconocido', detalleError: 'número no vinculado' })
        continue
      }

      const userId = perfil.user_id as string

      // La fecha de referencia se resuelve en la zona del usuario, igual que
      // en el cron y en POST /api/tareas — el parser la necesita para
      // "mañana"/"el viernes".
      const { data: prefs } = await supabaseServer.from('perfil_academico').select('zona_horaria').eq('user_id', userId).maybeSingle()
      const hoy = hoyEnZona(new Date(), (prefs?.zona_horaria as string | undefined) ?? ZONA_HORARIA_POR_DEFECTO)

      const comando = parsearComando(mensaje.texto, hoy)
      const resultado = await ejecutarComando(userId, comando)

      await enviarMensajeWhatsApp(numero, resultado.respuesta)
      await registrar({
        userId,
        numero,
        mensaje: mensaje.texto,
        comando: comando.tipo,
        resultado: resultado.resultado,
        detalleError: resultado.detalleError,
      })
      procesados++
    } catch (error) {
      // Un mensaje que falla no debe impedir procesar los demás del mismo
      // payload — mismo criterio que el cron de recordatorios con sus
      // usuarios.
      const detalle = error instanceof Error ? error.message : String(error)
      console.error('[whatsapp/webhook] fallo procesando un mensaje:', detalle)
      await registrar({ userId: null, numero, mensaje: mensaje.texto, comando: null, resultado: 'error', detalleError: detalle })
    }
  }

  return Response.json({ ok: true, procesados })
}
