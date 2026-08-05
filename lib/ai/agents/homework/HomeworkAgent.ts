import type { AIAgent, AIAgentDefinition, AIContext, AIProvider, AIRequest, AgentResult } from '@/lib/ai/types'
import { AIValidationError } from '@/lib/ai/errors'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import { GEMINI_PROVIDER_ID, type StructuredProviderMetadata } from '@/lib/ai/providers/gemini'
import { HOMEWORK_OUTPUT_SCHEMA, HomeworkOutputParser } from './schema'
import { HOMEWORK_AGENT_ID, HOMEWORK_AGENT_TRIGGER_EVENT, type HomeworkAgentOutput } from './types'

const definition: AIAgentDefinition = {
  id: HOMEWORK_AGENT_ID,
  triggerEvents: [HOMEWORK_AGENT_TRIGGER_EVENT],
  defaultProviderId: GEMINI_PROVIDER_ID,
  defaultModel: 'gemini-3.5-flash-lite',
  outputSchema: HOMEWORK_OUTPUT_SCHEMA,
  // Sprint 9: `schedule` aporta la fecha de referencia ya resuelta en la
  // zona horaria del usuario; `identity`, las materias que ya existen.
  contextScopes: ['schedule', 'identity'],
  autonomyLevel: 'suggested_confirmation_required',
  executionQueue: 'interactive',
}

const parser = new HomeworkOutputParser()

// Lee la fecha de referencia y las materias del CONTEXTO (Sprint 9), no del
// reloj del proceso. Antes hacía `new Date()` aquí dentro, lo que además de
// no ser inyectable usaba el huso del servidor: cerca de medianoche eso
// desplaza un día la resolución de "el viernes". Ahora `context.schedule.hoy`
// llega ya calculado en la zona horaria del usuario (perfil_academico).
//
// Ambos campos son defensivos a propósito: si un llamador ejecuta el agente
// con un contexto mínimo (sin scopes), se cae al reloj del proceso en vez de
// romper — degradar es preferible a fallar, y queda registrado en el prompt
// que no había materias conocidas.
function fechaDeReferencia(context: AIContext): string {
  const hoy = (context.schedule as { hoy?: unknown } | undefined)?.hoy
  // Ajuste (post 7.5) Parte 1-bis — el fallback también calculaba la fecha
  // en UTC (mismo bug reproducido y corregido en TaskManagementAgent): sin
  // contexto, ahora cae a la zona por defecto en vez de UTC crudo.
  return typeof hoy === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(hoy) ? hoy : hoyEnZona(new Date(), ZONA_HORARIA_POR_DEFECTO)
}

function materiasConocidas(context: AIContext): string[] {
  const nombres = (context.identity as { nombresDeMateria?: unknown } | undefined)?.nombresDeMateria
  return Array.isArray(nombres) ? nombres.filter((n): n is string => typeof n === 'string') : []
}

function construirInstruccionSistema(fechaISO: string, materias: string[]): string {
  return [
    'Eres el motor de comprensión de Flow+, una app de agenda académica para estudiantes.',
    `La fecha de hoy es ${fechaISO}. Úsala para resolver cualquier fecha relativa mencionada ("el viernes", "mañana", "en dos semanas").`,
    'Primero decide tipoRespuesta, uno de tres valores exactos:',
    '- "tareas": el texto describe una o más tareas académicas identificables (pueden ser varias en un mismo mensaje).',
    '- "ambiguo": el texto es un intento de describir una tarea, pero no alcanza para extraer nada útil (demasiado vago o incompleto).',
    '- "conversacional": el texto NO es un intento de describir una tarea — es un saludo, una pregunta, o charla sin relación con tareas académicas.',
    'Si tipoRespuesta es "conversacional", escribe en "mensaje" una respuesta breve y natural (una o dos frases), aclarando que tu función principal es ayudar a registrar tareas académicas, sin sonar a error ni a fallo. En cualquier otro caso, "mensaje" debe ser cadena vacía.',
    'Si tipoRespuesta es "tareas", para cada tarea determina: título breve, materia (si se menciona o se infiere con confianza; si no, cadena vacía), fecha de entrega en formato YYYY-MM-DD (cadena vacía si no se menciona), prioridad, tipo y tu confianza de 0 a 1 en esa extracción específica. Si tipoRespuesta no es "tareas", "tareas" debe ser un arreglo vacío.',
    'No inventes fechas ni materias que no estén respaldadas por el texto — ante la duda, deja el campo vacío y baja la confianza.',
    ...(materias.length > 0
      ? [
          `El usuario YA tiene registradas estas materias: ${materias.join(', ')}.`,
          'Si la materia de una tarea es una de esas, escríbela EXACTAMENTE con ese nombre (mismas tildes y mayúsculas) para que no se cree una materia duplicada. Solo usa un nombre distinto si de verdad se trata de una materia que no está en esa lista.',
        ]
      : []),
    'Responde únicamente con el JSON solicitado.',
  ].join('\n')
}

// Primer agente conectado a un modelo real (Gemini 2.5 Flash-Lite, Sprint
// 2) — reemplaza el extractHomeworkMock() del Sprint 1. La comprensión
// semántica ahora es real; sigue sin OCR/imágenes/PDF (fuera de alcance de
// este sprint, ver docs/ai-architecture/07-ocr-y-comprension.md Parte 11).
class HomeworkAgentImpl implements AIAgent<HomeworkAgentOutput> {
  readonly definition = definition

  async run(request: AIRequest, context: AIContext, provider: AIProvider): Promise<AgentResult<HomeworkAgentOutput>> {
    const startedAt = Date.now()
    const text = typeof request.input === 'string' ? request.input.trim() : ''

    if (!text) {
      throw new AIValidationError('HomeworkAgent requiere un texto no vacío en request.input')
    }

    const metadata: StructuredProviderMetadata = {
      systemInstruction: construirInstruccionSistema(fechaDeReferencia(context), materiasConocidas(context)),
      outputSchema: HOMEWORK_OUTPUT_SCHEMA,
    }

    const response = await provider.send({ ...request, metadata: { ...request.metadata, ...metadata } })
    const parsed = parser.parse(response.content)

    if (!parsed.ok) {
      throw new AIValidationError(`Gemini devolvió una salida que no se pudo validar: ${parsed.error}`)
    }

    const output: HomeworkAgentOutput = {
      originalText: text,
      tipoRespuesta: parsed.data.tipoRespuesta,
      mensaje: parsed.data.mensaje,
      tareas: parsed.data.tareas,
    }
    const confidencePromedio =
      output.tareas.length > 0 ? output.tareas.reduce((sum, t) => sum + t.confidence, 0) / output.tareas.length : 0

    return {
      agentId: definition.id,
      requestId: request.id,
      status: 'success',
      output,
      confidence: confidencePromedio,
      startedAt,
      finishedAt: Date.now(),
    }
  }
}

export const homeworkAgent: AIAgent<HomeworkAgentOutput> = new HomeworkAgentImpl()
