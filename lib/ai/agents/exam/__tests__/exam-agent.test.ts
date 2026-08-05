import { describe, expect, it } from 'vitest'
import { createId } from '@/lib/ai/utils'
import type { AIContext, AIProvider, AIProviderCapabilities, AIRequest, AIResponse } from '@/lib/ai/types'
import { GEMINI_PROVIDER_ID } from '@/lib/ai/providers/gemini'
import { examAgent } from '../index'

const testContext: AIContext = { userId: 'user-1', generatedAt: Date.now() }

const FAKE_CAPABILITIES: AIProviderCapabilities = {
  supportsVision: false,
  supportsStructuredOutput: true,
  supportsStreaming: false,
  supportsBatch: false,
  supportsPromptCaching: false,
}

// Doble de AIProvider — nunca toca la red, mismo patrón que
// homework-agent.test.ts.
class FakeProvider implements AIProvider {
  readonly id = GEMINI_PROVIDER_ID
  readonly capabilities = FAKE_CAPABILITIES
  ultimaInstruccion: string | null = null
  constructor(private readonly content: string) {}
  async send(request: AIRequest): Promise<AIResponse> {
    this.ultimaInstruccion = (request.metadata as { systemInstruction?: string } | undefined)?.systemInstruction ?? null
    return { requestId: request.id, providerId: this.id, model: 'fake-model', content: this.content }
  }
}

function peticion(texto: string): AIRequest {
  return { id: createId('req'), agentId: 'exam-agent', userId: 'user-1', input: texto }
}

async function correr(respuestaDelModelo: string, texto = 'Examen de química el viernes') {
  return examAgent.run(peticion(texto), testContext, new FakeProvider(respuestaDelModelo))
}

describe('ExamAgent — extracción normal', () => {
  it('extrae los tres campos y los normaliza', async () => {
    const r = await correr(JSON.stringify({ temario: 'Capítulos 4 al 7', formato: 'escrito', peso: 30 }))
    expect(r.status).toBe('success')
    expect(r.output).toEqual({ temario: 'Capítulos 4 al 7', formato: 'escrito', peso: 30 })
  })

  it('aplica los sinónimos del normalizador al formato que devuelve el modelo', async () => {
    const r = await correr(JSON.stringify({ temario: '', formato: 'exposición oral', peso: 0 }))
    expect(r.output?.formato).toBe('oral')
  })

  it('convierte los centinelas del schema ("" y 0) en null', async () => {
    const r = await correr(JSON.stringify({ temario: '', formato: '', peso: 0 }))
    expect(r.output).toEqual({ temario: null, formato: null, peso: null })
  })

  it('extraer solo uno de los tres es un resultado válido, no un error', async () => {
    const r = await correr(JSON.stringify({ temario: 'todo el semestre', formato: '', peso: 0 }))
    expect(r.status).toBe('success')
    expect(r.output?.temario).toBe('todo el semestre')
  })
})

describe('ExamAgent — confianza', () => {
  it('es la proporción de campos realmente encontrados, no una autoevaluación del modelo', async () => {
    expect((await correr(JSON.stringify({ temario: 'x', formato: 'oral', peso: 50 }))).confidence).toBe(1)
    expect((await correr(JSON.stringify({ temario: 'x', formato: 'oral', peso: 0 }))).confidence).toBeCloseTo(2 / 3)
    expect((await correr(JSON.stringify({ temario: 'x', formato: '', peso: 0 }))).confidence).toBeCloseTo(1 / 3)
    expect((await correr(JSON.stringify({ temario: '', formato: '', peso: 0 }))).confidence).toBe(0)
  })
})

describe('ExamAgent — nunca rompe el flujo que lo llama (es aditivo)', () => {
  it('JSON inválido devuelve success con los tres campos vacíos, no lanza', async () => {
    const r = await correr('esto no es JSON')
    expect(r.status).toBe('success')
    expect(r.output).toEqual({ temario: null, formato: null, peso: null })
  })

  it('JSON que no es objeto tampoco lanza', async () => {
    const r = await correr('[1,2,3]')
    expect(r.status).toBe('success')
    expect(r.output).toEqual({ temario: null, formato: null, peso: null })
  })

  it('campos con tipos equivocados se ignoran uno por uno, sin descartar el resto', async () => {
    const r = await correr(JSON.stringify({ temario: 'Cap 1', formato: 99, peso: 'muchísimo' }))
    expect(r.output).toEqual({ temario: 'Cap 1', formato: null, peso: null })
  })

  it('texto vacío devuelve success sin llamar al modelo (a diferencia de HomeworkAgent, que lanza)', async () => {
    const proveedor = new FakeProvider('{}')
    const r = await examAgent.run(peticion('   '), testContext, proveedor)
    expect(r.status).toBe('success')
    expect(r.output).toEqual({ temario: null, formato: null, peso: null })
    expect(proveedor.ultimaInstruccion).toBeNull() // nunca se llamó
  })
})

describe('ExamAgent — definición', () => {
  it('no pide scopes de contexto: no resuelve fechas ni materias', () => {
    expect(examAgent.definition.contextScopes).toEqual([])
  })

  it('usa el modelo ligero', () => {
    expect(examAgent.definition.defaultModel).toBe('gemini-3.5-flash-lite')
  })

  it('el schema mantiene solo 3 propiedades, todas requeridas (evita la degeneración documentada del modelo)', () => {
    const esquema = examAgent.definition.outputSchema as { properties: Record<string, unknown>; required: string[] }
    expect(Object.keys(esquema.properties)).toHaveLength(3)
    expect(esquema.required.sort()).toEqual(['formato', 'peso', 'temario'])
  })
})
