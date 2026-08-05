import { beforeEach, describe, expect, it } from 'vitest'
import { AIOrchestrator } from '@/lib/ai/orchestrator'
import { createId } from '@/lib/ai/utils'
import type { AIContext, AIProvider, AIProviderCapabilities, AIRequest, AIResponse } from '@/lib/ai/types'
import { GEMINI_PROVIDER_ID } from '@/lib/ai/providers/gemini'
import { TASK_MANAGEMENT_AGENT_ID, taskManagementAgent } from '../index'

const testContext: AIContext = { userId: 'user-1', generatedAt: Date.now() }

const CAPS_CON_VISION: AIProviderCapabilities = {
  supportsVision: true,
  supportsStructuredOutput: true,
  supportsStreaming: false,
  supportsBatch: false,
  supportsPromptCaching: false,
}

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

function respuestaConUnaTareaCreada() {
  return JSON.stringify({
    tipoRespuesta: 'operaciones',
    mensaje: null,
    operaciones: [
      {
        tipo: 'crear',
        titulo: 'Taller de cálculo',
        materia: 'Cálculo II',
        fecha: '2026-08-14',
        prioridad: 'alta',
        tipoTarea: 'examen',
        confidence: 0.9,
        descripcion: '',
        indiceObjetivo: -1,
        indicesCandidatos: [],
        accionOriginal: '',
        cambios: {},
      },
    ],
  })
}

function requestBase(overrides: Partial<AIRequest> = {}): AIRequest {
  return { id: createId('req'), agentId: TASK_MANAGEMENT_AGENT_ID, userId: 'user-1', input: '', metadata: {}, ...overrides }
}

describe('TaskManagementAgent — adjuntos (Sub-sprint 7.3)', () => {
  let orchestrator: AIOrchestrator

  beforeEach(() => {
    orchestrator = new AIOrchestrator()
    orchestrator.registerAgent(taskManagementAgent)
  })

  it('sin adjuntos, el texto solo sigue sin mandar model/adjuntos al proveedor (byte-idéntico a antes)', async () => {
    const provider = new FakeProvider(respuestaConUnaTareaCreada())
    orchestrator.providers.register(provider)
    await orchestrator.execute(TASK_MANAGEMENT_AGENT_ID, requestBase({ input: 'crea una tarea de cálculo' }), testContext)

    const meta = provider.ultimoRequest?.metadata as Record<string, unknown>
    expect(meta.adjuntos).toBeUndefined()
    expect(meta.model).toBeUndefined()
  })

  it('con adjunto y sin texto, igual funciona — usa un texto por defecto, nunca vacío', async () => {
    const provider = new FakeProvider(respuestaConUnaTareaCreada())
    orchestrator.providers.register(provider)
    const result = await orchestrator.execute(
      TASK_MANAGEMENT_AGENT_ID,
      requestBase({ input: '', metadata: { adjuntos: [ADJUNTO] } }),
      testContext
    )

    expect(result.status).toBe('success')
    expect((result.output as { originalText: string } | undefined)?.originalText).not.toBe('')
  })

  it('con adjunto, le pasa adjuntos + el modelo de visión al proveedor', async () => {
    const provider = new FakeProvider(respuestaConUnaTareaCreada())
    orchestrator.providers.register(provider)
    await orchestrator.execute(
      TASK_MANAGEMENT_AGENT_ID,
      requestBase({ input: 'esto es para el lunes', metadata: { adjuntos: [ADJUNTO] } }),
      testContext
    )

    const meta = provider.ultimoRequest?.metadata as Record<string, unknown>
    expect(meta.adjuntos).toEqual([ADJUNTO])
    expect(typeof meta.model).toBe('string')
  })

  it('texto + adjunto combinados: la tarea creada se resuelve igual que el flujo de solo texto', async () => {
    orchestrator.providers.register(new FakeProvider(respuestaConUnaTareaCreada()))
    const result = await orchestrator.execute(
      TASK_MANAGEMENT_AGENT_ID,
      requestBase({ input: 'esto es para el lunes', metadata: { adjuntos: [ADJUNTO] } }),
      testContext
    )
    expect(result.status).toBe('success')
    const output = result.output as { operaciones: Array<{ tipo: string }> }
    expect(output.operaciones).toHaveLength(1)
    expect(output.operaciones[0].tipo).toBe('crear')
  })

  it('sin texto NI adjunto falla de forma controlada, sin llegar al proveedor', async () => {
    const provider = new FakeProvider(respuestaConUnaTareaCreada())
    orchestrator.providers.register(provider)
    const result = await orchestrator.execute(TASK_MANAGEMENT_AGENT_ID, requestBase({ input: '' }), testContext)

    expect(result.status).toBe('error')
    expect(result.error?.code).toBe('AI_VALIDATION_ERROR')
    expect(provider.ultimoRequest).toBeNull()
  })

  it('si el proveedor no soporta visión, un adjunto falla explícito en vez de mandarlo igual', async () => {
    const provider = new FakeProvider(respuestaConUnaTareaCreada())
    provider.capabilities = { ...CAPS_CON_VISION, supportsVision: false }
    orchestrator.providers.register(provider)

    const result = await orchestrator.execute(
      TASK_MANAGEMENT_AGENT_ID,
      requestBase({ input: 'crea la tarea de la foto', metadata: { adjuntos: [ADJUNTO] } }),
      testContext
    )
    expect(result.status).toBe('error')
    expect(result.error?.message).toMatch(/no soporta/i)
    expect(provider.ultimoRequest).toBeNull()
  })
})
