import type { AIAgent, AIAgentDefinition, AIContext, AIProvider, AIRequest, AgentResult } from '@/lib/ai/types'
import { AIValidationError } from '@/lib/ai/errors'
import { aiConfig } from '@/lib/ai/config'
import { GEMINI_PROVIDER_ID, type StructuredProviderMetadata } from '@/lib/ai/providers/gemini'
import { RESUMEN_CONVERSACION_AGENT_ID, RESUMEN_CONVERSACION_AGENT_TRIGGER_EVENT, type ResumenConversacionAgentOutput } from './types'

// Sprint Archivos / Fase 5.1 — primer agente del proyecto que llama a
// provider.send() SIN outputSchema: un resumen es prosa libre, forzarlo a
// JSON estructurado sería una vuelta innecesaria. `GeminiProvider`/
// `construirInput` ya soportan este camino sin ningún cambio (confirmado
// leyendo su código antes de escribir esto): sin metadata.outputSchema,
// `response.content` es directamente el texto plano que devolvió el modelo.
const definition: AIAgentDefinition = {
  id: RESUMEN_CONVERSACION_AGENT_ID,
  triggerEvents: [RESUMEN_CONVERSACION_AGENT_TRIGGER_EVENT],
  defaultProviderId: GEMINI_PROVIDER_ID,
  defaultModel: aiConfig.modeloLigero,
  contextScopes: [],
  // Cosmético y reversible, mismo criterio que IconoMateriaAgent: si el
  // resumen sale mal o falta, `conversaciones_ia.resumen` queda `null` — la
  // UI cae a las primeras palabras del primer mensaje, nunca se pierde nada
  // real (el contenido de la conversación no depende de este agente).
  autonomyLevel: 'autonomous',
  executionQueue: 'interactive',
}

const LIMITE_CARACTERES_RESUMEN = 500

function construirInstruccionSistema(): string {
  return [
    'Tu única función es resumir una conversación entre un estudiante y el asistente de Flow+ (una app de agenda académica).',
    'Responde en español, en 1-2 frases breves, en tercera persona ("El usuario preguntó por...", "Se crearon tareas de...") — nunca en primera persona, nunca con saludos ni relleno.',
    'Responde ÚNICAMENTE con el texto del resumen, sin comillas ni formato adicional (nada de markdown, nada de JSON).',
  ].join('\n')
}

class ResumenConversacionAgentImpl implements AIAgent<ResumenConversacionAgentOutput> {
  readonly definition = definition

  async run(request: AIRequest, _context: AIContext, provider: AIProvider): Promise<AgentResult<ResumenConversacionAgentOutput>> {
    const startedAt = Date.now()
    const texto = typeof request.input === 'string' ? request.input.trim() : ''

    if (!texto) {
      throw new AIValidationError('ResumenConversacionAgent requiere el texto de la conversación en request.input')
    }

    const metadata: StructuredProviderMetadata = { systemInstruction: construirInstruccionSistema() }
    const response = await provider.send({ ...request, metadata: { ...request.metadata, ...metadata } })

    const resumenCrudo = typeof response.content === 'string' ? response.content : ''
    // Defensivo, no solo un límite de tamaño: nunca lanza si el modelo
    // devolvió texto vacío o basura — el llamador (guardarConversacion)
    // trata cualquier fallo de este agente como "sin resumen", nunca como un
    // motivo para no guardar la conversación.
    const resumen = resumenCrudo.trim().slice(0, LIMITE_CARACTERES_RESUMEN)

    if (!resumen) {
      throw new AIValidationError('El modelo no devolvió un resumen utilizable')
    }

    return {
      agentId: definition.id,
      requestId: request.id,
      status: 'success',
      output: { resumen },
      startedAt,
      finishedAt: Date.now(),
    }
  }
}

export const resumenConversacionAgent: AIAgent<ResumenConversacionAgentOutput> = new ResumenConversacionAgentImpl()
