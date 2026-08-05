import type { AIAgent, AIAgentDefinition, AIContext, AIProvider, AIRequest, AgentResult } from '@/lib/ai/types'
import { GEMINI_PROVIDER_ID, type StructuredProviderMetadata } from '@/lib/ai/providers/gemini'
import { EXAM_OUTPUT_SCHEMA, ExamOutputParser } from './schema'
import { CAMPOS_EXAMEN_VACIOS, EXAM_AGENT_ID, EXAM_AGENT_TRIGGER_EVENT, type CamposExamen } from './types'

// ── DECISIÓN DE DISEÑO (la que el encargo pidió evaluar y documentar) ──
//
// Pregunta: ¿agente separado que se dispara cuando el texto describe un
// examen, o extensión del flujo existente que detecta tipo:'examen'?
//
// Ninguna de las dos en su forma pura. Es un agente separado, pero de
// ENRIQUECIMIENTO: no compite con TaskManagementAgent por interpretar el
// texto del usuario, corre DESPUÉS y solo cuando aquel ya decidió que la
// tarea es de tipo 'examen'. Nunca decide qué operación hacer, ni sobre qué
// tarea; solo agrega tres campos.
//
// Por qué no extender el schema de TaskManagementAgent (la opción que a
// primera vista parecía más simple): ese schema documenta una falla REAL
// contra Gemini 3.5 Flash-Lite con ~16 propiedades mayormente opcionales —
// respuesta degenerada, la misma operación repetida ~100 veces. Hoy tiene 12
// propiedades por operación; sumarle temario/formato/peso lo deja en 15, a un
// paso de ese número. No vale la pena arriesgar un schema frágil que funciona
// para ahorrar una llamada que solo ocurre cuando hay un examen.
//
// Por qué no es un "sistema paralelo" de los que el encargo pide evitar (el
// caso TaskManagementAgent-sin-contextScopes): un sistema paralelo es dos
// caminos que resuelven LO MISMO y pueden divergir. Acá hay un solo camino de
// detección (TaskManagementAgent decide el tipo) y un paso aditivo detrás. Si
// ExamAgent falla o no está disponible, la tarea se crea igual, sin los tres
// campos — degradación limpia, nada que desincronizar. Y los campos viven en
// `tareas`, no en una tabla aparte, así que colisiones (Sprint 10),
// recordatorios (Sprint 11) y Deshacer (7.2) siguen funcionando sin cambios.
const definition: AIAgentDefinition = {
  id: EXAM_AGENT_ID,
  triggerEvents: [EXAM_AGENT_TRIGGER_EVENT],
  defaultProviderId: GEMINI_PROVIDER_ID,
  // El modelo más barato: extraer tres campos de un texto que ya se sabe que
  // habla de un examen es la tarea más acotada de todo el catálogo.
  defaultModel: 'gemini-3.5-flash-lite',
  outputSchema: EXAM_OUTPUT_SCHEMA,
  // Sin scopes: no necesita fecha de referencia (no resuelve fechas) ni las
  // materias del usuario (no propone materias). Pedir contexto que no usa
  // sería latencia y consultas de más.
  contextScopes: [],
  autonomyLevel: 'autonomous',
  executionQueue: 'interactive',
}

const parser = new ExamOutputParser()

function construirInstruccionSistema(): string {
  return [
    'Eres un extractor de datos de exámenes para Flow+, una app de agenda académica.',
    'Ya se determinó que el texto del usuario describe un EXAMEN. Tu única tarea es extraer tres datos si están presentes.',
    '- temario: qué contenido entra en el examen, en las palabras del usuario.',
    '- formato: oral, escrito, proyecto o mixto, solo si el texto lo indica.',
    '- peso: qué porcentaje de la nota final vale, de 1 a 100.',
    'NO inventes nada. Es normal y esperado que el texto mencione solo uno de los tres, o ninguno.',
    'Si un dato no está en el texto, deja cadena vacía (o 0 para peso). Un campo vacío es una respuesta correcta; un dato inventado es un error.',
    'Responde únicamente con el JSON solicitado.',
  ].join('\n')
}

class ExamAgentImpl implements AIAgent<CamposExamen> {
  readonly definition = definition

  async run(request: AIRequest, _context: AIContext, provider: AIProvider): Promise<AgentResult<CamposExamen>> {
    const startedAt = Date.now()
    const text = typeof request.input === 'string' ? request.input.trim() : ''

    // A diferencia de HomeworkAgent (que LANZA con texto vacío), acá un texto
    // vacío devuelve los tres campos en null con status 'success'. El motivo
    // es la naturaleza aditiva de este agente: no hay nada que el llamador
    // pueda hacer con un error, y hacerle manejar una excepción por un
    // enriquecimiento opcional lo obligaría a envolver cada llamada en un
    // try/catch para ignorar el resultado. "No encontré nada" ES el éxito.
    if (!text) {
      return {
        agentId: definition.id,
        requestId: request.id,
        status: 'success',
        output: CAMPOS_EXAMEN_VACIOS,
        confidence: 0,
        startedAt,
        finishedAt: Date.now(),
      }
    }

    const metadata: StructuredProviderMetadata = {
      systemInstruction: construirInstruccionSistema(),
      outputSchema: EXAM_OUTPUT_SCHEMA,
      model: definition.defaultModel,
    }

    const response = await provider.send({ ...request, metadata: { ...request.metadata, ...metadata } })
    // El parser nunca devuelve ok:false (ver schema.ts), así que no hay rama
    // de error que manejar — a propósito.
    const parsed = parser.parse(response.content)
    const campos = parsed.ok ? parsed.data : CAMPOS_EXAMEN_VACIOS

    // La confianza es la proporción de campos que se pudieron extraer, no una
    // autoevaluación del modelo: acá "confianza" solo se usa para decidir si
    // vale la pena mostrar/guardar el enriquecimiento, y cuántos de los tres
    // campos vinieron con contenido real es una señal mucho más honesta que
    // pedirle al modelo que se puntúe a sí mismo.
    const encontrados = [campos.temario, campos.formato, campos.peso].filter((v) => v !== null).length

    return {
      agentId: definition.id,
      requestId: request.id,
      status: 'success',
      output: campos,
      confidence: encontrados / 3,
      startedAt,
      finishedAt: Date.now(),
    }
  }
}

export const examAgent: AIAgent<CamposExamen> = new ExamAgentImpl()
