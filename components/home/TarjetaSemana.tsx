'use client'

import { TrendingUp, Flame } from 'lucide-react'
import type { EstadoDatos, SemanaCumplimiento, Racha } from '@/lib/estadisticas/agregacion'
import MagicBentoCard from '@/components/reactbits/MagicBento'

type Props = {
  estado: EstadoDatos
  semanaActual: SemanaCumplimiento | null
  racha: Racha
  className?: string
}

// La tarjeta destacada del bento (referencia visual: la "Total Projects"
// verde de Donzo — grande, acento de color, el número más importante
// visible de inmediato). Reemplaza a TarjetaRendimiento.tsx: ya no es un
// botón que navega a una sub-vista (esa sub-vista, InformesRendimiento,
// se eliminó — sus gráficas ahora viven incrustadas en sus propias
// tarjetas más abajo en la misma página, no detrás de un clic).
//
// La barra de progreso reusa semanaActual (completadas/total de ESTA
// semana, ya calculado por tendenciaSemanal(tareas, hoy, 1)[0] en
// InicioSection) — no se agrega ninguna función nueva a agregacion.ts,
// es el mismo dato ya disponible, solo con una representación visual
// además del número.
export default function TarjetaSemana({ estado, semanaActual, racha, className }: Props) {
  const completadas = semanaActual?.completadas ?? 0
  const total = semanaActual?.total ?? 0
  const porcentaje = total > 0 ? Math.min(100, Math.round((completadas / total) * 100)) : 0

  return (
    <MagicBentoCard className={className} glowRadius={420}>
      <div className="p-5 sm:p-7 h-full flex flex-col justify-between">
        <p className="font-display text-sm font-semibold text-paper flex items-center gap-1.5">
          <TrendingUp size={14} className="text-coral" />
          Cómo vas esta semana
        </p>

        {estado === 'sin_datos' ? (
          <p className="text-muted text-sm leading-relaxed max-w-[320px]">
            Esto se va a ir llenando a medida que uses Flow+ — completa tu primera tarea para empezar a ver tu ritmo.
          </p>
        ) : estado === 'insuficiente' ? (
          <p className="text-muted text-sm leading-relaxed max-w-[320px]">Todavía es pronto para una tendencia — sigue así unos días más.</p>
        ) : (
          <div>
            <p className="text-paper">
              <span className="font-display text-5xl sm:text-6xl font-semibold text-coral tracking-tight">{completadas}</span>
              <span className="text-muted text-base sm:text-lg"> de {total} esta semana</span>
            </p>
            <div className="mt-4 h-2 w-full max-w-[320px] rounded-full bg-panel-2 overflow-hidden">
              <div className="h-full rounded-full bg-coral transition-[width] duration-700 ease-out" style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-muted text-xs mt-5">
          <Flame size={13} className="text-coral" />
          {racha.diasSinVencidas} día{racha.diasSinVencidas === 1 ? '' : 's'} sin dejar vencer nada
        </div>
      </div>
    </MagicBentoCard>
  )
}
