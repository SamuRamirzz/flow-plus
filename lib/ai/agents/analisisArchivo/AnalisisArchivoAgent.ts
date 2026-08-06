import type { AIAgent, AIAgentDefinition, AIContext, AIProvider, AIRequest, AgentResult } from '@/lib/ai/types'
import { AIValidationError } from '@/lib/ai/errors'
import { aiConfig } from '@/lib/ai/config'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import { GEMINI_PROVIDER_ID, normalizarAdjuntos, type StructuredProviderMetadata } from '@/lib/ai/providers/gemini'
import { ANALISIS_ARCHIVO_OUTPUT_SCHEMA, AnalisisArchivoOutputParser } from './schema'
import { ANALISIS_ARCHIVO_AGENT_ID, ANALISIS_ARCHIVO_AGENT_TRIGGER_EVENT, type AnalisisArchivoAgentOutput } from './types'

// Sprint Archivos / Fase 7 — analiza un archivo YA SUBIDO a Archivos/Drive
// (PDF, imagen o texto) y devuelve resumen + tipo de documento + tareas
// detectadas.
//
// Es distinto de HomeworkAgent aunque compartan la forma de `tareas`:
// HomeworkAgent responde a un MENSAJE del usuario en una conversación (tiene
// tipoRespuesta conversacional/ambiguo, decide si el texto era siquiera un
// intento de describir tareas); este corre sobre un DOCUMENTO, sin usuario
// esperando del otro lado, y además tiene que producir un resumen que
// HomeworkAgent no produce. Mismo criterio de "un agente, una
// responsabilidad" que ya separó ExamAgent de TaskManagementAgent.
const definition: AIAgentDefinition = {
  id: ANALISIS_ARCHIVO_AGENT_ID,
  triggerEvents: [ANALISIS_ARCHIVO_AGENT_TRIGGER_EVENT],
  defaultProviderId: GEMINI_PROVIDER_ID,
  // Visión: la mayoría de los archivos reales serán PDFs y fotos.
  defaultModel: aiConfig.modeloVision,
  outputSchema: ANALISIS_ARCHIVO_OUTPUT_SCHEMA,
  // `identity` para que las materias detectadas usen los nombres EXACTOS que
  // el usuario ya tiene (mismo motivo que HomeworkAgent: no proponer
  // "Matematicas" cuando el usuario ya tiene "MATEMÁTICAS"). `schedule` para
  // la fecha de referencia en su zona horaria, necesaria para resolver
  // "entregar el viernes" dentro de un documento.
  contextScopes: ['schedule', 'identity'],
  // No escribe nada por su cuenta: el resumen y las tareas detectadas se
  // guardan como metadata del archivo, y convertir una tarea detectada en una
  // tarea REAL sigue siendo una acción explícita del usuario desde la UI.
  autonomyLevel: 'suggested_confirmation_required',
  executionQueue: 'interactive',
}

const parser = new AnalisisArchivoOutputParser()

function fechaDeReferencia(context: AIContext): string {
  const hoy = (context.schedule as { hoy?: unknown } | undefined)?.hoy
  return typeof hoy === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(hoy) ? hoy : hoyEnZona(new Date(), ZONA_HORARIA_POR_DEFECTO)
}

function materiasConocidas(context: AIContext): string[] {
  const nombres = (context.identity as { nombresDeMateria?: unknown } | undefined)?.nombresDeMateria
  return Array.isArray(nombres) ? nombres.filter((n): n is string => typeof n === 'string') : []
}

