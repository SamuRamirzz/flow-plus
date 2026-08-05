import type { AIAgent } from '@/lib/ai/types'
import { AIConfigError } from '@/lib/ai/errors'

// Registro de agentes — reemplaza cualquier switch/if-else de "qué agente
// corresponde a este evento" (docs/ai-architecture/02-orchestrator.md
// §4.2.1). Un agente se añade con register() y queda indexado por sus
// triggerEvents; el Orchestrator nunca necesita conocer agentes concretos.
export class AgentRegistry {
  private readonly agents = new Map<string, AIAgent>()

  register(agent: AIAgent): void {
    const { id } = agent.definition
    if (this.agents.has(id)) {
      throw new AIConfigError(`El agente "${id}" ya está registrado`)
    }
    this.agents.set(id, agent)
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId)
  }

  get(agentId: string): AIAgent | undefined {
    return this.agents.get(agentId)
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId)
  }

  list(): AIAgent[] {
    return Array.from(this.agents.values())
  }

  findByTrigger(eventType: string): AIAgent[] {
    return this.list().filter((agent) => agent.definition.triggerEvents.includes(eventType))
  }

  get size(): number {
    return this.agents.size
  }
}
