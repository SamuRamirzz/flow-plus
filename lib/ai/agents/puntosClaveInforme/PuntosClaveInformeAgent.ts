import type { AIAgent, AIAgentDefinition, AIContext, AIProvider, AIRequest, AgentResult } from '@/lib/ai/types'
import { AIValidationError } from '@/lib/ai/errors'
import { aiConfig } from '@/lib/ai/config'
import { GEMINI_PROVIDER_ID, type StructuredProviderMetadata } from '@/lib/ai/providers/gemini'
import type { DatosSeccionIA } from '@/lib/informes/tipos'
import { validarPuntosClave } from '@/lib/informes/validarPuntosClave'
import { PUNTOS_CLAVE_INFORME_AGENT_ID, PUNTOS_CLAVE_INFORME_AGENT_TRIGGER_EVENT, type PuntosClaveInformeAgentOutput } from './types'

// Sprint 18a — La ÚNICA sección del informe que escribe la IA. Todo lo demás
// (números, tablas, gráficos) es determinístico.
//
// Sin `outputSchema`: son 2-4 frases de prosa, forzarlas a JSON no aporta
// nada. Mismo camino que ResumenConversacionAgent.
const definition: AIAgentDefinition = {
  id: PUNTOS_CLAVE_INFORME_AGENT_ID,
  triggerEvents: [PUNTOS_CLAVE_INFORME_AGENT_TRIGGER_EVENT],
  defaultProviderId: GEMINI_PROVIDER_ID,
  defaultModel: aiConfig.modeloLigero,
  // Vacío a propósito: TODO lo que el modelo puede ver llega por
  // `request.metadata.datos` (agregados ya calculados). Darle acceso a
  // ContextEngine sería darle datos que no necesita y que podría citar.
  contextScopes: [],
  // Reversible y acotado: si falla, el informe usa el fallback determinístico
  // y el usuario ni se entera. Mismo criterio que IconoMateriaAgent.
  autonomyLevel: 'autonomous',
  executionQueue: 'interactive',
}

const MAX_FRASES = 4
const LIMITE_CARACTERES = 600

function construirInstruccionSistema(): string {
  return [
    'Eres el redactor de la sección "Puntos clave" de un informe de rendimiento académico de Flow+.',
    'Recibes ÚNICAMENTE cifras ya calculadas. Tu tarea es interpretarlas en 2 a 4 frases breves, en español, dirigidas al estudiante ("completaste", "tu materia con mejor...").',
    'REGLA ABSOLUTA: no menciones NINGUNA cifra, fecha, año ni nombre de materia que no aparezca literalmente en los datos que se te proporcionan. Si quieres describir una tendencia, prefiere palabras ("mejoraste", "bajó un poco", "la mayoría") antes que inventar un número.',
    'Si los datos no alcanzan para un análisis con sentido, dilo brevemente y con honestidad en vez de rellenar con frases motivacionales vacías.',
    'No uses markdown, ni viñetas, ni comillas. Devuelve solo las frases, separadas por saltos de línea.',
  ].join('\n')
}

/** Los datos agregados en texto plano, que es lo único que ve el modelo. */
function describirDatos(d: DatosSeccionIA): string {
  const lineas: string[] = [
    `Periodo: ${d.periodo} (${d.etiquetaPeriodo}).`,
    `Tareas completadas: ${d.completadas.hechas} de ${d.completadas.total}${d.completadas.porcentaje !== null ? ` (${d.completadas.porcentaje} %)` : ''}.`,
  ]
  if (d.porcentajePuntualidad !== null) lineas.push(`Entregas a tiempo: ${d.porcentajePuntualidad} %.`)
  lineas.push(`Racha actual: ${d.rachaDias} días sin dejar vencer nada.`)

  if (d.deltaCompletadas !== null) {
    lineas.push(`Cambio en cumplimiento respecto al periodo anterior: ${d.deltaCompletadas} puntos porcentuales.`)
  } else {
    lineas.push('No hay periodo anterior con el que comparar.')
  }
  if (d.deltaPuntualidad !== null) {
    lineas.push(`Cambio en puntualidad respecto al periodo anterior: ${d.deltaPuntualidad} puntos porcentuales.`)
  }

  if (d.materias.length > 0) {
    lineas.push('Materias del periodo:')
    for (const m of d.materias) lineas.push(`- ${m.nombre}: ${m.completadas} completadas, ${m.pendientes} pendientes.`)
  } else {
    lineas.push('No hubo tareas asignadas a ninguna materia en el periodo.')
  }

  return lineas.join('\n')
}

function normalizarDatos(metadata: Record<string, unknown> | undefined): DatosSeccionIA | null {
  const d = metadata?.datos
  if (typeof d !== 'object' || d === null) return null
  const posible = d as DatosSeccionIA
  if (typeof posible.periodo !== 'string' || typeof posible.completadas !== 'object') return null
  return posible
}

class PuntosClaveInformeAgentImpl implements AIAgent<PuntosClaveInformeAgentOutput> {
  readonly definition = definition

  async run(request: AIRequest, _context: AIContext, provider: AIProvider): Promise<AgentResult<PuntosClaveInformeAgentOutput>> {
    const startedAt = Date.now()

    const datos = normalizarDatos(request.metadata)
    if (!datos) {
      throw new AIValidationError('PuntosClaveInformeAgent requiere los datos agregados en request.metadata.datos')
    }

    const metadata: StructuredProviderMetadata = { systemInstruction: construirInstruccionSistema() }
    const response = await provider.send({
      ...request,
      input: describirDatos(datos),
      metadata: { ...request.metadata, ...metadata },
    })

    const crudo = typeof response.content === 'string' ? response.content : ''
    const texto = crudo.trim().slice(0, LIMITE_CARACTERES)
    if (!texto) {
      throw new AIValidationError('El modelo no devolvió puntos clave utilizables')
    }

    // ⚠️ La red de seguridad. Se valida el texto COMPLETO antes de aceptar
    // nada: si cita una sola cifra que no se le dio, se descarta ENTERO (no
    // se intenta corregir la frase mala — un texto medio-corregido es un
    // texto que nadie revisó).
    const validacion = validarPuntosClave(texto, datos)
    if (!validacion.valido) {
      // Deja rastro: si esto pasa a menudo, el problema es el prompt, no la
      // validación (aprendizaje de auditorías previas — los fallos
      // silenciosos cuestan horas de investigación después).
      console.warn('[informes] puntos clave descartados por validación:', validacion.motivo)
      throw new AIValidationError(`Los puntos clave generados no respetan los datos: ${validacion.motivo}`)
    }

    const puntos = texto
      .split('\n')
      .map((l) => l.replace(/^[-•*]\s*/, '').trim())
      .filter((l) => l.length > 0)
      .slice(0, MAX_FRASES)

    if (puntos.length === 0) {
      throw new AIValidationError('El modelo no devolvió ninguna frase utilizable')
    }

    return {
      agentId: definition.id,
      requestId: request.id,
      status: 'success',
      output: { puntos },
      startedAt,
      finishedAt: Date.now(),
    }
  }
}

export const puntosClaveInformeAgent: AIAgent<PuntosClaveInformeAgentOutput> = new PuntosClaveInformeAgentImpl()
