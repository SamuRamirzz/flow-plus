import type {
  AIAgent,
  AIContext,
  AIHealthStatus,
  AIRequest,
  AgentEvent,
  AgentResult,
  MemoryStore,
} from '@/lib/ai/types'
import { AgentRegistry } from '@/lib/ai/agents'
import { ProviderRegistry } from '@/lib/ai/providers'
import { AIEventBus } from '@/lib/ai/events'
import { ContextEngine } from '@/lib/ai/context'
import { aiConfig, type AIConfig } from '@/lib/ai/config'
import { AIError } from '@/lib/ai/errors'
import { ConcurrencyGuard } from './ConcurrencyGuard'
import { resolveExecutionOrder } from './resolveExecutionOrder'

export const ORCHESTRATOR_VERSION = 1

export type AIOrchestratorOptions = {
  config?: AIConfig
  agentRegistry?: AgentRegistry
  providerRegistry?: ProviderRegistry
  eventBus?: AIEventBus
  contextEngine?: ContextEngine
  memoryStore?: MemoryStore
}

// Único componente que decide qué agente ejecutar, con qué prioridad y en
// qué orden (docs/ai-architecture/02-orchestrator.md). No es un framework
// ni un singleton clásico: se instancia (ver lib/ai/orchestrator/index.ts)
// y todas sus dependencias son inyectables para poder probarlo aislado.
export class AIOrchestrator {
  readonly config: AIConfig
  readonly agents: AgentRegistry
  readonly providers: ProviderRegistry
  readonly events: AIEventBus
  readonly context: ContextEngine
  readonly memory?: MemoryStore

  private readonly concurrency: ConcurrencyGuard
  private initialized = false

  constructor(options: AIOrchestratorOptions = {}) {
    this.config = options.config ?? aiConfig
    this.agents = options.agentRegistry ?? new AgentRegistry()
    this.providers = options.providerRegistry ?? new ProviderRegistry()
    this.events = options.eventBus ?? new AIEventBus()
    this.context = options.contextEngine ?? new ContextEngine()
    this.memory = options.memoryStore
    this.concurrency = new ConcurrencyGuard(
      this.config.maxConcurrentExecutionsPerUser,
      this.config.maxConcurrentExecutionsGlobal
    )
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    await this.events.emit('orchestrator.initialized', { agents: this.agents.size }, 'AIOrchestrator')
  }

  registerAgent(agent: AIAgent): void {
    this.agents.register(agent)
    void this.events.emit('agent.registered', { agentId: agent.definition.id }, 'AIOrchestrator')
  }

  unregisterAgent(agentId: string): void {
    this.agents.unregister(agentId)
    void this.events.emit('agent.unregistered', { agentId }, 'AIOrchestrator')
  }

  getAgent(agentId: string): AIAgent | undefined {
    return this.agents.get(agentId)
  }

  // Resuelve qué agentes responden a un evento y en qué orden (por
  // dependsOn) — routing puro, sin efectos secundarios. Ejecutarlos es
  // responsabilidad de execute().
  dispatch(event: AgentEvent): AIAgent[] {
    const candidates = this.agents.findByTrigger(event.type)
    if (candidates.length === 0) return []

    const ordered = resolveExecutionOrder(candidates.map((agent) => agent.definition))
    return ordered
      .map((definition) => this.agents.get(definition.id))
      .filter((agent): agent is AIAgent => agent !== undefined)
  }

