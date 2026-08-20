import { describe, it, expect } from 'vitest'
import {
  extraerMensajesDeTexto,
  debeProcesarse,
  canalDelPayload,
  esChatDeGrupo,
  normalizarNumero,
  esLid,
  destinoDeRespuesta,
  telefonoDelRemitente,
} from '../whapi'

// Payload real documentado por Whapi (support.whapi.cloud, "Incoming
// message"), con el número cambiado.
const PAYLOAD_TEXTO = {
  messages: [
    {
      id: 'p.w30M7fgwWD4XwHu.g4CA-gBgTwl0rVw',
      from_me: false,
      type: 'text',
      chat_id: '573001112233@s.whatsapp.net',
      timestamp: 1712995245,
      source: 'mobile',
      text: { body: '/tareas' },
      from: '573001112233',
      from_name: 'Samuel',
    },
  ],
  event: { type: 'messages', event: 'post' },
  channel_id: 'DEADPL-PHJZQ',
}

describe('extraerMensajesDeTexto', () => {
  it('extrae un mensaje de texto del payload real de Whapi', () => {
    expect(extraerMensajesDeTexto(PAYLOAD_TEXTO)).toEqual([
      {
        id: 'p.w30M7fgwWD4XwHu.g4CA-gBgTwl0rVw',
        numero: '573001112233',
        texto: '/tareas',
        fromMe: false,
        chatId: '573001112233@s.whatsapp.net',
        esOpcion: false,
      },
    ])
  })

  it('descarta mensajes que no son de texto', () => {
    const payload = { messages: [{ ...PAYLOAD_TEXTO.messages[0], type: 'image', text: undefined }] }
    expect(extraerMensajesDeTexto(payload)).toEqual([])
  })

  it('descarta mensajes de grupo', () => {
    const payload = {
      messages: [{ ...PAYLOAD_TEXTO.messages[0], chat_id: '120363000000000000@g.us' }],
    }
    expect(extraerMensajesDeTexto(payload)).toEqual([])
  })

  it('descarta texto vacío o solo espacios', () => {
    const payload = { messages: [{ ...PAYLOAD_TEXTO.messages[0], text: { body: '   ' } }] }
    expect(extraerMensajesDeTexto(payload)).toEqual([])
  })

  it('conserva el flag from_me', () => {
    const payload = { messages: [{ ...PAYLOAD_TEXTO.messages[0], from_me: true }] }
    expect(extraerMensajesDeTexto(payload)[0].fromMe).toBe(true)
  })

  it('tolera payloads de otros eventos sin lanzar', () => {
    expect(extraerMensajesDeTexto({ statuses: [{ id: 'x' }], event: { type: 'statuses' } })).toEqual([])
    expect(extraerMensajesDeTexto({})).toEqual([])
    expect(extraerMensajesDeTexto(null)).toEqual([])
    expect(extraerMensajesDeTexto('no soy un objeto')).toEqual([])
    expect(extraerMensajesDeTexto({ messages: 'no soy un array' })).toEqual([])
  })

  it('descarta entradas malformadas dentro de un array válido', () => {
    const payload = { messages: [null, { type: 'text' }, PAYLOAD_TEXTO.messages[0]] }
    expect(extraerMensajesDeTexto(payload)).toHaveLength(1)
  })

  it('extrae varios mensajes de un mismo payload', () => {
    const payload = {
      messages: [
        PAYLOAD_TEXTO.messages[0],
        { ...PAYLOAD_TEXTO.messages[0], id: 'otro', text: { body: '/ayuda' } },
      ],
    }
    expect(extraerMensajesDeTexto(payload)).toHaveLength(2)
  })
})

describe('debeProcesarse — la regla que evita el bucle infinito', () => {
  const base = { id: 'x', numero: '573001112233', chatId: '573001112233@s.whatsapp.net', esOpcion: false }

  it('procesa siempre un mensaje ajeno', () => {
    expect(debeProcesarse({ ...base, texto: '/tareas', fromMe: false })).toBe(true)
    expect(debeProcesarse({ ...base, texto: 'hola', fromMe: false })).toBe(true)
  })

  it('procesa un mensaje propio SOLO si es un comando', () => {
    // Caso real: el usuario se escribe a sí mismo desde la cuenta vinculada.
    expect(debeProcesarse({ ...base, texto: '/tareas', fromMe: true })).toBe(true)
    expect(debeProcesarse({ ...base, texto: '  /ayuda', fromMe: true })).toBe(true)
  })

  it('IGNORA las respuestas del propio bot — sin esto se contestaría en bucle', () => {
    // Formas reales con las que empiezan las respuestas de ejecutarComando.
    expect(debeProcesarse({ ...base, texto: '✅ Tarea creada: *Ensayo*', fromMe: true })).toBe(false)
    expect(debeProcesarse({ ...base, texto: '*Para hoy* (2)', fromMe: true })).toBe(false)
    expect(debeProcesarse({ ...base, texto: 'No reconocí ese comando. Escribe */ayuda*', fromMe: true })).toBe(false)
    expect(debeProcesarse({ ...base, texto: '📝 Nota guardada', fromMe: true })).toBe(false)
  })
})

