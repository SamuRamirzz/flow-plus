import type { ExecutionQueue } from './common'
import type { AIAgentDefinition } from './agent'
import type { AgentEvent } from './event'

export interface SchedulingPolicy {
  decide(agent: AIAgentDefinition, event: AgentEvent): ExecutionQueue
}