  // Genérico sobre TOutput: el registro guarda agentes heterogéneos
  // (AIAgent<unknown>), así que quien llama por id es quien conoce qué
  // agente pidió y por tanto qué forma de salida esperar — mismo patrón
  // que un contenedor de DI tipado con .get<T>(token).
  async execute<TOutput = unknown>(
    agentId: string,
    request: AIRequest,
    context?: AIContext
  ): Promise<AgentResult<TOutput>> {
    const startedAt = Date.now()
    const agent = this.agents.get(agentId)

    if (!agent) {
      return {
        agentId,
        requestId: request.id,
        status: 'error',
        error: { message: `No hay ningún agente registrado con id "${agentId}"`, code: 'AI_NOT_FOUND' },
        startedAt,
        finishedAt: Date.now(),
      }
    }

    // Resolución de proveedor: el agente declara defaultProviderId, el
    // Orchestrator lo busca en ProviderRegistry y le entrega la instancia ya
    // resuelta a run() — el agente nunca toca el registro directamente.
    const provider =
      this.providers.get(agent.definition.defaultProviderId) ??
      (agent.definition.fallbackProviderId ? this.providers.get(agent.definition.fallbackProviderId) : undefined)

    if (!provider) {
      return {
        agentId,
        requestId: request.id,
        status: 'error',
        error: {
          message: `No hay ningún proveedor registrado con id "${agent.definition.defaultProviderId}"`,
          code: 'AI_PROVIDER_NOT_FOUND',
        },
        startedAt,
        finishedAt: Date.now(),
      }
    }

    if (!this.concurrency.tryAcquire(request.userId)) {
      return {
        agentId,
        requestId: request.id,
        status: 'error',
        error: { message: 'Límite de ejecuciones concurrentes alcanzado', code: 'AI_CONCURRENCY_LIMIT' },
        startedAt,
        finishedAt: Date.now(),
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.defaultTimeoutMs)

    await this.events.emit('agent.execution.started', { agentId, requestId: request.id }, 'AIOrchestrator')

    try {
      // Sprint 9: el contexto se construye desde los scopes que el AGENTE
      // declara, no con un `scopes: []` fijo (que hacía que ContextEngine
      // fuera irrelevante). Un `context` explícito sigue teniendo
      // prioridad: es la costura por la que los tests inyectan contexto sin
      // tocar la base. Ojo — un llamador que pase un contexto mínimo a mano
      // se salta la carga real; por eso los Route Handlers dejaron de
      // pasarlo (ver app/api/ai/homework/route.ts).
      const resolvedContext =
        context ?? (await this.context.build({ userId: request.userId, scopes: agent.definition.contextScopes ?? [] }))
      const result = (await agent.run(
        { ...request, signal: controller.signal },
        resolvedContext,
        provider
      )) as AgentResult<TOutput>

      await this.events.emit(
        'agent.execution.completed',
        { agentId, requestId: request.id, status: result.status },
        'AIOrchestrator'
      )
      return result
    } catch (error) {
      const timedOut = controller.signal.aborted
      // Si el agente lanzó un error tipado propio (AIValidationError, etc.),
      // se conserva su código específico en vez de aplanarlo a uno genérico
      // — quien consuma el AgentResult necesita poder distinguir "entrada
      // inválida" de "el agente falló de forma inesperada".
      const code = timedOut ? 'AI_TIMEOUT' : error instanceof AIError ? error.code : 'AI_AGENT_ERROR'
      const result: AgentResult<TOutput> = {
        agentId,
        requestId: request.id,
        status: timedOut ? 'timeout' : 'error',
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido durante la ejecución del agente',
          code,
        },
        startedAt,
        finishedAt: Date.now(),
      }
      await this.events.emit(
        'agent.execution.failed',
        { agentId, requestId: request.id, error: result.error },
        'AIOrchestrator'
      )
      return result
    } finally {
      clearTimeout(timeout)
      this.concurrency.release(request.userId)
    }
  }

  health(): AIHealthStatus {
    // this.config.activeProviderId era el único indicador de proveedor en
    // Sprint 0 (cuando no existía ninguno registrado). Ahora que cada
    // agente resuelve el suyo vía ProviderRegistry, reportar la config en
    // vez del registro real haría que health() dijera "provider: null"
    // aunque Gemini ya esté registrado — se prioriza el registro real, y
    // se cae a la config solo si todavía no hay ningún proveedor.
    const provider = this.providers.list()[0]?.id ?? this.config.activeProviderId
    return {
      status: 'ok',
      version: ORCHESTRATOR_VERSION,
      provider,
      agents: this.agents.size,
      initialized: this.initialized,
      timestamp: Date.now(),
      contexto: { scopes: this.context.scopesDisponibles() },
      memoria: { conectada: this.memory !== undefined },
    }
  }
}
