// Sprint 2/3 — capa PURA del formato de Whapi.Cloud: interpretar el payload
// del webhook y decidir si un evento debe procesarse. Sin I/O, testeable sin
// red — mismo criterio que lib/integraciones/googleDrive.ts, que separa la
// interpretación pura del transporte (lib/server/googleDrive.ts).
//
// Formato verificado contra la documentación oficial de Whapi
// (support.whapi.cloud, "Incoming message" webhook) y contra el canal real:
//
//   {
//     "messages": [{
//       "id": "...", "from_me": false, "type": "text",
//       "chat_id": "573001112233@s.whatsapp.net", "timestamp": 1712995245,
//       "text": { "body": "Hola" }, "from": "573001112233", "from_name": "..."
//     }],
//     "event": { "type": "messages", "event": "post" },
//     "channel_id": "DEADPL-PHJZQ"
//   }

export type MensajeEntrante = {
  id: string
  numero: string
  texto: string
  fromMe: boolean
  chatId: string
}

type MensajeCrudo = {
  id?: unknown
  from?: unknown
  from_me?: unknown
  type?: unknown
  chat_id?: unknown
  text?: { body?: unknown }
}

/** Un chat de grupo termina en `@g.us`; uno individual, en `@s.whatsapp.net`. */
export function esChatDeGrupo(chatId: string): boolean {
  return chatId.endsWith('@g.us')
}

/**
 * Extrae los mensajes de texto individuales de un payload de webhook.
 * Devuelve `[]` para cualquier otro evento (estados de entrega, presencia,
 * grupos, mensajes con adjunto sin texto) — el webhook los responde 200 sin
 * procesarlos, mismo criterio defensivo de "ignorar lo que no entiendo" que
 * ya usa el resto del proyecto.
 */
export function extraerMensajesDeTexto(payload: unknown): MensajeEntrante[] {
  if (typeof payload !== 'object' || payload === null) return []
  const mensajes = (payload as { messages?: unknown }).messages
  if (!Array.isArray(mensajes)) return []

  const salida: MensajeEntrante[] = []
  for (const crudo of mensajes as MensajeCrudo[]) {
    if (typeof crudo !== 'object' || crudo === null) continue
    if (crudo.type !== 'text') continue

    const texto = crudo.text?.body
    const numero = crudo.from
    const chatId = crudo.chat_id
    const id = crudo.id
    if (typeof texto !== 'string' || typeof numero !== 'string' || typeof chatId !== 'string' || typeof id !== 'string') continue
    if (texto.trim().length === 0) continue
    if (esChatDeGrupo(chatId)) continue

    salida.push({ id, numero, texto, fromMe: crudo.from_me === true, chatId })
  }
  return salida
}

/** `channel_id` del payload, o null si no viene. */
export function canalDelPayload(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const canal = (payload as { channel_id?: unknown }).channel_id
  return typeof canal === 'string' ? canal : null
}

/**
 * ¿Este mensaje debe procesarse como un comando?
 *
 * El caso `fromMe` NO es un detalle menor, es lo que evita un bucle infinito
 * y a la vez lo que hace usable el montaje más probable de este proyecto:
 *
 *   · El canal de Whapi se vincula por QR a una cuenta de WhatsApp REAL. Si
 *     esa cuenta es la del propio usuario (lo normal cuando solo tienes un
 *     número), entonces sus mensajes a sí mismo llegan con `from_me: true`.
 *     Descartar todo `from_me` dejaría el bot mudo justo en ese montaje.
 *   · Pero las RESPUESTAS que envía el bot también vuelven con
 *     `from_me: true`. Procesarlas haría que el bot se conteste a sí mismo
 *     para siempre.
 *
 * La regla que separa ambos casos sin ambigüedad: un mensaje propio solo se
 * procesa si empieza por `/`. El parser ya exige ese prefijo para cualquier
 * comando, y NINGUNA respuesta generada por el bot empieza así (todas abren
 * con texto, emoji o `*negrita*` — ver AYUDA y las respuestas de
 * ejecutarComando). Un mensaje ajeno (`from_me: false`) se procesa siempre;
 * si no es un comando, el ejecutor ya responde con la pista de /ayuda.
 */
export function debeProcesarse(mensaje: MensajeEntrante): boolean {
  if (!mensaje.fromMe) return true
  return mensaje.texto.trimStart().startsWith('/')
}

/**
 * Normaliza un TELÉFONO a solo dígitos, para comparar un número guardado en
 * E.164 (`+57300...`, el formato que pide la UI) con el que llega del
 * webhook. Solo válido para teléfonos reales — ver `esLid`.
 */
export function normalizarNumero(numero: string): string {
  return numero.replace(/\D/g, '')
}

/**
 * ¿Este identificador es un LID (identificador de privacidad de WhatsApp) en
 * vez de un teléfono?
 *
 * Verificado contra el canal real: los mensajes llegan con `from`/`chat_id`
 * en uno de dos formatos, `573170180062@s.whatsapp.net` (teléfono real) o
 * `156126641426469@lid` (id opaco). Los dígitos de un LID **no son un número
 * de teléfono**, y Whapi no puede resolverlos a uno (`GET /contacts/<lid>`
 * devuelve `phonebook:false` y ningún teléfono).
 *
 * Distinguirlos importa por dos motivos, ambos bugs reales que esto corrige:
 *   · Comparar los dígitos de un LID contra `whatsapp_numero` no casa nunca,
 *     y peor: podría casar por casualidad con el teléfono de OTRO usuario.
 *   · Responder a los dígitos pelados de un LID abre una conversación
 *     DISTINTA (`...@s.whatsapp.net`) de aquella en la que el usuario
 *     escribió — el mensaje se envía "bien" y el usuario no ve nada.
 */
export function esLid(identificador: string): boolean {
  return identificador.endsWith('@lid')
}

/**
 * El identificador estable de la conversación, tal cual, para responder
 * SIEMPRE en el mismo chat del que vino el mensaje. Nunca reconstruir un
 * destino a partir de los dígitos: `156126641426469@lid` y
 * `156126641426469@s.whatsapp.net` son dos chats diferentes.
 */
export function destinoDeRespuesta(mensaje: MensajeEntrante): string {
  return mensaje.chatId
}

/**
 * El teléfono real del remitente, o `null` si llegó como LID (y por tanto no
 * se conoce). Devolver `null` en vez de los dígitos del LID es deliberado:
 * esos dígitos parecen un teléfono pero no lo son, y tratarlos como tal es
 * exactamente el error que hay que impedir.
 */
export function telefonoDelRemitente(mensaje: MensajeEntrante): string | null {
  if (esLid(mensaje.chatId) || esLid(mensaje.numero)) return null
  const digitos = normalizarNumero(mensaje.numero)
  return digitos.length > 0 ? digitos : null
}
