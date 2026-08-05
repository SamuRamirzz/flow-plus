import { describe, expect, it } from 'vitest'
import { construirInput, esConversacion, normalizarAdjuntos, type AdjuntoIA, type ConversationTurnInput, type PasoGemini } from '../construirInput'

const FOTO: AdjuntoIA = { tipo: 'imagen', datosBase64: 'QUJD', mimeType: 'image/png' }
const PDF: AdjuntoIA = { tipo: 'documento', datosBase64: 'REVG', mimeType: 'application/pdf' }

const CONVERSACION: ConversationTurnInput[] = [
  { rol: 'usuario', texto: 'crea una tarea' },
  { rol: 'modelo', texto: 'Quieres crear 1 tarea.' },
  { rol: 'usuario', texto: 'ponle prioridad alta' },
]

describe('construirInput — sin adjuntos: la salida NO cambia respecto a antes del Sprint 8', () => {
  it('un string se devuelve tal cual (ruta de texto simple, byte-idéntica)', () => {
    expect(construirInput('hola')).toBe('hola')
  })

  it('un string se devuelve tal cual aunque se pase un arreglo de adjuntos vacío', () => {
    expect(construirInput('hola', [])).toBe('hola')
  })

  it('un input que no es string ni conversación se serializa a JSON, como antes', () => {
    expect(construirInput({ a: 1 })).toBe('{"a":1}')
  })

  it('una conversación produce pasos alternados user_input/model_output, sin adjuntos', () => {
    const pasos = construirInput(CONVERSACION) as PasoGemini[]
    expect(pasos.map((p) => p.type)).toEqual(['user_input', 'model_output', 'user_input'])
    expect(pasos[0].content).toEqual([{ type: 'text', text: 'crea una tarea' }])
    expect(pasos[2].content).toEqual([{ type: 'text', text: 'ponle prioridad alta' }])
  })
})

describe('construirInput — con adjuntos', () => {
  it('texto + imagen produce UN paso de usuario con el texto primero y la imagen después', () => {
    const pasos = construirInput('Extrae los bloques', [FOTO]) as PasoGemini[]
    expect(pasos).toEqual([
      {
        type: 'user_input',
        content: [
          { type: 'text', text: 'Extrae los bloques' },
          { type: 'image', mime_type: 'image/png', data: 'QUJD' },
        ],
      },
    ])
  })

  it('un documento usa el bloque "document", no "image"', () => {
    const pasos = construirInput('Lee esto', [PDF]) as PasoGemini[]
    expect(pasos[0].content[1]).toEqual({ type: 'document', mime_type: 'application/pdf', data: 'REVG' })
  })

  it('varios adjuntos se anexan todos, en orden', () => {
    const pasos = construirInput('dos cosas', [FOTO, PDF]) as PasoGemini[]
    expect(pasos[0].content.map((c) => c.type)).toEqual(['text', 'image', 'document'])
  })

  it('en una conversación, el adjunto va al ÚLTIMO turno de usuario — no al primero ni a uno del modelo', () => {
    const pasos = construirInput(CONVERSACION, [FOTO]) as PasoGemini[]
    expect(pasos).toHaveLength(3)
    // El primer turno de usuario queda intacto.
    expect(pasos[0].content).toEqual([{ type: 'text', text: 'crea una tarea' }])
    // El turno del modelo queda intacto.
    expect(pasos[1].content).toEqual([{ type: 'text', text: 'Quieres crear 1 tarea.' }])
    // El último turno de usuario es el que recibe la imagen.
    expect(pasos[2].content).toEqual([
      { type: 'text', text: 'ponle prioridad alta' },
      { type: 'image', mime_type: 'image/png', data: 'QUJD' },
    ])
  })

  it('si la conversación termina en un turno del modelo, el adjunto va a un turno de usuario nuevo al final', () => {
    const soloModelo: ConversationTurnInput[] = [{ rol: 'modelo', texto: 'hola' }]
    const pasos = construirInput(soloModelo, [FOTO]) as PasoGemini[]
    expect(pasos).toHaveLength(2)
    expect(pasos[1]).toEqual({ type: 'user_input', content: [{ type: 'image', mime_type: 'image/png', data: 'QUJD' }] })
  })
})

describe('normalizarAdjuntos', () => {
  it('sin metadata.adjuntos devuelve vacío', () => {
    expect(normalizarAdjuntos(undefined)).toEqual([])
    expect(normalizarAdjuntos({})).toEqual([])
  })

  it('adjuntos válidos se conservan tal cual', () => {
    expect(normalizarAdjuntos({ adjuntos: [FOTO, PDF] })).toEqual([FOTO, PDF])
  })

  it('descarta entradas mal formadas sin descartar las buenas', () => {
    const resultado = normalizarAdjuntos({
      adjuntos: [FOTO, { tipo: 'imagen' }, { tipo: 'imagen', datosBase64: '', mimeType: 'image/png' }, { tipo: 'otro', datosBase64: 'X', mimeType: 'x' }, null],
    })
    expect(resultado).toEqual([FOTO])
  })

  it('metadata.adjuntos que no es un arreglo se trata como vacío', () => {
    expect(normalizarAdjuntos({ adjuntos: 'no-es-arreglo' })).toEqual([])
  })
})

describe('esConversacion', () => {
  it('reconoce una conversación válida', () => {
    expect(esConversacion(CONVERSACION)).toBe(true)
  })

  it('un string no es conversación', () => {
    expect(esConversacion('hola')).toBe(false)
  })

  it('un arreglo vacío no es conversación (sería ambiguo con "sin input")', () => {
    expect(esConversacion([])).toBe(false)
  })

  it('un arreglo de objetos sin rol/texto no es conversación', () => {
    expect(esConversacion([{ foo: 'bar' }])).toBe(false)
  })
})
