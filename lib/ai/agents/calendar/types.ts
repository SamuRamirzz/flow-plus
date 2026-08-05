import type { OrigenFecha } from '@/lib/horario/inferirFecha'

export type ResultadoPlausibilidad = { valida: boolean; motivo: string | null }

/** La tarea que se está por crear/mover. `id` solo existe cuando es una
 *  MODIFICACIÓN de una tarea ya guardada; al crear no hay id todavía. */
export type TareaNuevaParaColision = { id?: string; fecha: string | null; prioridad: string; tipo: string }

/** Una tarea ya guardada, candidata a chocar con la nueva. */
export type TareaExistenteParaColision = { id: string; titulo: string; fecha: string | null; prioridad: string; tipo: string }

export type ColisionDetectada = { tareaId: string; titulo: string; motivo: string }

export type DecisionAutonomia = 'autonomo' | 'requiere_revision'

// Reexportado para que quien llame a esFechaPlausible no tenga que importar
// por su cuenta el mismo union que ya usa inferirFechaEntrega.
export type { OrigenFecha }

// ── Dedup semántico (cierre de Fase 1) ──────────────────────────────────
// A diferencia de esFechaPlausible/detectarColisiones (puras, sin modelo),
// esto SÍ llama a Gemini — es la mitad que el Sprint 10 dejó pendiente a
// propósito. Vive en el mismo archivo de tipos, mismo folder: no es un
// agente separado, es CalendarAgent extendido con una segunda capacidad.
export const CALENDAR_AGENT_ID = 'calendar-agent'
export const CALENDAR_AGENT_TRIGGER_EVENT = 'calendar.materia_creada'

/** Una materia existente tal como se le manda al modelo — solo lo que
 *  necesita para comparar nombres, nunca color/ícono/fechas. */
export type MateriaParaComparar = { id: string; nombre: string }

export type ResultadoDedup = {
  hayDuplicado: boolean
  /** Solo si hayDuplicado — la materia existente que probablemente es la
   *  misma. `null` en cualquier otro caso. */
  materiaExistente: MateriaParaComparar | null
  /** 0 si hayDuplicado es false. */
  confianza: number
}

/** Lo que de verdad viaja hasta el cliente — ya con la decisión de
 *  autonomía aplicada (Sprint 10, `decidirAutonomia`), que es lo que decide
 *  cuán insistente se ve el aviso. `null` = no hubo duplicado, o la
 *  confianza no alcanzó ni para mostrarlo discreto (ver UMBRAL_MOSTRAR en
 *  dedup.ts) — la ausencia de aviso es la respuesta correcta a "ruido".*/
export type PosibleDuplicadoMateria = {
  materiaId: string
  nombre: string
  confianza: number
  autonomia: DecisionAutonomia
}
