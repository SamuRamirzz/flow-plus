// Convención ISO-8601: 1=lunes … 7=domingo — NUNCA la convención de
// JavaScript (0=domingo…6=sábado). El producto es en español, la semana
// empieza en lunes, y SegmentedToggle ya renderiza L-M-X-J-V-S-D. La única
// conversión entre ambas vive en dias.ts.
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7

// Sprint Zonas de horario — "clase" es un bloque real con materia; los
// otros tres son bloques especiales sin materia (ver migración
// 20260811000000: materiaId es null exactamente cuando tipo !== 'clase').
export type TipoBloqueHorario = 'clase' | 'ingreso' | 'salida' | 'descanso'

// Compartido entre app/horario/page.tsx (alta manual) y EditarBloqueModal
// (edición) — un solo lugar con el orden/las etiquetas, para que agregar un
// tipo nuevo en el futuro no exija tocar dos componentes por separado.
export const TIPO_BLOQUE_OPCIONES: { value: TipoBloqueHorario; label: string }[] = [
  { value: 'clase', label: 'Clase' },
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'salida', label: 'Salida' },
  { value: 'descanso', label: 'Descanso' },
]

export type BloqueHorario = {
  id: string
  tipo: TipoBloqueHorario
  // null exactamente cuando tipo !== 'clase' — ver TipoBloqueHorario arriba.
  materiaId: string | null
  diaSemana: DiaSemana
  horaInicio: string | null // 'HH:MM', 24h
  horaFin: string | null
  // Sub-sprint 8.2 — existen en la tabla `horario` desde el Sprint 7
  // (`aula text`, `profesor text`) pero no se exponían acá; el clic-para-
  // editar de un bloque es lo primero que los necesita en el cliente.
  aula: string | null
  profesor: string | null
}
