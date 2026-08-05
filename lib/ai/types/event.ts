// Eventos internos del propio Orchestrator/EventBus — para observabilidad
// (logs, métricas, hooks). No son lo mismo que los eventos de dominio que
// disparan agentes (ver AgentEvent más abajo).
export type AISystemEventType =
  | 'orchestrator.initialized'
  | 'agent.registered'
  | 'agent.unregistered'
  | 'agent.execution.started'
  | 'agent.execution.completed'
  | 'agent.execution.failed'

export type AISystemEvent<TPayload = unknown> = {
  id: string
  type: AISystemEventType
  payload: TPayload
  emittedAt: number
  source?: string
}

export type AIEventListener<TPayload = unknown> = (
  event: AISystemEvent<TPayload>
) => void | Promise<void>

// Evento de dominio que puede disparar uno o más agentes
// (docs/ai-architecture/02-orchestrator.md §4.2.1 — ej. "photo.uploaded",
// "task.created"). El vocabulario concreto de `type` lo define cada agente
// al registrarse; el Orchestrator no conoce una lista cerrada, por eso es
// string abierto y no un union como AISystemEventType.
export type AgentEvent<TPayload = unknown> = {
  id: string
  type: string
  userId: string
  payload: TPayload
  occurredAt: number
}
