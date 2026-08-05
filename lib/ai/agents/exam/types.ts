export const EXAM_AGENT_ID = 'exam-agent'
export const EXAM_AGENT_TRIGGER_EVENT = 'exam.fields_requested'

/** Formato de evaluación. Unión cerrada, igual que el CHECK de
 *  `tareas.formato` en la migración 20260802000000 — si acá se agrega un
 *  valor, la restricción de la base hay que ampliarla en la misma tanda o el
 *  insert falla (mismo criterio que `MemoryScope` ↔ el CHECK de `memoria`). */
export type FormatoExamen = 'oral' | 'escrito' | 'proyecto' | 'mixto'

/** Los tres campos que un examen tiene y una tarea genérica no. Todos
 *  opcionales de verdad: el usuario casi nunca dicta los tres, y forzar un
 *  valor inventado sería peor que dejarlo vacío. */
export type CamposExamen = {
  temario: string | null
  formato: FormatoExamen | null
  /** Porcentaje de la nota final, 0-100 (no fracción 0-1). */
  peso: number | null
}

export const CAMPOS_EXAMEN_VACIOS: CamposExamen = { temario: null, formato: null, peso: null }
