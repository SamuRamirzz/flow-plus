'use client'
import type { Materia, Tarea } from '@/lib/types'
import TaskRow from './TaskRow'

type Props = {
  tareas: Tarea[]
  materias: Materia[]
  onToggle: (id: string, actual: boolean) => void
  onDelete: (id: string) => void
  onEdit: (id: string, nuevo: string) => void
  onAbrirDetalle?: (tarea: Tarea) => void
}

export default function TaskTable({ tareas, materias, onToggle, onDelete, onEdit, onAbrirDetalle }: Props) {
  const materiaDe = (id: string) => materias.find((m) => m.id === id)
  const pendientes = tareas.filter((t) => !t.completada).length
  const vencidas = tareas.filter((t) => !t.completada && t.fecha_entrega && new Date(t.fecha_entrega + 'T00:00:00') < new Date(new Date().toDateString())).length
  const completadas = tareas.filter((t) => t.completada).length

  return (
    <div className="bg-panel-glass backdrop-blur-xl border border-line rounded-2xl overflow-hidden">
      <div className="hidden sm:grid grid-cols-[28px_1fr_140px_100px_130px_28px] gap-3 px-3 py-2.5 border-b border-line text-[10px] font-mono uppercase tracking-wide text-muted">
        <span />
        <span>Tarea</span>
        <span>Materia</span>
        <span>Prioridad</span>
        <span>Fecha límite</span>
        <span />
      </div>

      <div className="p-1.5 flex flex-col">
        {tareas.length === 0 && (
          <div className="text-center py-14">
            <p className="text-paper text-sm mb-1">No hay tareas aquí.</p>
            <p className="text-muted text-xs">Agrega tu primera tarea arriba ✨</p>
          </div>
        )}
        {tareas.map((t) => {
          const m = materiaDe(t.materia_id)
          return (
            <TaskRow
              key={t.id}
              titulo={t.titulo}
              materia={m?.nombre ?? '—'}
              color={m?.color ?? '#5C7FA6'}
              icono={m?.icono}
              prioridad={t.prioridad}
              fecha={t.fecha_entrega}
              completada={t.completada}
              onToggle={() => onToggle(t.id, t.completada)}
              onDelete={() => onDelete(t.id)}
              onEdit={(nuevo) => onEdit(t.id, nuevo)}
              onAbrirDetalle={onAbrirDetalle ? () => onAbrirDetalle(t) : undefined}
            />
          )
        })}
      </div>

      {tareas.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-line text-[11px] font-mono text-muted flex-wrap gap-2">
          <span>{tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'} en total</span>
          <span className="flex items-center gap-3">
            <span>{pendientes} pendientes</span>
            <span>{vencidas} vencidas</span>
            <span>{completadas} completadas</span>
          </span>
        </div>
      )}
    </div>
  )
}
