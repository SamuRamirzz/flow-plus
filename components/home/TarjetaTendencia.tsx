'use client'

import type { EstadoDatos, SemanaCumplimiento } from '@/lib/estadisticas/agregacion'
import GraficaTendencia from './GraficaTendencia'
import MagicBentoCard from '@/components/reactbits/MagicBento'

type Props = { estado: EstadoDatos; semanas: SemanaCumplimiento[]; className?: string }

const SEMANAS_A_MOSTRAR = 6

// Tarjeta propia para la gráfica de recharts — antes vivía en la sub-vista
// "Informes" (InformesRendimiento.tsx, eliminada en este rediseño). La
// gráfica en sí (GraficaTendencia.tsx) no se tocó: sigue siendo el único
// componente del proyecto que importa recharts.
//
// Degradación honesta por estado (mismo criterio que ya existía, solo
// reubicado): con 'completo' se ve la gráfica real; con 'sin_datos' o
// 'insuficiente' se reemplaza por un mensaje — nunca un <BarChart> con 0-2
// barras que parezca roto.
export default function TarjetaTendencia({ estado, semanas, className }: Props) {
  return (
    <MagicBentoCard className={className}>
      <div className="p-4 sm:p-5 h-full flex flex-col">
        <p className="font-display text-sm font-semibold text-paper mb-3">Últimas {SEMANAS_A_MOSTRAR} semanas</p>
        {estado === 'completo' ? (
          <GraficaTendencia semanas={semanas} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center py-6">
            <p className="text-muted text-xs max-w-[220px]">
              {estado === 'sin_datos'
                ? 'Todavía no hay nada que mostrar aquí — en cuanto completes tu primera tarea, esto empieza a llenarse.'
                : 'Con más historial vas a ver aquí cómo cambia tu cumplimiento semana a semana.'}
            </p>
          </div>
        )}
      </div>
    </MagicBentoCard>
  )
}
