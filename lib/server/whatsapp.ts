import { normalizarNumero } from '@/lib/whatsapp/whapi'
import { MAX_BOTONES, MAX_LARGO_TITULO, menuComoTexto, type Menu } from '@/lib/whatsapp/menus'

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
 * `destinatario` admite DOS cosas y la diferencia importa:
 *   · Un teléfono en cualquier formato razonable (`+57 300 123 4567`) → se
 *     normaliza a solo dígitos, que es lo que Whapi espera en `to`.
 *   · Un chat id completo (`...@s.whatsapp.net`, `...@lid`) → se pasa TAL
 *     CUAL, sin tocar.
 *
 * Ese "sin tocar" corrige un bug real: normalizar `156126641426469@lid` a
 * dígitos hacía que Whapi lo interpretara como el teléfono
 * `156126641426469@s.whatsapp.net`, que es una conversación DISTINTA. El
 * envío devolvía 200 y el usuario no veía nada, porque la respuesta caía en
 * un chat que él nunca abrió.
 */
export async function enviarMensajeWhatsApp(destinatario: string, texto: string): Promise<ResultadoEnvio> {
  const config = configuracion()
  if (!config) {
    console.error('[whatsapp] WHAPI_TOKEN no está configurado — no se envió nada')
    return { ok: false, detalle: 'WHAPI_TOKEN no configurado' }
  }

  const destino = destinatario.includes('@') ? destinatario.trim() : normalizarNumero(destinatario)
  if (destino.length === 0) return { ok: false, detalle: 'Destinatario vacío o inválido' }

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

/**
 * Envía un menú como mensaje interactivo (botones o lista, según cuántas
 * opciones tenga), con degradación automática a texto numerado.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * El fallback NO es defensivo por costumbre: es obligatorio acá
 * ─────────────────────────────────────────────────────────────────────────
 * La documentación de Whapi advierte explícitamente que la funcionalidad de
 * botones "no es estable", porque depende de cambios que WhatsApp introduce
 * por su cuenta en un protocolo que Whapi no controla. Si el envío
 * interactivo falla por lo que sea, se manda el MISMO menú como texto
 * numerado y el usuario responde con el número — `resolverOpcion` acepta las
 * dos formas, así que el resto del flujo no se entera de cuál se usó.
 *
 * Hasta 3 opciones se mandan como botones (el máximo real de WhatsApp para
 * quick reply); con más, como lista desplegable.
 *
 * ⚠️ El formato exacto del cuerpo de LISTA no está publicado en la
 * documentación de Whapi (su página de listas no existe) y no se pudo
 * verificar contra la API real porque el canal se desvinculó a mitad del
 * trabajo. Se usa la forma estándar de WhatsApp; si resultara incorrecta, el
 * fallback de texto cubre al usuario igualmente — que es exactamente para lo
 * que está.
 */
export async function enviarMenuWhatsApp(destinatario: string, menu: Menu): Promise<ResultadoEnvio> {
  const config = configuracion()
  if (!config) return { ok: false, detalle: 'WHAPI_TOKEN no configurado' }

  const destino = destinatario.includes('@') ? destinatario.trim() : normalizarNumero(destinatario)
  if (destino.length === 0) return { ok: false, detalle: 'Destinatario vacío o inválido' }

  const usarBotones = menu.opciones.length <= MAX_BOTONES
  const cuerpo = usarBotones
    ? {
        to: destino,
        type: 'button',
        body: { text: menu.cuerpo },
        action: {
          buttons: menu.opciones.map((o) => ({
            type: 'quick_reply',
            title: o.titulo.slice(0, MAX_LARGO_TITULO),
            id: o.id,
          })),
        },
      }
    : {
        to: destino,
        type: 'list',
        body: { text: menu.cuerpo },
        action: {
          list: {
            label: menu.etiquetaLista,
            sections: [
              {
                title: 'Opciones',
                rows: menu.opciones.map((o) => ({
                  id: o.id,
                  title: o.titulo.slice(0, MAX_LARGO_TITULO),
                  ...(o.descripcion ? { description: o.descripcion } : {}),
                })),
              },
            ],
          },
        },
      }

  try {
    const respuesta = await fetch(`${config.base}/messages/interactive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (respuesta.ok) return { ok: true, mensajeId: null }

    const detalle = (await respuesta.text()).slice(0, 300)
    console.warn(`[whatsapp] menú interactivo falló (${respuesta.status}), cayendo a texto:`, detalle)
  } catch (error) {
    console.warn('[whatsapp] excepción enviando menú interactivo, cayendo a texto:', error)
  }

  // Degradación: el mismo menú, en texto, para que el usuario nunca se quede
  // sin ver las opciones.
  return enviarMensajeWhatsApp(destinatario, menuComoTexto(menu))
}
