import type { Materia, Tarea } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'

// Los campos ya coinciden 1:1 con lo que devuelven los Route Handlers
// reales — reusar Materia/Tarea/BloqueHorario tal cual evita un segundo
// juego de tipos que mantener sincronizado con lib/types.ts.
export type DatosInvitado = {
  guestId: string
  materias: Materia[]
  tareas: Tarea[]
  horario: BloqueHorario[]
}

export function datosInvitadoVacios(guestId: string): DatosInvitado {
  return { guestId, materias: [], tareas: [], horario: [] }
}
