export const HOMEWORK_AGENT_ID = 'homework-agent'
export const HOMEWORK_AGENT_TRIGGER_EVENT = 'homework.text_submitted'

export type HomeworkTaskType = 'ejercicios' | 'examen' | 'ensayo' | 'lectura' | 'proyecto' | 'otro'
export type HomeworkPriority = 'baja' | 'media' | 'alta'

// Una tarea detectada dentro del texto — el texto de entrada puede describir
// varias ("resolver ejercicios de matemáticas Y estudiar para el examen de
// historia"), cada una con su propia materia/fecha/prioridad, por eso el
// resultado es un arreglo y no un único bloque como en el mock del Sprint 1.
export type DetectedTask = {
  id: string
  titulo: string
  materia: string | null
  fecha: string | null
  prioridad: HomeworkPriority
  tipo: HomeworkTaskType
  confidence: number
}

// Distingue por qué `tareas` puede venir vacío — antes de esto, "vacío"
// significaba siempre "no se detectó ninguna tarea" (mensaje de error),
// incluso cuando el usuario solo estaba saludando ("hola"). El modelo
// declara el caso explícitamente (más confiable que inferirlo después con
// heurísticas de texto en el cliente):
// - 'tareas': se detectó al menos una tarea académica.
// - 'ambiguo': el usuario intentaba describir una tarea pero el texto no
//   alcanza para extraer nada útil — el mensaje de error actual sigue
//   aplicando acá, sin cambios.
// - 'conversacional': el texto no era un intento de describir una tarea
//   (saludo, pregunta, charla) — no es un error, `mensaje` trae una
//   respuesta breve y natural.
export type TipoRespuestaHomework = 'tareas' | 'ambiguo' | 'conversacional'

export type HomeworkAgentOutput = {
  originalText: string
  tipoRespuesta: TipoRespuestaHomework
  /** Solo poblado cuando tipoRespuesta === 'conversacional'. */
  mensaje: string | null
  tareas: DetectedTask[]
}
