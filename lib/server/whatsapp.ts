import { normalizarNumero } from '@/lib/whatsapp/whapi'

// Sprint 2/3 — transporte de salida hacia WhatsApp, vía Whapi.Cloud.
//
// `fetch` nativo, SIN SDK ni dependencia nueva: la API es un REST plano
// (`POST /messages/text` con `{to, body}` y `Authorization: Bearer`), y
// añadir un paquete para envolver una sola llamada HTTP sería peor que
// mantener estas ~30 líneas. Mismo criterio con el que este proyecto ya
// habla con Google Drive y con Gemini sin SDK propio en la capa de red.
//
// Verificado contra la API real antes de escribir esto (no asumido):
//   · `Authorization: Bearer <token>` → 200. Sin cabecera → 404.
//   · El canal responde `status.text: "AUTH"` cuando la sesión de WhatsApp
//     está vinculada por QR.
// Fuente: support.whapi.cloud (Send text message / Incoming message).

const TIMEOUT_MS = 10_000

function configuracion(): { token: string; base: string } | null {
  const token = process.env.WHAPI_TOKEN
  if (!token) return null
  // La base viene con barra final en .env.local; se normaliza para no
  // construir `https://gate.whapi.cloud//messages/text`.
  const base = (process.env.WHAPI_BASE_URL ?? 'https://gate.whapi.cloud').replace(/\/+$/, '')
  return { token, base }
}

export type ResultadoEnvio = { ok: true; mensajeId: string | null } | { ok: false; detalle: string }

/**
 * Envía un mensaje de texto por WhatsApp.
 *
 * NUNCA lanza — mismo criterio defensivo que `crearNotificacion` y
 * `sincronizarNotaADrive`: WhatsApp es un canal secundario, y un fallo suyo
 * (token vencido, canal desvinculado, Whapi caído) jamás debe tumbar la
 * operación que lo disparó. Quien llama decide si el fallo le importa; la
 * mayoría de llamadores solo lo registran.
 *
 * `numero` se acepta en cualquier formato razonable (E.164 con `+`, con
 * espacios o guiones) y se normaliza a solo dígitos, que es lo que Whapi
 * espera en `to`.
 */
export async function enviarMensajeWhatsApp(numero: string, texto: string): Promise<ResultadoEnvio> {
  const config = configuracion()
  if (!config) {
    console.error('[whatsapp] WHAPI_TOKEN no está configurado — no se envió nada')
    return { ok: false, detalle: 'WHAPI_TOKEN no configurado' }
  }

  const destino = normalizarNumero(numero)
  if (destino.length === 0) return { ok: false, detalle: 'Número vacío o inválido' }

  try {
    const respuesta = await fetch(`${config.base}/messages/text`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: destino, body: texto }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const cuerpo = await respuesta.text()
    if (!respuesta.ok) {
      // El formato de error de Whapi no es el de Twilio — se registra el
      // cuerpo crudo en vez de intentar mapearlo a una forma que no
      // conocemos del todo, que es como se pierden los detalles útiles.
      console.error(`[whatsapp] Whapi respondió ${respuesta.status}:`, cuerpo.slice(0, 500))
      return { ok: false, detalle: `Whapi ${respuesta.status}: ${cuerpo.slice(0, 200)}` }
    }

    let mensajeId: string | null = null
    try {
      const json = JSON.parse(cuerpo) as { message?: { id?: string }; id?: string }
      mensajeId = json.message?.id ?? json.id ?? null
    } catch {
      // Respuesta 2xx sin JSON parseable: el envío salió bien igualmente,
      // solo nos quedamos sin el id. No es motivo para reportar un fallo.
    }
    return { ok: true, mensajeId }
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error)
    console.error('[whatsapp] excepción enviando mensaje:', detalle)
    return { ok: false, detalle }
  }
}
