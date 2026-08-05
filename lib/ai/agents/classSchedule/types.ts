import type { BloquePropuesto } from '@/lib/horario/diff'

export const CLASS_SCHEDULE_AGENT_ID = 'class-schedule-agent'
export const CLASS_SCHEDULE_AGENT_TRIGGER_EVENT = 'horario.foto_subida'

// Mismo vocabulario de "tipoRespuesta" que HomeworkAgent/TaskManagementAgent
// (Sprint 7.1): el modelo declara explícitamente qué clase de respuesta dio,
// en vez de que el cliente lo infiera de que la lista vino vacía.
// - 'bloques': se leyó un horario y se extrajeron bloques.
// - 'no_es_horario': la imagen no parece un horario de clases (una selfie,
//   un recibo...) — no es un error del sistema, es una foto equivocada, y
//   merece un mensaje distinto al de "no se pudo leer".
// - 'ilegible': sí parece un horario pero no se puede leer (borrosa, cortada,
//   muy oscura) — acá sí tiene sentido sugerir repetir la foto.
export type TipoRespuestaHorario = 'bloques' | 'no_es_horario' | 'ilegible'

export type ClassScheduleAgentOutput = {
  tipoRespuesta: TipoRespuestaHorario
  /** Poblado cuando NO es 'bloques': explica al usuario qué pasó. */
  mensaje: string | null
  bloques: BloquePropuesto[]
}
