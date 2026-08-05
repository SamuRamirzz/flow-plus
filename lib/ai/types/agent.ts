import type { AIProviderId, AutonomyLevel, ExecutionQueue, JSONSchema, ModelId } from './common'
import type { AIContext, AIContextScope } from './context'
import type { AIProvider } from './provider'
import type { AIRequest } from './request'

export type AgentRunStatus = 'success' | 'error' | 'timeout' | 'cancelled'

export type AgentResult<TOutput = unknown> = {
  agentId: string
  requestId: string
  status: AgentRunStatus
  output?: TOutput
  confidence?: number
  error?: { message: string; code?: string }
  startedAt: number
  finishedAt: number
}

// Contrato declarativo de registro (docs/ai-architecture/02-orchestrator.md
// §4.4) — lo que el Orchestrator lee para decidir a qué evento responde un
// agente, en qué orden respecto a otros, y con qué modelo/autonomía.
export type AIAgentDefinition = {
  id: string
  triggerEvents: string[]
  dependsOn?: string[]
  defaultProviderId: AIProviderId
  fallbackProviderId?: AIProviderId
  defaultModel: ModelId
  fallbackModel?: ModelId
  outputSchema?: JSONSchema
  // Scopes de contexto que este agente necesita (Sprint 9). Opcional y
  // aditivo: un agente que no lo declara sigue recibiendo el contexto
  // mínimo { userId, generatedAt }, exactamente como antes. El Orchestrator
  // se lo pide al ContextEngine en execute(); el agente nunca construye
  // contexto por su cuenta.
  contextScopes?: AIContextScope[]
  autonomyLevel: AutonomyLevel
  executionQueue: ExecutionQueue
  costBudget?: { maxInputTokens?: number; maxOutputTokens?: number }
}

// El Orchestrator resuelve el AIProvider (por defaultProviderId, ver
// AIOrchestrator.execute()) y se lo pasa ya resuelto al agente — el agente
// nunca conoce el ProviderRegistry completo, solo el proveedor que le toca.
export interface AIAgent<TOutput = unknown> {
  readonly definition: AIAgentDefinition
  run(request: AIRequest, context: AIContext, provider: AIProvider): Promise<AgentResult<TOutput>>
}
