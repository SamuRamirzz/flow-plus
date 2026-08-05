// Convención ISO-8601: 1=lunes … 7=domingo — NUNCA la convención de
// JavaScript (0=domingo…6=sábado). El producto es en español, la semana
// empieza en lunes, y SegmentedToggle ya renderiza L-M-X-J-V-S-D. La única
// conversión entre ambas vive en dias.ts.
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type BloqueHorario = {
  id: string
  materiaId: string
  diaSemana: DiaSemana
  horaInicio: string | null // 'HH:MM', 24h
  horaFin: string | null
  // Sub-sprint 8.2 — existen en la tabla `horario` desde el Sprint 7
  // (`aula text`, `profesor text`) pero no se exponían acá; el clic-para-
  // editar de un bloque es lo primero que los necesita en el cliente.
  aula: string | null
  profesor: string | null
}
