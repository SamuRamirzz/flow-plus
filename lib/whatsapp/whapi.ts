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
 * Normaliza un número a solo dígitos, que es como Whapi identifica al
 * remitente (`from: "573001112233"`, sin `+`). Se aplica a los dos lados de
 * cualquier comparación para que un número guardado en E.164 (`+57300...`,
 * el formato que pide la UI) case con el que llega del webhook.
 */
export function normalizarNumero(numero: string): string {
  return numero.replace(/\D/g, '')
}