function construirInstruccionSistema(fechaISO: string, materias: string[], nombreArchivo: string): string {
  return [
    'Eres el analizador de documentos de Flow+, una app de agenda académica para estudiantes.',
    `Se te da un archivo que el estudiante guardó en su biblioteca. El nombre del archivo es "${nombreArchivo}".`,
    `La fecha de hoy es ${fechaISO}. Úsala para resolver cualquier fecha relativa que aparezca en el documento ("el viernes", "en dos semanas").`,
    'Tu trabajo tiene tres partes, todas sobre el CONTENIDO REAL del documento:',
    '1. "resumen": 2-3 frases en español, en tercera persona, que describan qué es este documento y de qué trata. Nada de consejos, opiniones ni relleno.',
    '2. "tipoDocumento": clasifícalo en una de las categorías dadas.',
    '3. "tareas": SOLO las tareas académicas concretas que el documento le asigna al estudiante (una entrega, ejercicios a resolver, una lectura obligatoria, la fecha de un examen). Si el documento es meramente informativo (apuntes, material de lectura sin consigna), devuelve un arreglo VACÍO — es la respuesta correcta, no un fallo.',
    'Nunca inventes contenido que no esté en el documento. Si algo no se lee o no está, deja el campo vacío en vez de suponerlo.',
    ...(materias.length > 0
      ? [
          `El estudiante YA tiene registradas estas materias: ${materias.join(', ')}.`,
          'Si la materia de una tarea detectada es una de esas, escríbela EXACTAMENTE con ese nombre (mismas tildes y mayúsculas) para no crear duplicados.',
        ]
      : []),
    'Responde únicamente con el JSON solicitado.',
  ].join('\n')
}

class AnalisisArchivoAgentImpl implements AIAgent<AnalisisArchivoAgentOutput> {
  readonly definition = definition

  async run(request: AIRequest, context: AIContext, provider: AIProvider): Promise<AgentResult<AnalisisArchivoAgentOutput>> {
    const startedAt = Date.now()
    const adjuntos = normalizarAdjuntos(request.metadata)
    // Para archivos de texto plano el contenido viaja como `input` (no tiene
    // sentido mandar un .txt como "documento" binario); para PDF/imagen
    // viaja como adjunto. Uno de los dos SIEMPRE tiene que estar.
    const textoPlano = typeof request.input === 'string' ? request.input.trim() : ''

    if (adjuntos.length === 0 && !textoPlano) {
      throw new AIValidationError('AnalisisArchivoAgent requiere el contenido del archivo (texto en input, o binario en metadata.adjuntos)')
    }
    // Mismo chequeo que ClassScheduleAgent/TaskManagementAgent: un agente que
    // manda binarios comprueba que el proveedor los soporta, no lo asume.
    if (adjuntos.length > 0 && !provider.capabilities.supportsVision) {
      throw new AIValidationError(`El proveedor "${provider.id}" no soporta imágenes ni documentos`)
    }

    const nombreArchivo = typeof request.metadata?.nombreArchivo === 'string' ? request.metadata.nombreArchivo : 'documento'

    const metadata: StructuredProviderMetadata = {
      systemInstruction: construirInstruccionSistema(fechaDeReferencia(context), materiasConocidas(context), nombreArchivo),
      outputSchema: ANALISIS_ARCHIVO_OUTPUT_SCHEMA,
      ...(adjuntos.length > 0 ? { adjuntos, model: aiConfig.modeloVision } : {}),
    }

    const response = await provider.send({
      ...request,
      input: textoPlano || 'Analiza el documento adjunto.',
      metadata: { ...request.metadata, ...metadata },
    })

    // El parser nunca devuelve ok:false (ver schema.ts) — un análisis mal
    // formado degrada a "sin resumen, sin tareas", jamás lanza.
    const parsed = parser.parse(response.content)
    const output = parsed.ok ? parsed.data : { resumen: null, tipoDocumento: 'otro' as const, tareas: [] }

    return {
      agentId: definition.id,
      requestId: request.id,
      status: 'success',
      output,
      // Honesta, calculada, no auto-declarada por el modelo: cuánto pudo
      // extraer de verdad. Mismo criterio que ExamAgent (encontrados/total).
      confidence: output.resumen ? (output.tareas.length > 0 ? 1 : 0.6) : 0,
      startedAt,
      finishedAt: Date.now(),
    }
  }
}

export const analisisArchivoAgent: AIAgent<AnalisisArchivoAgentOutput> = new AnalisisArchivoAgentImpl()
