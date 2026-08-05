export { esFechaPlausible, detectarColisiones, decidirAutonomia } from './validar'
export { mensajeAvisoCalendario } from './avisos'
export { resolverAvisoDedup } from './dedup'
export { calendarAgent } from './CalendarAgent'
export type { DedupInput } from './CalendarAgent'
export { CalendarDedupOutputParser, CALENDAR_DEDUP_OUTPUT_SCHEMA } from './dedupSchema'
export { CALENDAR_AGENT_ID, CALENDAR_AGENT_TRIGGER_EVENT } from './types'
export type {
  ResultadoPlausibilidad,
  TareaNuevaParaColision,
  TareaExistenteParaColision,
  ColisionDetectada,
  DecisionAutonomia,
  MateriaParaComparar,
  ResultadoDedup,
  PosibleDuplicadoMateria,
} from './types'
