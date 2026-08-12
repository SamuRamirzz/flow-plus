// Sprint Sistema de Notas Unificado — antes `Nota` vivía solo en
// lib/archivos/tipos.ts (nació ahí porque las notas de archivo fueron el
// primer caso de uso real). Ahora que una nota puede anclarse a 4 cosas
// distintas (tarea, bloque de horario, archivo, materia), el tipo se muda a
// su propio módulo — lib/archivos/tipos.ts ya no lo declara, solo lo
// consumía PanelDetalle.tsx/SeccionNotas.tsx (2 sitios), migrados a
// importar de acá directamente.
export type Nota = {
  id: string
  titulo: string | null
  contenido: string
  tarea_id: string | null
  bloque_horario_id: string | null
  archivo_id: string | null
  materia_id: string | null
  drive_file_id: string | null
  drive_sync_error: string | null
  creado_por: 'usuario' | 'ia'
  created_at: string
  updated_at: string
}

// Las 4 anclas posibles, mismo orden que el check constraint
// `notas_ancla_chk` en la migración. 'suelta' no es una columna — es el
// estado derivado cuando las 4 son null (ver anclaDeNota más abajo).
export type TipoAnclaNota = 'tarea' | 'bloque_horario' | 'archivo' | 'materia' | 'suelta'

/**
 * PURA. Deriva a qué está anclada una nota, mirando cuál de las 4 columnas
 * no es null (el propio check constraint de la base ya garantiza que como
 * mucho una lo es). Único punto de esta lógica — la vista unificada (Parte
 * C) y cualquier otro consumidor futuro la llaman en vez de repetir el
 * if/else en cada componente.
 */
export function anclaDeNota(nota: Pick<Nota, 'tarea_id' | 'bloque_horario_id' | 'archivo_id' | 'materia_id'>): TipoAnclaNota {
  if (nota.tarea_id) return 'tarea'
  if (nota.bloque_horario_id) return 'bloque_horario'
  if (nota.archivo_id) return 'archivo'
  if (nota.materia_id) return 'materia'
  return 'suelta'
}
