import type { AIProviderId } from './common'
import type { AIRequest } from './request'
import type { AIResponse } from './response'

export type AIProviderCapabilities = {
  supportsVision: boolean
  supportsStructuredOutput: boolean
  supportsStreaming: boolean
  supportsBatch: boolean
  supportsPromptCaching: boolean
}

// Sin implementaciones concretas todavía (Claude/OpenAI/Gemini/...) — ver
// docs/ai-architecture/06-modelos-hibridos.md. Esta interfaz es el único
// contrato que el resto del sistema conoce.
export interface AIProvider {
  readonly id: AIProviderId
  readonly capabilities: AIProviderCapabilities
  send(request: AIRequest): Promise<AIResponse>
}
