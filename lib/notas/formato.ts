import type { Materia, Tarea } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import type { Archivo } from '@/lib/archivos/tipos'
import { anclaDeNota, type Nota, type TipoAnclaNota } from './tipos'

// Sprint Sistema de Notas Unificado / Parte C — todo lo que la vista
// unificada de Archivos necesita para mostrar "a qué está anclada" cada
// nota de forma legible, sin que el componente tenga que hacer el cruce a
// mano. PURO — recibe las listas ya cargadas (materias/tareas/horario/
// archivos), nunca hace I/O.

export const ETIQUETA_ANCLA: Record<TipoAnclaNota, string> = {
  tarea: 'Tarea',
  bloque_horario: 'Horario',
  archivo: 'Archivo',
  materia: 'Materia',
  suelta: 'Suelta',
}

const DIA_CORTO: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }

const LABEL_TIPO_BLOQUE: Record<BloqueHorario['tipo'], string> = {
  clase: '',
  ingreso: 'Ingreso',
  salida: 'Salida',
  descanso: 'Descanso',
}

export type ContextoNotas = {
  materias: Materia[]
  tareas: Tarea[]
  horario: BloqueHorario[]
  archivos: Archivo[]
}

/**
 * Nombre legible de a qué está anclada la nota, resuelto contra los datos
 * ya cargados en memoria. Si el ancla apunta a algo que ya no existe (fue
 * borrado, pero la FK es `on delete set null` así que en teoría no debería
 * pasar — salvo una carrera entre el borrado y esta lectura), cae a un
 * texto honesto en vez de romper el render.
 */
export function nombreDeAncla(nota: Nota, contexto: ContextoNotas): string {
  const tipo = anclaDeNota(nota)
  switch (tipo) {
    case 'tarea': {
      const t = contexto.tareas.find((x) => x.id === nota.tarea_id)
      return t?.titulo ?? 'Tarea eliminada'
    }
    case 'bloque_horario': {
      const b = contexto.horario.find((x) => x.id === nota.bloque_horario_id)
      if (!b) return 'Bloque eliminado'
      const dia = DIA_CORTO[b.diaSemana] ?? ''
      if (b.tipo !== 'clase') return `${LABEL_TIPO_BLOQUE[b.tipo]} (${dia})`
      const m = b.materiaId ? contexto.materias.find((x) => x.id === b.materiaId) : undefined
      return `${m?.nombre ?? 'Clase'} (${dia})`
    }
    case 'archivo': {
      const a = contexto.archivos.find((x) => x.id === nota.archivo_id)
      return a?.nombre ?? 'Archivo eliminado'
    }
    case 'materia': {
      const m = contexto.materias.find((x) => x.id === nota.materia_id)
      return m?.nombre ?? 'Materia eliminada'
    }
    case 'suelta':
      return 'Sin asociar'
  }
}

export type FiltroNotas = 'todas' | 'tareas' | 'horario' | 'archivos' | 'materias'

const FILTRO_A_ANCLA: Record<Exclude<FiltroNotas, 'todas'>, TipoAnclaNota> = {
  tareas: 'tarea',
  horario: 'bloque_horario',
  archivos: 'archivo',
  materias: 'materia',
}

export const CHIPS_FILTRO_NOTAS: { id: FiltroNotas; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'horario', label: 'Horario' },
  { id: 'archivos', label: 'Archivos' },
  { id: 'materias', label: 'Materias' },
]

export function filtrarNotasPorAncla(notas: Nota[], filtro: FiltroNotas): Nota[] {
  if (filtro === 'todas') return notas
  const anclaBuscada = FILTRO_A_ANCLA[filtro]
  return notas.filter((n) => anclaDeNota(n) === anclaBuscada)
}
