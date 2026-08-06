import type { DetectedTask } from '../homework/types'

export const ANALISIS_ARCHIVO_AGENT_ID = 'analisis-archivo-agent'
export const ANALISIS_ARCHIVO_AGENT_TRIGGER_EVENT = 'archivo.analisis_solicitado'

export const PREGUNTA_ARCHIVO_AGENT_ID = 'pregunta-archivo-agent'
export const PREGUNTA_ARCHIVO_AGENT_TRIGGER_EVENT = 'archivo.pregunta_recibida'

export type PreguntaArchivoAgentOutput = { respuesta: string }

// Lista cerrada — el MISMO conjunto que el check constraint
// `archivos_tipo_documento_chk` de la migración 20260809000400. Si cambia
// uno hay que cambiar el otro: no hay fuente única compartida por ser un
// `check` de Postgres de un lado y un `enum` de JSON Schema del otro (mismo
// caso ya documentado para `formatoReloj` en lib/api/schemas.ts).
export const TIPOS_DOCUMENTO = ['examen', 'guia', 'apuntes', 'enunciado', 'horario', 'otro'] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

// `tareas` reusa DetectedTask de HomeworkAgent tal cual, sin un tipo
// paralelo: es exactamente el mismo dato (una tarea académica extraída de
// un contenido), y así el día que la UI ofrezca "crear esta tarea detectada"
// puede reusar el mismo camino de creación que ya existe para /ai.
export type AnalisisArchivoAgentOutput = {
  resumen: string | null
  tipoDocumento: TipoDocumento
  tareas: DetectedTask[]
}
