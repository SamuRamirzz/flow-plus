import type { AIAgent, AIAgentDefinition, AIContext, AIProvider, AIRequest, AgentResult } from '@/lib/ai/types'
import { AIValidationError } from '@/lib/ai/errors'
import { aiConfig } from '@/lib/ai/config'
import { GEMINI_PROVIDER_ID, normalizarAdjuntos, type ConversationTurnInput, type StructuredProviderMetadata } from '@/lib/ai/providers/gemini'
import { PREGUNTA_ARCHIVO_AGENT_ID, PREGUNTA_ARCHIVO_AGENT_TRIGGER_EVENT, type PreguntaArchivoAgentOutput } from './types'

// Sprint Archivos / Fase 7 — responde una pregunta puntual del usuario
// SOBRE UN ARCHIVO concreto ("¿qué dice el punto 3?", "¿esto entra en el
// examen?").
//
// Vive en la misma carpeta que AnalisisArchivoAgent porque es el mismo
// dominio (IA sobre un archivo guardado), pero es un agente aparte: aquel
// produce metadata estructurada una sola vez al subir, este mantiene una
// conversación. Schema-free, como ResumenConversacionAgent: una respuesta a
// una pregunta es prosa, forzarla a JSON sería una vuelta innecesaria.
const definition: AIAgentDefinition = {
  id: PREGUNTA_ARCHIVO_AGENT_ID,
  triggerEvents: [PREGUNTA_ARCHIVO_AGENT_TRIGGER_EVENT],
  defaultProviderId: GEMINI_PROVIDER_ID,
  defaultModel: aiConfig.modeloVision,
  contextScopes: [],
  // Solo lee y responde: no crea, modifica ni borra nada del usuario.
  autonomyLevel: 'autonomous',
  executionQueue: 'interactive',
}

const LIMITE_CARACTERES_RESPUESTA = 2000

function construirInstruccionSistema(nombreArchivo: string): string {
  return [
    'Eres el asistente de Flow+, una app de agenda académica. El estudiante te está preguntando sobre UN archivo concreto de su biblioteca.',
    `El archivo se llama "${nombreArchivo}" y su contenido se te adjunta.`,
    'Responde en español, de forma breve y directa, basándote ÚNICAMENTE en el contenido del archivo.',
    'Si la respuesta no está en el archivo, dilo con naturalidad ("eso no aparece en este documento") en vez de inventarla o de responder con conocimiento general.',
    'Responde solo con el texto de la respuesta, sin formato markdown ni encabezados.',
  ].join('\n')
}

class PreguntaArchivoAgentImpl implements AIAgent<PreguntaArchivoAgentOutput> {
  readonly definition = definition

  async run(request: AIRequest, _context: AIContext, provider: AIProvider): Promise<AgentResult<PreguntaArchivoAgentOutput>> {
    const startedAt = Date.now()
    const adjuntos = normalizarAdjuntos(request.metadata)
    const pregunta = typeof request.input === 'string' ? request.input.trim() : ''

    if (!pregunta) throw new AIValidationError('PreguntaArchivoAgent requiere la pregunta del usuario en request.input')
    if (adjuntos.length > 0 && !provider.capabilities.supportsVision) {
      throw new AIValidationError(`El proveedor "${provider.id}" no soporta imágenes ni documentos`)
    }

    const nombreArchivo = typeof request.metadata?.nombreArchivo === 'string' ? request.metadata.nombreArchivo : 'documento'
    // Contenido textual del archivo, cuando es un .txt/.md (no viaja como
    // adjunto binario) — se antepone a la pregunta para que el modelo lo
    // tenga como contexto igual que tendría un PDF adjunto.
    const contenidoTexto = typeof request.metadata?.contenidoTexto === 'string' ? request.metadata.contenidoTexto : ''

    // Turnos previos de ESTA conversación sobre ESTE archivo, si los hay.
    const historial = Array.isArray(request.metadata?.historial) ? (request.metadata.historial as ConversationTurnInput[]) : []
    const turnoActual: ConversationTurnInput = {
      rol: 'usuario',
      texto: contenidoTexto ? `Contenido del archivo:\n${contenidoTexto}\n\nPregunta: ${pregunta}` : pregunta,
    }

    const metadata: StructuredProviderMetadata = {
      systemInstruction: construirInstruccionSistema(nombreArchivo),
      ...(adjuntos.length > 0 ? { adjuntos, model: aiConfig.modeloVision } : {}),
    }

    const response = await provider.send({
      ...request,
      input: historial.length > 0 ? [...historial, turnoActual] : turnoActual.texto,
      metadata: { ...request.metadata, ...metadata },
    })

    const respuesta = (typeof response.content === 'string' ? response.content : '').trim().slice(0, LIMITE_CARACTERES_RESPUESTA)
    if (!respuesta) throw new AIValidationError('El modelo no devolvió una respuesta utilizable')

    return {
      agentId: definition.id,
      requestId: request.id,
      status: 'success',
      output: { respuesta },
      startedAt,
      finishedAt: Date.now(),
    }
  }
}

export const preguntaArchivoAgent: AIAgent<PreguntaArchivoAgentOutput> = new PreguntaArchivoAgentImpl()
