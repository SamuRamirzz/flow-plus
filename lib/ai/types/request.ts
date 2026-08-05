export type AIRequest = {
  id: string
  agentId: string
  userId: string
  input: unknown
  signal?: AbortSignal
  metadata?: Record<string, unknown>
}
