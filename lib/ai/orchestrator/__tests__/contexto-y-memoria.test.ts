import { describe, expect, it, vi } from 'vitest'
import { AIOrchestrator } from '../AIOrchestrator'
import { ContextEngine } from '@/lib/ai/context'
import { createId } from '@/lib/ai/utils'
import type {
  AIAgent,
  AIContext,
  AIContextScope,
  AIProvider,
  AIProviderCapabilities,
  AIRequest,
  AIResponse,
  MemoryEntry,
  MemoryScope,
  MemoryStore,
} from '@/lib/ai/types'
import { GEMINI_PROVIDER_ID } from '@/lib/ai/providers/gemini'

const CAPS: AIProviderCapabilities = {
  supportsVision: false,
  supportsStructuredOutput: true,
  supportsStreaming: false,
  supportsBatch: false,
  supportsPromptCaching: false,
}

class FakeProvider implements AIProvider {
  readonly id = GEMINI_PROVIDER_ID
  readonly capabilities = CAPS
  async send(request: AIRequest): Promise<AIResponse> {
    return { requestId: request.id, providerId: this.id, model: 'fake', content: '{}' }
  }
}

/** Agente de prueba que solo captura el contexto que recibió. */
function agenteQueCapturaContexto(contextScopes?: AIContextScope[]) {
  let recibido: AIContext | null = null
  const agente: AIAgent = {
    definition: {
      id: 'agente-prueba',
      triggerEvents: ['prueba'],
      defaultProviderId: GEMINI_PROVIDER_ID,
      defaultModel: 'fake',
      autonomyLevel: 'autonomous',
      executionQueue: 'interactive',
      ...(contextScopes ? { contextScopes } : {}),
    },
    async run(_request, context) {
      recibido = context
      return {
        agentId: 'agente-prueba',
        requestId: _request.id,
        status: 'success' as const,
        startedAt: Date.now(),
        finishedAt: Date.now(),
      }
    },
  }
  return { agente, contextoRecibido: () => recibido }
}

function peticion(): AIRequest {
  return { id: createId('req'), agentId: 'agente-prueba', userId: 'user-1', input: 'hola' }
}

describe('execute() construye el contexto desde definition.contextScopes', () => {
  it('un agente SIN contextScopes recibe el contexto mínimo', async () => {
    const { agente, contextoRecibido } = agenteQueCapturaContexto()
    const orchestrator = new AIOrchestrator({ contextEngine: new ContextEngine({ identity: async () => ({ materias: [] }) }) })
    orchestrator.registerAgent(agente)
    orchestrator.providers.register(new FakeProvider())

    const r = await orchestrator.execute('agente-prueba', peticion())
    expect(r.status).toBe('success')
    expect(contextoRecibido()?.identity).toBeUndefined()
    expect(contextoRecibido()?.userId).toBe('user-1')
  })

  it('un agente CON contextScopes recibe esos scopes ya cargados', async () => {
    const { agente, contextoRecibido } = agenteQueCapturaContexto(['identity'])
    const orchestrator = new AIOrchestrator({
      contextEngine: new ContextEngine({ identity: async () => ({ nombresDeMateria: ['Cálculo II'] }) }),
    })
    orchestrator.registerAgent(agente)
    orchestrator.providers.register(new FakeProvider())

    await orchestrator.execute('agente-prueba', peticion())
    expect((contextoRecibido()?.identity as { nombresDeMateria: string[] }).nombresDeMateria).toEqual(['Cálculo II'])
  })

  it('un contexto explícito sigue teniendo prioridad (costura para pruebas)', async () => {
    const loader = vi.fn(async () => ({ nombresDeMateria: ['no debería usarse'] }))
    const { agente, contextoRecibido } = agenteQueCapturaContexto(['identity'])
    const orchestrator = new AIOrchestrator({ contextEngine: new ContextEngine({ identity: loader }) })
    orchestrator.registerAgent(agente)
    orchestrator.providers.register(new FakeProvider())

    await orchestrator.execute('agente-prueba', peticion(), { userId: 'user-1', generatedAt: 1 })
    expect(loader).not.toHaveBeenCalled()
    expect(contextoRecibido()?.generatedAt).toBe(1)
  })

  it('si el contexto no se puede construir, execute() devuelve error sin lanzar', async () => {
    const { agente } = agenteQueCapturaContexto(['habits'])
    const orchestrator = new AIOrchestrator({ contextEngine: new ContextEngine({ identity: async () => ({}) }) })
    orchestrator.registerAgent(agente)
    orchestrator.providers.register(new FakeProvider())

    const r = await orchestrator.execute('agente-prueba', peticion())
    expect(r.status).toBe('error')
    expect(r.error?.code).toBe('AI_NOT_IMPLEMENTED')
  })
})

describe('MemoryStore inyectado', () => {
  class FakeMemoryStore implements MemoryStore {
    entradas: MemoryEntry[] = []
    async get(userId: string, scope: MemoryScope) {
      return this.entradas.filter((e) => e.userId === userId && e.scope === scope)
    }
    async write(entrada: Omit<MemoryEntry, 'id' | 'createdAt'>) {
      const completa: MemoryEntry = { ...entrada, id: createId('mem'), createdAt: Date.now() }
      this.entradas.push(completa)
      return completa
    }
    async forget(userId: string, scope: MemoryScope, entryId: string) {
      this.entradas = this.entradas.filter((e) => !(e.id === entryId && e.userId === userId && e.scope === scope))
    }
  }

  it('queda accesible en orchestrator.memory y se reporta en health()', async () => {
    const memoryStore = new FakeMemoryStore()
    const orchestrator = new AIOrchestrator({ memoryStore })

    expect(orchestrator.memory).toBe(memoryStore)
    expect(orchestrator.health().memoria.conectada).toBe(true)

    await orchestrator.memory!.write({ userId: 'u1', scope: 'permanent', content: { nota: 'x' } })
    expect(await orchestrator.memory!.get('u1', 'permanent')).toHaveLength(1)
  })

  it('sin memoryStore, health() lo reporta como no conectada', () => {
    expect(new AIOrchestrator().health().memoria.conectada).toBe(false)
  })

  it('health() reporta los scopes de contexto disponibles', () => {
    const orchestrator = new AIOrchestrator({
      contextEngine: new ContextEngine({ identity: async () => ({}), schedule: async () => ({}) }),
    })
    expect(orchestrator.health().contexto.scopes.sort()).toEqual(['identity', 'schedule'])
  })
})
