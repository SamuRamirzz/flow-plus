'use client'

import { Layers } from 'lucide-react'
import type { desglosePorMateria } from '@/lib/estadisticas/agregacion'
import MagicBentoCard from '@/components/reactbits/MagicBento'

type Props = { desglose: ReturnType<typeof desglosePorMateria>; className?: string }

// Extraído de InformesRendimiento.tsx (sub-vista, ahora eliminada) al
// rediseño de Home en bento — mismo contenido, mismo lib/estadisticas/
// sin tocar, ahora se auto-envuelve en MagicBentoCard (mismo patrón que
// ProximasTareas/AccesosRapidos) para que InicioSection.tsx la componga
// sin preocuparse de envolverla.
//
// Siempre visible independientemente de evaluarSuficiencia(): depende solo
// de tareas PENDIENTES, no de historial de completado, así que no hay un
// estado "sin datos" que ocultarle — su propio "sin tareas pendientes" ya
// es honesto por sí solo.
export default function TarjetaPorMateria({ desglose, className }: Props) {
  return (
    <MagicBentoCard className={className}>
      <div className="p-4 sm:p-5 h-full">
        <p className="font-display text-sm font-semibold text-paper mb-3 flex items-center gap-1.5">
          <Layers size={14} className="text-coral" />
          Por materia
        </p>
        {desglose.length === 0 ? (
          <p className="text-muted text-xs">Sin tareas pendientes por materia todavía.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {desglose.map((m) => (
              // Apilado (nombre arriba, conteo debajo) en vez de una sola
              // fila con justify-between: en el rediseño bento esta
              // tarjeta comparte fila con Puntualidad (grid de 4, antes de
              // 3), más angosta que antes — con todo en una línea, un
              // nombre de materia largo se truncaba ("Hi...") para dejarle
              // espacio a "4 vencidas 5 pendientes", que nunca se achica
              // (flex-shrink-0). Apilado no compite por el mismo ancho.
              <div key={m.materiaId} className="text-xs">
                <span className="flex items-center gap-1.5 text-paper">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                  <span className="truncate">{m.nombre}</span>
                </span>
                <span className="flex items-center gap-2 font-mono mt-0.5 pl-3">
                  {m.vencidas > 0 && <span className="text-danger">{m.vencidas} vencidas</span>}
                  <span className="text-muted">{m.pendientes} pendientes</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </MagicBentoCard>
  )
}
