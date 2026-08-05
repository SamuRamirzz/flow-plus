'use client'
import type { Materia } from '@/lib/types'
import PremiumSelect from './PremiumSelect'
import { IconoMateria } from './iconosMateria'

export const MATERIA_NUEVA = '__nueva__'

type Props = {
  id: string
  materias: Materia[]
  materiaId: string
  nuevaMateria: string
  onMateriaIdChange: (id: string) => void
  onNuevaMateriaChange: (nombre: string) => void
  placeholder?: string
}

// Selector de materia + campo "nombre de materia nueva" inline cuando se
// elige "+ Nueva materia…" — extraído de AddTaskBar para reusarlo también
// en la pantalla /ai (cada tarea detectada necesita el mismo control).
export default function MateriaPicker({
  id,
  materias,
  materiaId,
  nuevaMateria,
  onMateriaIdChange,
  onNuevaMateriaChange,
  placeholder = 'Selecciona materia',
}: Props) {
  const opciones = [
    ...materias.map((m) => ({ id: m.id, label: m.nombre, color: m.color, icon: <IconoMateria icono={m.icono} size={12} /> })),
    { id: MATERIA_NUEVA, label: '+ Nueva materia…', color: undefined, icon: undefined },
  ]

  return (
    <>
      <PremiumSelect id={id} options={opciones} value={materiaId} onChange={onMateriaIdChange} placeholder={placeholder} />
      {materiaId === MATERIA_NUEVA && (
        <input
          value={nuevaMateria}
          onChange={(e) => onNuevaMateriaChange(e.target.value)}
          placeholder="Nombre de la materia"
          className="bg-panel-glass backdrop-blur-md rounded-full px-3.5 py-2 text-xs text-paper placeholder:text-muted outline-none focus:ring-1 focus:ring-coral/60 transition"
        />
      )}
    </>
  )
}
