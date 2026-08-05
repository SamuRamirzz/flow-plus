import type { AIAgent, AIAgentDefinition, AIContext, AIProvider, AIRequest, AgentResult } from '@/lib/ai/types'
import { AIValidationError } from '@/lib/ai/errors'
import { aiConfig } from '@/lib/ai/config'
import { GEMINI_PROVIDER_ID, type StructuredProviderMetadata } from '@/lib/ai/providers/gemini'
import { ICONOS_VALIDOS } from '@/lib/materias/asignarIcono'
import { ICONO_MATERIA_OUTPUT_SCHEMA, IconoMateriaOutputParser } from './schema'
import { ICONO_MATERIA_AGENT_ID, ICONO_MATERIA_AGENT_TRIGGER_EVENT, type IconoMateriaAgentOutput } from './types'

const definition: AIAgentDefinition = {
  id: ICONO_MATERIA_AGENT_ID,
  triggerEvents: [ICONO_MATERIA_AGENT_TRIGGER_EVENT],
  defaultProviderId: GEMINI_PROVIDER_ID,
  // El modelo más barato ya configurado en el proyecto (aiConfig.modeloLigero)
  // — que hoy resulta ser el MISMO id que usan HomeworkAgent/TaskManagementAgent
  // como su propio modelo por defecto (ambos ya usan el ligero, no hay uno
  // más barato configurado todavía). No se introduce un modelo nuevo solo
  // para este agente: sería una config paralela sin otro beneficio real.
  defaultModel: aiConfig.modeloLigero,
  outputSchema: ICONO_MATERIA_OUTPUT_SCHEMA,
  // Respaldo puramente cosmético: se aplica solo, sin revisión del usuario
  // (a diferencia de los agentes que tocan tareas reales) — pero es
  // trivialmente reversible (el ícono se puede corregir después), así que
  // no necesita 'suggested_confirmation_required'.
  autonomyLevel: 'autonomous_reversible',
  executionQueue: 'interactive',
}

const parser = new IconoMateriaOutputParser()

function construirInstruccionSistema(): string {
  return [
    'Tu única función es elegir el ícono de lucide-react que mejor representa una materia académica, a partir de su nombre.',
    `Elige EXACTAMENTE uno de esta lista cerrada, nunca inventes otro: ${ICONOS_VALIDOS.join(', ')}.`,
    'Si el nombre no calza claramente con ninguno, usa "GraduationCap" — es el respaldo neutro, mejor eso que una elección forzada y rara.',
    'Responde únicamente con el JSON solicitado.',
  ].join('\n')
}

// Respaldo del mapeo determinístico (lib/materias/asignarIcono.ts) — solo
// se llama cuando ese mapeo no reconoció el nombre. A propósito NO recibe
// contexto (sin contextScopes): no necesita saber nada del usuario, solo el
// nombre de la materia, que llega como request.input.
class IconoMateriaAgentImpl implements AIAgent<IconoMateriaAgentOutput> {
  readonly definition = definition

  async run(request: AIRequest, _context: AIContext, provider: AIProvider): Promise<AgentResult<IconoMateriaAgentOutput>> {
    const startedAt = Date.now()
    const nombreMateria = typeof request.input === 'string' ? request.input.trim() : ''

    if (!nombreMateria) {
      throw new AIValidationError('IconoMateriaAgent requiere un nombre de materia no vacío en request.input')
    }

    const metadata: StructuredProviderMetadata = {
      systemInstruction: construirInstruccionSistema(),
      outputSchema: ICONO_MATERIA_OUTPUT_SCHEMA,
    }

    const response = await provider.send({ ...request, metadata: { ...request.metadata, ...metadata } })
    // El parser (schema.ts) nunca devuelve ok:false a propósito — este
    // agente jamás debe poder tumbar la creación de una materia por un
    // ícono mal formado, siempre resuelve a algo válido.
    const parsed = parser.parse(response.content)

    return {
      agentId: definition.id,
      requestId: request.id,
      status: 'success',
      output: { nombreMateria, icono: parsed.ok ? parsed.data.icono : 'GraduationCap' },
      startedAt,
      finishedAt: Date.now(),
    }
  }
}

export const iconoMateriaAgent: AIAgent<IconoMateriaAgentOutput> = new IconoMateriaAgentImpl()
