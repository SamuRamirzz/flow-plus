import type { AIAgent, AIAgentDefinition, AIContext, AIProvider, AIRequest, AgentResult } from '@/lib/ai/types'
import { AIValidationError } from '@/lib/ai/errors'
import { aiConfig } from '@/lib/ai/config'
import { GEMINI_PROVIDER_ID, normalizarAdjuntos, type StructuredProviderMetadata } from '@/lib/ai/providers/gemini'
import { CLASS_SCHEDULE_OUTPUT_SCHEMA, ClassScheduleOutputParser } from './schema'
import { CLASS_SCHEDULE_AGENT_ID, CLASS_SCHEDULE_AGENT_TRIGGER_EVENT, type ClassScheduleAgentOutput } from './types'

const definition: AIAgentDefinition = {
  id: CLASS_SCHEDULE_AGENT_ID,
  triggerEvents: [CLASS_SCHEDULE_AGENT_TRIGGER_EVENT],
  defaultProviderId: GEMINI_PROVIDER_ID,
  defaultModel: aiConfig.modeloVision,
  outputSchema: CLASS_SCHEDULE_OUTPUT_SCHEMA,
  // A diferencia de TaskManagementAgent (que aplica lo que propone en cuanto
  // el usuario confirma el lote), este agente NUNCA escribe: devuelve una
  // propuesta que cae en la grilla editable de /horario y el guardado real
  // lo hacen los endpoints del Sprint 7. Un horario mal leído de una foto
  // afecta la inferencia de fecha de TODAS las tareas futuras de esas
  // materias — el costo de un error silencioso es demasiado alto para
  // aplicarlo sin que una persona lo mire.
  autonomyLevel: 'suggested_confirmation_required',
  executionQueue: 'interactive',
}

const parser = new ClassScheduleOutputParser()

function construirInstruccionSistema(): string {
  return [
    'Eres el lector de horarios de Flow+, una app de agenda académica para estudiantes.',
    'Recibes UNA imagen: la foto o captura del horario de clases semanal de un estudiante (puede venir de una hoja impresa, una pizarra, o una captura de la plataforma de su universidad).',
    'Primero decide tipoRespuesta: "bloques" si puedes leer el horario; "no_es_horario" si la imagen claramente no es un horario de clases; "ilegible" si sí parece un horario pero no puedes leerlo con confianza (borroso, cortado, muy oscuro, en un ángulo imposible).',
    'Si NO es "bloques", escribe en "mensaje" una frase breve y amable en español explicando qué pasa, y deja "bloques" vacío.',
    'Si es "bloques": extrae UNA entrada por cada celda de clase. Si una materia aparece el lunes y el miércoles, son DOS entradas distintas, cada una con su día. Nunca repitas la misma entrada dos veces.',
    'Cada entrada lleva un campo "tipo": "clase" para una materia normal (el caso más común, casi siempre es este). Usa "ingreso"/"salida"/"descanso" SOLO si la imagen marca EXPLÍCITAMENTE una fila o celda con ese nombre literal (ej. "Ingreso 7:00", "Descanso", "Salida 15:00") — nunca los inventes para un hueco vacío entre dos clases, eso no es lo mismo que un bloque especial declarado. Un bloque especial siempre lleva materia como cadena vacía.',
    'diaSemana usa ISO-8601: 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado, 7=domingo. NUNCA uses 0 para domingo.',
    'Las horas van en formato HH:MM de 24 horas ("14:00", no "2 pm"). Si la imagen no indica una hora, deja el campo como cadena vacía en vez de inventarla.',
    'No inventes materias, aulas ni horas que no estén en la imagen. Si una celda está borrosa y dudas, extrae lo que sí puedas leer y baja el confidence de esa fila.',
    'Responde únicamente con el JSON solicitado.',
  ].join('\n')
}

// Primer agente de visión del proyecto (Sprint 8). Adelanta la Fase 3 del
// documento de arquitectura — desviación registrada en ROADMAP.md.
//
// No recibe el horario ya guardado ni calcula el diff: eso lo hace el Route
// Handler con lib/horario/diff.ts (puro). El agente hace UNA cosa —
// convertir una imagen en bloques estructurados— y así se puede probar sin
// base de datos, y el diff se puede probar sin red.
class ClassScheduleAgentImpl implements AIAgent<ClassScheduleAgentOutput> {
  readonly definition = definition

  async run(request: AIRequest, _context: AIContext, provider: AIProvider): Promise<AgentResult<ClassScheduleAgentOutput>> {
    const startedAt = Date.now()
    const adjuntos = normalizarAdjuntos(request.metadata)

    if (adjuntos.length === 0) {
      throw new AIValidationError('ClassScheduleAgent requiere una imagen en request.metadata.adjuntos')
    }
    // El contrato de AIProvider expone `capabilities` justamente para esto:
    // un agente que manda imágenes debe comprobar que el proveedor que le
    // tocó las soporta, en vez de asumirlo y fallar con un error opaco.
    if (!provider.capabilities.supportsVision) {
      throw new AIValidationError(`El proveedor "${provider.id}" no soporta imágenes`)
    }

    const metadata: StructuredProviderMetadata = {
      systemInstruction: construirInstruccionSistema(),
      outputSchema: CLASS_SCHEDULE_OUTPUT_SCHEMA,
      adjuntos,
      model: aiConfig.modeloVision,
    }

    const response = await provider.send({
      ...request,
      input: typeof request.input === 'string' && request.input.trim() ? request.input : 'Extrae todos los bloques de este horario de clases.',
      metadata: { ...request.metadata, ...metadata },
    })

    const parsed = parser.parse(response.content)
    if (!parsed.ok) {
      throw new AIValidationError(`Gemini devolvió una salida que no se pudo validar: ${parsed.error}`)
    }

    const output: ClassScheduleAgentOutput = {
      tipoRespuesta: parsed.data.tipoRespuesta,
      mensaje: parsed.data.mensaje,
      bloques: parsed.data.bloques,
    }

    const confidencePromedio =
      output.bloques.length > 0 ? output.bloques.reduce((sum, b) => sum + b.confidence, 0) / output.bloques.length : undefined

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

export const classScheduleAgent: AIAgent<ClassScheduleAgentOutput> = new ClassScheduleAgentImpl()
