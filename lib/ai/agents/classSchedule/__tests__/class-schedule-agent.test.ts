import { beforeEach, describe, expect, it } from 'vitest'
import { AIOrchestrator } from '@/lib/ai/orchestrator'
import { createId } from '@/lib/ai/utils'
import type { AIContext, AIProvider, AIProviderCapabilities, AIRequest, AIResponse } from '@/lib/ai/types'
import { GEMINI_PROVIDER_ID } from '@/lib/ai/providers/gemini'
import { CLASS_SCHEDULE_AGENT_ID, classScheduleAgent, ClassScheduleOutputParser, type ClassScheduleAgentOutput } from '../index'

const testContext: AIContext = { userId: 'user-1', generatedAt: Date.now() }

const CAPS_CON_VISION: AIProviderCapabilities = {
  supportsVision: true,
  supportsStructuredOutput: true,
  supportsStreaming: false,
  supportsBatch: false,
  supportsPromptCaching: false,
}

// Doble de prueba: nunca llama a la red. Guarda el último request para poder
// afirmar QUÉ se le mandó al proveedor (que la imagen viajó, que se pidió el
// modelo de visión), no solo qué devolvió.
class FakeProvider implements AIProvider {
  readonly id = GEMINI_PROVIDER_ID
  capabilities: AIProviderCapabilities = CAPS_CON_VISION
  ultimoRequest: AIRequest | null = null
  constructor(private readonly content: string) {}

  async send(request: AIRequest): Promise<AIResponse> {
    this.ultimoRequest = request
    return { requestId: request.id, providerId: this.id, model: 'fake-model', content: this.content }
  }
}

const ADJUNTO = { tipo: 'imagen' as const, datosBase64: 'QUJD', mimeType: 'image/png' }

function requestConImagen(): AIRequest {
  return {
    id: createId('req'),
    agentId: CLASS_SCHEDULE_AGENT_ID,
    userId: 'user-1',
    input: '',
    metadata: { adjuntos: [ADJUNTO] },
  }
}

function respuestaValida() {
  return JSON.stringify({
    tipoRespuesta: 'bloques',
    mensaje: '',
    bloques: [
      { materia: 'Cálculo II', diaSemana: 1, horaInicio: '07:00', horaFin: '09:00', aula: 'A301', confidence: 0.95 },
      { materia: 'Física I', diaSemana: 5, horaInicio: '07:00', horaFin: '09:00', aula: 'Lab 2', confidence: 0.9 },
    ],
  })
}

