'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type TareaMin = { fecha_entrega: string | null; completada: boolean }
type Props = { tareas: TareaMin[]; seleccionado: string | null; onSelect: (fecha: string | null) => void }

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function MiniCalendar({ tareas, seleccionado, onSelect }: Props) {
  const [offsetMes, setOffsetMes] = useState(0)
  const base = new Date()
  const vista = new Date(base.getFullYear(), base.getMonth() + offsetMes, 1)
  const anio = vista.getFullYear()
  const mes = vista.getMonth()
  const offsetDia = (vista.getDay() + 6) % 7
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const nombreMes = vista.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const conTarea = new Set(
    tareas.filter((t) => !t.completada && t.fecha_entrega).map((t) => t.fecha_entrega as string)
  )

  const celdas: (number | null)[] = [
    ...Array(offsetDia).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]

  function fechaStr(dia: number) {
    return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  return (
    <div className="bg-panel-glass backdrop-blur-xl rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-sm font-semibold text-paper capitalize">{nombreMes}</p>
        <div className="flex gap-1">
          <button onClick={() => setOffsetMes((o) => o - 1)} className="w-5 h-5 flex items-center justify-center text-muted hover:text-coral transition">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setOffsetMes((o) => o + 1)} className="w-5 h-5 flex items-center justify-center text-muted hover:text-coral transition">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS.map((d) => (
          <div key={d} className="text-center text-[10px] text-muted font-mono">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`empty-${i}`} />
          const f = fechaStr(dia)
          const esHoy = dia === base.getDate() && mes === base.getMonth() && anio === base.getFullYear()
          const activo = seleccionado === f
          const tieneTarea = conTarea.has(f)
          return (
            <button
              key={f}
              onClick={() => onSelect(f)}
              title="Ver tareas de este día"
              style={esHoy && !activo ? { boxShadow: 'inset 0 0 0 1.5px var(--color-coral)' } : undefined}
              className={`relative w-7 h-7 rounded-full text-[11px] flex items-center justify-center transition font-mono
                ${activo ? 'bg-coral text-ink font-semibold' : esHoy ? 'text-coral' : 'text-paper hover:bg-panel-2'}`}
            >
              {dia}
              {tieneTarea && !activo && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-coral" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
