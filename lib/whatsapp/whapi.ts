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
  /** Texto escrito, o el id de la opción si el usuario tocó un botón/lista. */
  texto: string
  fromMe: boolean
  chatId: string
  /** true si `texto` es el id de una opción tocada, no algo que el usuario escribió. */
  esOpcion: boolean
}

type MensajeCrudo = {
  id?: unknown
  from?: unknown
  from_me?: unknown
  type?: unknown
  chat_id?: unknown
  text?: { body?: unknown }
  // Al tocar un botón o elegir una fila de lista, WhatsApp NO manda un
  // mensaje de texto: manda `type: "reply"` con el id de la opción dentro.
  // Formato confirmado en la documentación de Whapi ("Incoming message").
  reply?: {
    type?: unknown
    buttons_reply?: { id?: unknown; title?: unknown }
    list_reply?: { id?: unknown; title?: unknown }
  }
}

// WhatsApp/Whapi NO devuelven el id tal cual se envió: le anteponen un
// prefijo de versión. Verificado contra el canal real — al mandar
// `id: "menu:tareas_hoy"`, la respuesta de la API confirma que quedó
// guardado como `ButtonsV3:menu:tareas_hoy` (o `ListV3:...` en una lista).
//
// Sin quitarlo, `resolverOpcion` no casaría NUNCA y el texto
// "ButtonsV3:menu:tareas_hoy" acabaría enviado a la IA como si fuera
// lenguaje natural del usuario. No se detecta simulando el webhook a mano
// —el payload inventado no lleva prefijo—, solo mirando lo que devuelve el
// servicio real.
const PREFIJOS_ID_INTERACTIVO = /^(ButtonsV\d+|ListV\d+|Buttons|List):/i

export function limpiarIdOpcion(id: string): string {
  return id.replace(PREFIJOS_ID_INTERACTIVO, '')
}

/**
 * Id de la opción elegida, si este mensaje crudo es la respuesta a un botón
 * o a una lista. `null` si es un mensaje normal.
 */
function idDeRespuestaInteractiva(crudo: MensajeCrudo): string | null {
  if (crudo.type !== 'reply' || !crudo.reply) return null
  const elegida = crudo.reply.buttons_reply ?? crudo.reply.list_reply
  const id = elegida?.id
  if (typeof id !== 'string' || id.length === 0) return null
  const limpio = limpiarIdOpcion(id)
  return limpio.length > 0 ? limpio : null
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

    // Una opción tocada llega como `type: "reply"`, no como texto. Se
    // normaliza a su id (`menu:tareas_hoy`) y sigue el mismo camino que un
    // mensaje escrito — así el resto del webhook no necesita dos ramas.
    const idOpcion = idDeRespuestaInteractiva(crudo)
    if (crudo.type !== 'text' && idOpcion === null) continue

    const texto = idOpcion ?? crudo.text?.body
    const numero = crudo.from
    const chatId = crudo.chat_id
    const id = crudo.id
    if (typeof texto !== 'string' || typeof numero !== 'string' || typeof chatId !== 'string' || typeof id !== 'string') continue
    if (texto.trim().length === 0) continue
    if (esChatDeGrupo(chatId)) continue

    salida.push({ id, numero, texto, fromMe: crudo.from_me === true, chatId, esOpcion: idOpcion !== null })
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
  // Una opción tocada por el propio dueño del canal es una interacción
  // deliberada con Flow+, no un eco: el bot nunca "toca botones".
  if (mensaje.esOpcion) return true
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
