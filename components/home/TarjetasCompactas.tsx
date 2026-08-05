'use client'

import { AlertTriangle, GraduationCap, ListTodo } from 'lucide-react'
import type { Tarea } from '@/lib/types'
import MagicBentoCard from '@/components/reactbits/MagicBento'

type Props = { tareas: Tarea[]; hoy: string; className?: string }

type Stat = { icono: typeof AlertTriangle; valor: number; etiqueta: string; acento: string }

// Las tres métricas complementarias junto a TarjetaSemana (referencia:
// la fila de KPIs pequeños de Donzo). Deliberadamente distintas de lo que
// ya cuenta TarjetaSemana (esta semana) y del contenido de TarjetaPorMateria
// (desglose por materia) para no repetir el mismo número dos veces en la
// misma pantalla:
//   - Vencidas: total, cualquier materia, siempre calculable (no depende
//     de historial de completado).
//   - Exámenes próximos: tipo='examen' pendientes con fecha futura o de
//     hoy — cálculo nuevo, pero un simple filter de una línea no amerita
//     una función nueva en lib/estadisticas/agregacion.ts (mismo criterio
//     ya usado para pendientes/vencidas en la extinta InformesRendimiento).
//   - Pendientes: el conteo total, el número más "de base" de todos, sin
//     ninguna condición — siempre tiene sentido mostrarlo aunque no haya
//     ni un solo día de historial.
export default function TarjetasCompactas({ tareas, hoy, className }: Props) {
  const vencidas = tareas.filter((t) => !t.completada && t.fecha_entrega !== null && t.fecha_entrega < hoy).length
  const examenesProximos = tareas.filter((t) => !t.completada && t.tipo === 'examen' && t.fecha_entrega !== null && t.fecha_entrega >= hoy).length
  const pendientes = tareas.filter((t) => !t.completada).length

  const stats: Stat[] = [
    { icono: AlertTriangle, valor: vencidas, etiqueta: vencidas === 1 ? 'Vencida' : 'Vencidas', acento: 'text-danger' },
    { icono: GraduationCap, valor: examenesProximos, etiqueta: examenesProximos === 1 ? 'Examen próximo' : 'Exámenes próximos', acento: 'text-coral' },
    { icono: ListTodo, valor: pendientes, etiqueta: pendientes === 1 ? 'Pendiente' : 'Pendientes', acento: 'text-paper' },
  ]

  return (
    <div className={`grid grid-cols-3 gap-3 ${className ?? ''}`}>
      {stats.map((s) => (
        <MagicBentoCard key={s.etiqueta}>
          <div className="p-3 sm:p-4 h-full flex flex-col justify-between gap-2">
            <s.icono size={14} className={s.acento} />
            <div>
              <p className={`font-display text-xl sm:text-2xl font-semibold leading-none ${s.acento}`}>{s.valor}</p>
              <p className="text-muted text-[10px] sm:text-xs mt-1 leading-tight">{s.etiqueta}</p>
            </div>
          </div>
        </MagicBentoCard>
      ))}
    </div>
  )
}
