import type { AIProviderId } from './common'

export type AIHealthStatusLevel = 'ok' | 'degraded' | 'error'

export type AIHealthStatus = {
  status: AIHealthStatusLevel
  version: number
  provider: AIProviderId | null
  agents: number
  initialized: boolean
  timestamp: number
  // Sprint 9. `contexto.scopes` son los que hoy tienen loader; pedir
  // cualquier otro lanza AINotImplementedError a propósito. `memoria` dice
  // si hay un MemoryStore inyectado — no si la tabla existe, que es otra
  // cosa (eso solo se sabe al primer read/write real).
  contexto: { scopes: string[] }
  memoria: { conectada: boolean }
}
