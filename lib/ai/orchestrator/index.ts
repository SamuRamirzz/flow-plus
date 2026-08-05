import { AIOrchestrator, type AIOrchestratorOptions } from './AIOrchestrator'
import { SupabaseMemoryStore } from '@/lib/ai/memory'

export { AIOrchestrator, ORCHESTRATOR_VERSION } from './AIOrchestrator'
export type { AIOrchestratorOptions } from './AIOrchestrator'
export { ConcurrencyGuard } from './ConcurrencyGuard'
export { resolveExecutionOrder } from './resolveExecutionOrder'

// Fábrica explícita (para tests o instancias con dependencias propias) +
// una instancia lista para usar desde Route Handlers/Server Actions. No es
// un Singleton clásico: nada impide crear otra con `new AIOrchestrator(...)`
// o `createAIOrchestrator({...})` con dependencias distintas.
export function createAIOrchestrator(options?: AIOrchestratorOptions): AIOrchestrator {
  return new AIOrchestrator(options)
}

// La instancia compartida recibe la memoria persistente del Sprint 9 por la
// costura que AIOrchestrator ya tenía (`options.memoryStore`) — no hizo
// falta tocar su lógica interna. Se construye aquí y no en bootstrapAI()
// porque `memory` es `readonly` en el orchestrator: es una dependencia, no
// un estado que se enchufe después.
export const aiOrchestrator = createAIOrchestrator({ memoryStore: new SupabaseMemoryStore() })
