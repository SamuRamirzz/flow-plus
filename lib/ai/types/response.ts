import type { AIProviderId, ModelId } from './common'

export type AIResponseUsage = {
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
}

export type AIResponse = {
  requestId: string
  providerId: AIProviderId
  model: ModelId
  content: unknown
  usage?: AIResponseUsage
  stopReason?: string
}
