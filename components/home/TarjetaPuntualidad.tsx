'use client'

import { Clock } from 'lucide-react'
import type { Tarea } from '@/lib/types'
import { calcularPuntualidad } from '@/lib/estadisticas/agregacion'
import MagicBentoCard from '@/components/reactbits/MagicBento'

type Props = { tareas: Tarea[]; className?: string }

// Extraído de InformesRendimiento.tsx (sub-vista, ahora eliminada). Con
// solo 2 categorías una gráfica sería ruido — dos números y un texto dicen
// lo mismo con menos ceremonia, mismo razonamiento que antes.
export default function TarjetaPuntualidad({ tareas, className }: Props) {
  const { aTiempo, tarde } = calcularPuntualidad(tareas)
  const total = aTiempo + tarde
  return (
    <MagicBentoCard className={className}>
      <div className="p-4 sm:p-5 h-full">
        <p className="font-display text-sm font-semibold text-paper mb-3 flex items-center gap-1.5">
          <Clock size={14} className="text-coral" />
          Puntualidad
        </p>
        {total === 0 ? (
          <p className="text-muted text-xs">Sin suficiente dato de completado todavía.</p>
        ) : (
          <p className="text-paper text-sm">
            <span className="font-display text-2xl font-semibold text-success">{aTiempo}</span>
            <span className="text-muted"> a tiempo · </span>
            <span className="font-display text-2xl font-semibold text-danger">{tarde}</span>
            <span className="text-muted"> tarde</span>
          </p>
        )}
      </div>
    </MagicBentoCard>
  )
}
