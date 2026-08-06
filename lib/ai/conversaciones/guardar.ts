import { supabaseServer } from '@/lib/server/supabaseServer'
import { aiOrchestrator } from '@/lib/ai'
import { bootstrapAI } from '@/lib/ai/bootstrap'
import { createId } from '@/lib/ai/utils'
import { RESUMEN_CONVERSACION_AGENT_ID, type ResumenConversacionAgentOutput } from '@/lib/ai/agents/resumenConversacion'

// Sprint Archivos / Fase 5.1 — guarda una conversación de /ai ya cerrada.
//
// "Cerrada" se define como: el usuario cerró el overlay (X o Escape) — la
// señal explícita más clara de intención, frente a un timer de inactividad
// que no existe hoy y sería mecánica nueva sin necesidad real detrás. Este
// archivo NO engancha ese cierre (tocar AIImmersiveOverlay.tsx es UI, fuera
// de este tramo): expone la función que `POST /api/conversaciones` llama, y
// que la UI de un sprint aparte deberá invocar en ese punto exacto.
//
// Forma de entrada DELIBERADAMENTE propia del servidor, no el tipo `Turno`
// de components/ai/conversacion.ts — ese tipo es de estado de React (incluye
// `aplicando`/`aplicadoOk`/`operaciones` editables) y además `lib/` no debe
// importar de `components/` (dirección de dependencia invertida). El
// contrato de este endpoint es la forma que la migración ya documentó para
// `mensajes`: `[{ rol, texto, en }]`.
export type MensajeConversacion = { rol: 'usuario' | 'ia'; texto: string; en: string }

// Obligación textual de la migración: no dejar crecer `mensajes` sin límite.
const MAX_MENSAJES = 50
// Mismo umbral documentado en la migración — resumir un "hola" de 1-2
// turnos no vale una llamada al modelo.
const MIN_MENSAJES_PARA_RESUMEN = 4

function recortarMensajes(mensajes: MensajeConversacion[]): MensajeConversacion[] {
  return mensajes.length > MAX_MENSAJES ? mensajes.slice(mensajes.length - MAX_MENSAJES) : mensajes
}

function textoParaResumen(mensajes: MensajeConversacion[]): string {
  return mensajes.map((m) => `${m.rol === 'usuario' ? 'Usuario' : 'Asistente'}: ${m.texto}`).join('\n')
}

export type ResultadoGuardarConversacion = { ok: true; id: string; resumen: string | null } | { ok: false; error: string }

/**
 * Inserta la conversación en Postgres primero (nunca bloqueada por el
 * resumen) y, si hay suficientes turnos, intenta un resumen inline UNA vez.
 * Si el resumen falla, la conversación queda guardada igual — `resumen:
 * null` es un estado válido ("todavía no hay resumen"), no un error.
 */
export async function guardarConversacion(userId: string, mensajesCrudos: MensajeConversacion[]): Promise<ResultadoGuardarConversacion> {
  const mensajes = recortarMensajes(mensajesCrudos)

  const { data: fila, error } = await supabaseServer.from('conversaciones_ia').insert({ user_id: userId, mensajes }).select('id').single()

  if (error) return { ok: false, error: error.message }

  const resumen = mensajes.length >= MIN_MENSAJES_PARA_RESUMEN ? await intentarResumen(userId, fila.id, mensajes) : null

  return { ok: true, id: fila.id, resumen }
}

async function intentarResumen(userId: string, conversacionId: string, mensajes: MensajeConversacion[]): Promise<string | null> {
  try {
    bootstrapAI()
    const resultado = await aiOrchestrator.execute<ResumenConversacionAgentOutput>(
      RESUMEN_CONVERSACION_AGENT_ID,
      { id: createId('req'), agentId: RESUMEN_CONVERSACION_AGENT_ID, userId, input: textoParaResumen(mensajes) },
      { userId, generatedAt: Date.now() }
    )

    if (resultado.status !== 'success' || !resultado.output) {
      console.error('[conversaciones] agente de resumen no tuvo éxito:', resultado.status, resultado.error)
      await marcarIntentoFallido(conversacionId)
      return null
    }

    const { error } = await supabaseServer
      .from('conversaciones_ia')
      .update({ resumen: resultado.output.resumen, resumen_generado_en: new Date().toISOString() })
      .eq('id', conversacionId)
    if (error) console.error('[conversaciones] resumen generado pero no se pudo guardar:', error.message)

    return resultado.output.resumen
  } catch (error) {
    console.error('[conversaciones] excepción generando resumen:', error)
    await marcarIntentoFallido(conversacionId)
    return null
  }
}

// guardarConversacion siempre inserta una fila NUEVA (resumen_intentos nace
// en su default de la migración, 0) y solo intenta el resumen UNA vez acá —
// alcanza con fijar 1, no hace falta leer-antes-de-escribir. Si en el futuro
// se agrega un reintento perezoso (al abrir el historial, como ya documenta
// la migración), esa ruta sí debe leer el valor actual antes de incrementar.
async function marcarIntentoFallido(conversacionId: string): Promise<void> {
  const { error } = await supabaseServer.from('conversaciones_ia').update({ resumen_intentos: 1 }).eq('id', conversacionId)
  if (error) console.error('[conversaciones] no se pudo registrar el intento de resumen fallido:', error.message)
}