describe('canalDelPayload', () => {
  it('devuelve el channel_id', () => {
    expect(canalDelPayload(PAYLOAD_TEXTO)).toBe('DEADPL-PHJZQ')
  })
  it('devuelve null si no viene', () => {
    expect(canalDelPayload({})).toBeNull()
    expect(canalDelPayload(null)).toBeNull()
  })
})

describe('esChatDeGrupo', () => {
  it('distingue grupo de individual', () => {
    expect(esChatDeGrupo('120363000000000000@g.us')).toBe(true)
    expect(esChatDeGrupo('573001112233@s.whatsapp.net')).toBe(false)
  })
})

describe('normalizarNumero', () => {
  it('deja solo dígitos, para que E.164 case con el formato de Whapi', () => {
    expect(normalizarNumero('+57 300 111 2233')).toBe('573001112233')
    expect(normalizarNumero('573001112233')).toBe('573001112233')
    expect(normalizarNumero('+57-300-111-2233')).toBe('573001112233')
  })
})

// Casos tomados del canal REAL: un remitente puede llegar como teléfono o
// como LID, y confundirlos causó dos bugs distintos en producción.
describe('esLid / destinoDeRespuesta / telefonoDelRemitente', () => {
  const conLid: Parameters<typeof destinoDeRespuesta>[0] = {
    id: 'x',
    numero: '156126641426469@lid',
    texto: '/ayuda',
    fromMe: false,
    chatId: '156126641426469@lid',
    esOpcion: false,
  }
  const conTelefono: Parameters<typeof destinoDeRespuesta>[0] = {
    id: 'y',
    numero: '573001112233',
    texto: '/ayuda',
    fromMe: false,
    chatId: '573001112233@s.whatsapp.net',
    esOpcion: false,
  }

  it('distingue un LID de un teléfono', () => {
    expect(esLid('156126641426469@lid')).toBe(true)
    expect(esLid('573001112233@s.whatsapp.net')).toBe(false)
    expect(esLid('573001112233')).toBe(false)
  })

  it('responde SIEMPRE al chat exacto del que vino el mensaje', () => {
    // El bug real: responder a los dígitos del LID abría
    // `156126641426469@s.whatsapp.net`, otra conversación, y el usuario no
    // veía nada.
    expect(destinoDeRespuesta(conLid)).toBe('156126641426469@lid')
    expect(destinoDeRespuesta(conTelefono)).toBe('573001112233@s.whatsapp.net')
  })

  it('no inventa un teléfono a partir de un LID', () => {
    expect(telefonoDelRemitente(conLid)).toBeNull()
  })

  it('extrae el teléfono cuando de verdad lo hay', () => {
    expect(telefonoDelRemitente(conTelefono)).toBe('573001112233')
  })
})

// Formato confirmado en la doc de Whapi: al tocar un botón NO llega un
// mensaje de texto, llega `type: "reply"` con el id dentro.
describe('respuestas de botón y de lista', () => {
  const conBoton = (reply: Record<string, unknown>) => ({
    messages: [
      {
        id: 'r1',
        from_me: false,
        type: 'reply',
        chat_id: '573001112233@s.whatsapp.net',
        from: '573001112233',
        reply,
      },
    ],
  })

  it('normaliza un botón tocado a su id, marcándolo como opción', () => {
    const [m] = extraerMensajesDeTexto(
      conBoton({ type: 'buttons_reply', buttons_reply: { id: 'menu:tareas_hoy', title: 'Tareas de hoy' } })
    )
    expect(m.texto).toBe('menu:tareas_hoy')
    expect(m.esOpcion).toBe(true)
  })

  it('hace lo mismo con una fila de lista', () => {
    const [m] = extraerMensajesDeTexto(
      conBoton({ type: 'list_reply', list_reply: { id: 'menu:horario', title: 'Mi horario' } })
    )
    expect(m.texto).toBe('menu:horario')
    expect(m.esOpcion).toBe(true)
  })

  it('descarta un reply sin id utilizable', () => {
    expect(extraerMensajesDeTexto(conBoton({ type: 'buttons_reply', buttons_reply: {} }))).toEqual([])
    expect(extraerMensajesDeTexto(conBoton({}))).toEqual([])
  })

  it('una opción tocada por el dueño del canal SÍ se procesa', () => {
    // No es un eco del bot: el bot nunca toca botones. Sin esta regla, el
    // menú sería inservible justo en el montaje de "escribirse a sí mismo".
    const base = { id: 'x', numero: '57300', chatId: '57300@s.whatsapp.net' }
    expect(debeProcesarse({ ...base, texto: 'menu:horario', fromMe: true, esOpcion: true })).toBe(true)
  })
})
