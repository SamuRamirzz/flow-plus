import { aiOrchestrator } from '@/lib/ai/orchestrator'
import { bootstrapAI } from '@/lib/ai/bootstrap'
import { createId } from '@/lib/ai/utils'
import { EXAM_AGENT_ID, type CamposExamen } from '@/lib/ai/agents/exam'

export type CamposExamenExplicitos = {
  temario: string | null | undefined
  formato: string | null | undefined
  peso: number | null | undefined
}

// Cierre de Fase 1 (segunda auditoría) — ExamAgent existía desde el Sprint
// 12 pero nunca se llamaba desde ningún flujo real (hallazgo de la
// auditoría: probado en vivo, temario/formato/peso quedaban `null` incluso
// cuando el texto del usuario los mencionaba explícitamente). Esta función
// es la costura que faltaba, mismo criterio defensivo que
// resolverIcono/resolverDedup (lib/server/materias.ts): un fallo acá NUNCA
// debe impedir que la tarea se cree, solo se pierde el enriquecimiento.
//
// `explicitos` son los campos que el propio llamador ya mandó en el body
// (hoy nunca pasa — ningún cliente los llena todavía — pero si en el futuro
// alguno lo hace, gana sobre lo que extraiga el agente: un dato que el
// usuario tecleó a mano vale más que uno inferido).
export async function resolverCamposExamen(
  userId: string,
  input: { tipo: string | undefined; textoOrigen: string | undefined },
  explicitos: CamposExamenExplicitos
): Promise<CamposExamenExplicitos> {
  if (input.tipo !== 'examen' || !input.textoOrigen) return explicitos

  const faltaAlgo = explicitos.temario === undefined || explicitos.formato === undefined || explicitos.peso === undefined
  if (!faltaAlgo) return explicitos

  try {
    bootstrapAI()
    const resultado = await aiOrchestrator.execute<CamposExamen>(
      EXAM_AGENT_ID,
      { id: createId('req'), agentId: EXAM_AGENT_ID, userId, input: input.textoOrigen },
      { userId, generatedAt: Date.now() }
    )
    if (resultado.status !== 'success' || !resultado.output) {
      console.error('[resolverCamposExamen] agente no tuvo éxito, se usan solo los campos explícitos', resultado.status, resultado.error)
      return explicitos
    }
    return {
      temario: explicitos.temario !== undefined ? explicitos.temario : resultado.output.temario,
      formato: explicitos.formato !== undefined ? explicitos.formato : resultado.output.formato,
      peso: explicitos.peso !== undefined ? explicitos.peso : resultado.output.peso,
    }
  } catch (error) {
    console.error('[resolverCamposExamen] excepción, se usan solo los campos explícitos', error)
    return explicitos
  }
}