describe('ClassScheduleAgent — ejecución vía orchestrator', () => {
  let orchestrator: AIOrchestrator

  beforeEach(() => {
    orchestrator = new AIOrchestrator()
    orchestrator.registerAgent(classScheduleAgent)
  })

  it('extrae bloques estructurados de una respuesta válida', async () => {
    orchestrator.providers.register(new FakeProvider(respuestaValida()))
    const result = await orchestrator.execute<ClassScheduleAgentOutput>(CLASS_SCHEDULE_AGENT_ID, requestConImagen(), testContext)

    expect(result.status).toBe('success')
    expect(result.output?.tipoRespuesta).toBe('bloques')
    expect(result.output?.bloques).toHaveLength(2)
    expect(result.output?.bloques[0]).toMatchObject({ materia: 'Cálculo II', diaSemana: 1, horaInicio: '07:00', aula: 'A301' })
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('le pasa la imagen y el modelo de visión al proveedor', async () => {
    const provider = new FakeProvider(respuestaValida())
    orchestrator.providers.register(provider)
    await orchestrator.execute(CLASS_SCHEDULE_AGENT_ID, requestConImagen(), testContext)

    const meta = provider.ultimoRequest?.metadata as Record<string, unknown>
    expect(meta.adjuntos).toEqual([ADJUNTO])
    expect(typeof meta.model).toBe('string')
    expect(meta.outputSchema).toBeDefined()
  })

  it('sin imagen falla de forma controlada, sin llegar al proveedor', async () => {
    orchestrator.providers.register(new FakeProvider(respuestaValida()))
    const result = await orchestrator.execute(
      CLASS_SCHEDULE_AGENT_ID,
      { id: createId('req'), agentId: CLASS_SCHEDULE_AGENT_ID, userId: 'user-1', input: '', metadata: {} },
      testContext
    )
    expect(result.status).toBe('error')
    expect(result.error?.code).toBe('AI_VALIDATION_ERROR')
  })

  it('si el proveedor no soporta visión, falla explícito en vez de mandar la imagen igual', async () => {
    const provider = new FakeProvider(respuestaValida())
    provider.capabilities = { ...CAPS_CON_VISION, supportsVision: false }
    orchestrator.providers.register(provider)

    const result = await orchestrator.execute(CLASS_SCHEDULE_AGENT_ID, requestConImagen(), testContext)
    expect(result.status).toBe('error')
    expect(result.error?.message).toMatch(/no soporta imágenes/i)
    expect(provider.ultimoRequest).toBeNull()
  })

  it('con JSON inválido resuelve como error, sin lanzar', async () => {
    orchestrator.providers.register(new FakeProvider('esto no es JSON'))
    const result = await orchestrator.execute(CLASS_SCHEDULE_AGENT_ID, requestConImagen(), testContext)
    expect(result.status).toBe('error')
    expect(result.error?.code).toBe('AI_VALIDATION_ERROR')
  })

  it('nunca escribe nada: su autonomía es de solo propuesta', () => {
    expect(classScheduleAgent.definition.autonomyLevel).toBe('suggested_confirmation_required')
  })
})

describe('ClassScheduleOutputParser', () => {
  const parser = new ClassScheduleOutputParser()

  it('normaliza cadenas vacías de hora/aula a null', () => {
    const r = parser.parse(
      JSON.stringify({
        tipoRespuesta: 'bloques',
        mensaje: '',
        bloques: [{ materia: 'Taller', diaSemana: 2, horaInicio: '', horaFin: '', aula: '', confidence: 0.5 }],
      })
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.bloques[0]).toMatchObject({ horaInicio: null, horaFin: null, aula: null })
    expect(r.data.mensaje).toBeNull()
  })

  it('descarta filas sin materia o con día fuera del rango ISO, conservando las buenas', () => {
    const r = parser.parse(
      JSON.stringify({
        tipoRespuesta: 'bloques',
        mensaje: '',
        bloques: [
          { materia: '', diaSemana: 1, horaInicio: '07:00', horaFin: '09:00', aula: '', confidence: 1 },
          { materia: 'Válida', diaSemana: 3, horaInicio: '07:00', horaFin: '09:00', aula: '', confidence: 1 },
          { materia: 'Domingo JS', diaSemana: 0, horaInicio: '07:00', horaFin: '09:00', aula: '', confidence: 1 },
          { materia: 'Fuera de rango', diaSemana: 9, horaInicio: '07:00', horaFin: '09:00', aula: '', confidence: 1 },
        ],
      })
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.bloques.map((b) => b.materia)).toEqual(['Válida'])
  })

  it('descarta horas con formato inválido en vez de propagarlas a la grilla', () => {
    const r = parser.parse(
      JSON.stringify({
        tipoRespuesta: 'bloques',
        mensaje: '',
        bloques: [{ materia: 'X', diaSemana: 1, horaInicio: '2 pm', horaFin: '25:00', aula: '', confidence: 1 }],
      })
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.bloques[0]).toMatchObject({ horaInicio: null, horaFin: null })
  })

  it('"no_es_horario" conserva el mensaje y no trae bloques', () => {
    const r = parser.parse(JSON.stringify({ tipoRespuesta: 'no_es_horario', mensaje: 'Esto parece una foto de un gato.', bloques: [] }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.tipoRespuesta).toBe('no_es_horario')
    expect(r.data.mensaje).toMatch(/gato/)
  })

  it('sin tipoRespuesta válido y sin bloques cae a "ilegible", nunca a "no_es_horario"', () => {
    const r = parser.parse(JSON.stringify({ bloques: [] }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.tipoRespuesta).toBe('ilegible')
  })

  it('sin tipoRespuesta válido pero con bloques leídos infiere "bloques"', () => {
    const r = parser.parse(
      JSON.stringify({ bloques: [{ materia: 'X', diaSemana: 1, horaInicio: '07:00', horaFin: '09:00', aula: '', confidence: 1 }] })
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.tipoRespuesta).toBe('bloques')
  })

  it('no es JSON → ParseResult de error, sin lanzar', () => {
    expect(parser.parse('{{{').ok).toBe(false)
  })
})
