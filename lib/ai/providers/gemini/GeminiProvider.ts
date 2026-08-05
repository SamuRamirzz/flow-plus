import { GoogleGenAI, ApiError } from '@google/genai'
import type { AIProvider, AIProviderCapabilities, AIRequest, AIResponse } from '@/lib/ai/types'
import { AIProviderError } from '@/lib/ai/errors'
import { aiConfig } from '@/lib/ai/config'
import { construirInput, type StructuredProviderMetadata } from './construirInput'

export const GEMINI_PROVIDER_ID = 'gemini'

// La traducción del input (texto simple / conversación por turnos /
// adjuntos) vive en construirInput.ts — puro y con tests, sin red. Acá solo
// queda el I/O contra la API.
export type { ConversationTurnInput, AdjuntoIA, StructuredProviderMetadata } from './construirInput'

// Único AIProvider real del sistema por ahora (docs/ai-architecture/06-
// modelos-hibridos.md). Implementa AIProvider tal cual está definido en
// lib/ai/types/provider.ts — no se tocó esa interfaz.
export class GeminiProvider implements AIProvider {
  readonly id = GEMINI_PROVIDER_ID
  readonly capabilities: AIProviderCapabilities = {
    // Desde el Sprint 8 esto es VERDAD, no una promesa: send() traduce
    // metadata.adjuntos a bloques `image`/`document` reales (construirInput)
    // y se verificó con una llamada real que la imagen se lee y se combina
    // con response_format en la misma petición. Antes decía `true` sin nada
    // que lo respaldara.
    supportsVision: true,
    supportsStructuredOutput: true,
    supportsStreaming: false,
    supportsBatch: false,
    supportsPromptCaching: false,
  }

  private readonly client: GoogleGenAI | null

  constructor(apiKey: string | null) {
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null
  }

  async send(request: AIRequest): Promise<AIResponse> {
    if (!this.client) {
      throw new AIProviderError('GEMINI_API_KEY no está configurada — no se puede llamar a Gemini', this.id)
    }

    const metadata = (request.metadata ?? {}) as StructuredProviderMetadata
    const input = construirInput(request.input, metadata.adjuntos)
    // Sprint 8: el modelo deja de ser una constante de módulo. Antes, TODO
    // agente recibía el ligero sin importar lo que declarara, así que
    // `definition.defaultModel` era metadata muerta. Ahora el agente puede
    // pedir uno por llamada (metadata.model) y, si no, cae al de config.
    const model = metadata.model ?? aiConfig.modeloLigero

    try {
      const interaction = await this.client.interactions.create(
        {
          model,
          input,
          stream: false,
          ...(metadata.systemInstruction ? { system_instruction: metadata.systemInstruction } : {}),
          ...(metadata.outputSchema
            ? { response_format: { type: 'text', mime_type: 'application/json', schema: metadata.outputSchema } }
            : {}),
        },
        // GoogleGenAIRequestOptions no expone abortSignal directamente —
        // el cancelable real de esta SDK va dentro de fetchOptions, que
        // pasa a través a la llamada fetch() subyacente.
        request.signal ? { fetchOptions: { signal: request.signal } } : undefined
      )

      if (interaction.status !== 'completed' || !interaction.output_text) {
        throw new AIProviderError(
          `Gemini no completó la respuesta (estado "${interaction.status}", sin texto de salida — posible bloqueo de seguridad o entrada rechazada)`,
          this.id
        )
      }

      return {
        requestId: request.id,
        providerId: this.id,
        model,
        content: interaction.output_text,
      }
    } catch (error) {
      if (error instanceof AIProviderError) throw error
      if (error instanceof ApiError) {
        throw new AIProviderError(`Gemini respondió con error HTTP ${error.status}: ${error.message}`, this.id)
      }
      throw new AIProviderError(
        error instanceof Error ? `Gemini falló: ${error.message}` : 'Gemini falló con un error desconocido',
        this.id
      )
    }
  }
}
