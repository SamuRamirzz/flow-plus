import type { Materia, Tarea } from '@/lib/types'
import { IconoMateria } from '@/components/ui/iconosMateria'

type Props = { materias: Materia[]; tareas: Tarea[] }

export default function AgendaSummary({ materias, tareas }: Props) {
  const pendientes = tareas.filter((t) => !t.completada)
  const proximas = [...pendientes]
    .filter((t) => t.fecha_entrega)
    .sort((a, b) => (a.fecha_entrega as string).localeCompare(b.fecha_entrega as string))
    .slice(0, 4)

  const porMateria = materias
    .map((m) => ({ ...m, count: pendientes.filter((t) => t.materia_id === m.id).length }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)

  const maxCount = Math.max(1, ...porMateria.map((m) => m.count))

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-panel-glass backdrop-blur-xl border border-line rounded-2xl p-4">
        <p className="font-display text-sm font-semibold text-paper mb-3">Próximas entregas</p>
        {proximas.length === 0 && <p className="text-muted text-xs">Nada urgente por ahora.</p>}
        <div className="flex flex-col gap-2.5">
          {proximas.map((t) => {
            const m = materias.find((mm) => mm.id === t.materia_id)
            const [, mo, d] = (t.fecha_entrega as string).split('-')
            return (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: m?.color ?? '#5C7FA6' }} />
                <span className="text-xs text-paper truncate flex-1">{t.titulo}</span>
                <span className="font-mono text-[10px] text-muted flex-shrink-0">{d}/{mo}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-panel-glass backdrop-blur-xl border border-line rounded-2xl p-4">
        <p className="font-display text-sm font-semibold text-paper mb-3">Por materia</p>
        <div className="flex flex-col gap-2.5">
          {porMateria.map((m) => (
            <div key={m.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 text-paper min-w-0">
                  <IconoMateria icono={m.icono} size={12} className="flex-shrink-0 text-muted" />
                  <span className="truncate">{m.nombre}</span>
                </span>
                <span className="text-muted font-mono flex-shrink-0">{m.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(m.count / maxCount) * 100}%`, backgroundColor: m.color }} />
              </div>
            </div>
          ))}
          {porMateria.length === 0 && <p className="text-muted text-xs">Agrega materias para ver el resumen.</p>}
        </div>
      </div>
    </div>
  )
}