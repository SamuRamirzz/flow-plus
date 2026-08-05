import type { AIEventListener, AISystemEvent, AISystemEventType } from '@/lib/ai/types'
import { createId } from '@/lib/ai/utils'

// Bus de eventos interno para que agentes/orchestrator se comuniquen sin
// acoplarse directamente entre sí (docs/ai-architecture/02-orchestrator.md).
// No es un singleton global: cada AIOrchestrator crea o recibe su propia
// instancia (ver lib/ai/orchestrator).
export class AIEventBus {
  private readonly listeners = new Map<AISystemEventType, Set<AIEventListener>>()

  on<TPayload>(type: AISystemEventType, listener: AIEventListener<TPayload>): () => void {
    const set = this.listeners.get(type) ?? new Set<AIEventListener>()
    set.add(listener as AIEventListener)
    this.listeners.set(type, set)
    return () => this.off(type, listener)
  }

  off<TPayload>(type: AISystemEventType, listener: AIEventListener<TPayload>): void {
    this.listeners.get(type)?.delete(listener as AIEventListener)
  }

  async emit<TPayload>(type: AISystemEventType, payload: TPayload, source?: string): Promise<void> {
    const set = this.listeners.get(type)
    if (!set || set.size === 0) return

    const event: AISystemEvent<TPayload> = {
      id: createId('evt'),
      type,
      payload,
      emittedAt: Date.now(),
      source,
    }
    await Promise.all(Array.from(set).map((listener) => listener(event)))
  }

  clear(type?: AISystemEventType): void {
    if (type) this.listeners.delete(type)
    else this.listeners.clear()
  }
}
