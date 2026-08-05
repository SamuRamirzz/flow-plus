import type { AIAgent, AIAgentDefinition, AIContext, AIProvider, AIRequest, AgentResult } from '@/lib/ai/types'
import { aiConfig } from '@/lib/ai/config'
import { GEMINI_PROVIDER_ID, type StructuredProviderMetadata } from '@/lib/ai/providers/gemini'
import { CALENDAR_DEDUP_OUTPUT_SCHEMA, CalendarDedupOutputParser } from './dedupSchema'
import { CALENDAR_AGENT_ID, CALENDAR_AGENT_TRIGGER_EVENT, type MateriaParaComparar, type ResultadoDedup } from './types'

// Cierre de Fase 1 — la mitad con modelo que el Sprint 10 dejó pendiente a
// propósito ("Dedup semántico real... queda para un sprint futuro si hace
// falta"). Es la PRIMERA vez que CalendarAgent llama a un modelo: hasta
// ahora `esFechaPlausible`/`detectarColisiones` (validar.ts) son puras y
// CalendarAgent nunca se registró en el AgentRegistry (ver la desviación
// del Sprint 10 en ROADMAP.md). Con esto sí se registra — ver
// lib/ai/registerAgents.ts.
const definition: AIAgentDefinition = {
  id: CALENDAR_AGENT_ID,
  triggerEvents: [CALENDAR_AGENT_TRIGGER_EVENT],
  defaultProviderId: GEMINI_PROVIDER_ID,
  defaultModel: aiConfig.modeloLigero,
  outputSchema: CALENDAR_DEDUP_OUTPUT_SCHEMA,
  // Sin contextScopes: mismo criterio que IconoMateriaAgent — la lista de
  // materias existentes llega ya resuelta en request.input (quien llama,
  // resolverOCrearMateria, ya tiene que consultarla de todos modos para el
  // conteo de color), no hace falta que ContextEngine la resuelva de nuevo.
  contextScopes: [],
  // Nunca actúa solo — la sugerencia siempre pasa por decidirAutonomia y
  // SIEMPRE requiere que el usuario haga clic en "Fusionar" para que algo
  // cambie en la base. autonomyLevel describe la fusión (la ACCIÓN real que
  // este agente podría motivar), que si el usuario la confirma es
  // irreversible en el sentido de que borra la materia origen — de ahí
  // 'suggested_confirmation_required', no 'autonomous'.
  autonomyLevel: 'suggested_confirmation_required',
  executionQueue: 'interactive',
}

export type DedupInput = { nombreNuevo: string; existentes: MateriaParaComparar[] }

function esDedupInput(v: unknown): v is DedupInput {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as DedupInput).nombreNuevo === 'string' &&
    Array.isArray((v as DedupInput).existentes)
  )
}

function construirInstruccionSistema(existentes: MateriaParaComparar[]): string {
  return [
    'Comparas el nombre de una materia académica RECIÉN CREADA contra una lista de materias que el mismo estudiante ya tenía, para detectar si son la misma materia con un nombre distinto (ej. "Lab de Química" y "Laboratorio Química" son la misma; "Cálculo 2" y "Cálculo II" son la misma; "Física" y "Química" NO son la misma).',
    `Materias existentes: ${existentes.map((m) => `"${m.nombre}"`).join(', ')}.`,
    'Si el nombre nuevo probablemente es una de esas mismas materias con otro nombre, hayDuplicado=true y nombreExistente debe ser una copia EXACTA (mismas tildes y mayúsculas) del nombre de la lista. Si no hay ninguna coincidencia razonable, o tienes dudas genuinas, hayDuplicado=false.',
    'Ante la duda, prefiere hayDuplicado=false — sugerir una fusión incorrecta es peor que no sugerir nada. Dos materias del mismo campo pero distintas (ej. "Cálculo I" y "Cálculo II", "Física I" y "Física II") NO son duplicados: son materias distintas de una secuencia, nunca las marques como iguales aunque compartan casi todo el nombre.',
    'Responde únicamente con el JSON solicitado.',
  ].join('\n')
}

class CalendarAgentImpl implements AIAgent<ResultadoDedup> {
  readonly definition = definition

  async run(request: AIRequest, _context: AIContext, provider: AIProvider): Promise<AgentResult<ResultadoDedup>> {
    const startedAt = Date.now()
    const vacio: ResultadoDedup = { hayDuplicado: false, materiaExistente: null, confianza: 0 }

    // Nada contra qué comparar: no es un error, es el caso normal de la
    // primera materia de un usuario nuevo. Mismo criterio que ExamAgent con
    // texto vacío — success con el resultado neutro, sin llamar al modelo.
    if (!esDedupInput(request.input) || request.input.existentes.length === 0) {
      return { agentId: definition.id, requestId: request.id, status: 'success', output: vacio, confidence: 0, startedAt, finishedAt: Date.now() }
    }

    const { nombreNuevo, existentes } = request.input
    const metadata: StructuredProviderMetadata = {
      systemInstruction: construirInstruccionSistema(existentes),
      outputSchema: CALENDAR_DEDUP_OUTPUT_SCHEMA,
      model: definition.defaultModel,
    }

    const response = await provider.send({ ...request, input: nombreNuevo, metadata: { ...request.metadata, ...metadata } })
    const parser = new CalendarDedupOutputParser(existentes)
    // El parser nunca devuelve ok:false (ver dedupSchema.ts) — no hay rama
    // de error que manejar, a propósito: un dedup fallido es "no encontré
    // nada", nunca algo que deba tumbar la creación de la materia.
    const parsed = parser.parse(response.content)
    const resultado = parsed.ok ? parsed.data : vacio

    return {
      agentId: definition.id,
      requestId: request.id,
      status: 'success',
      output: resultado,
      confidence: resultado.confianza,
      startedAt,
      finishedAt: Date.now(),
    }
  }
}

export const calendarAgent: AIAgent<ResultadoDedup> = new CalendarAgentImpl()
