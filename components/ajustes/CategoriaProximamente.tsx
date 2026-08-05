'use client'
import { Sparkles, HardDrive, MessageCircle, History, CalendarRange, Brain, type LucideIcon } from 'lucide-react'
import { PROXIMAMENTE, type NombreIconoProximamente } from '@/lib/ajustes/proximamente'

// Mismo patrón que components/ui/iconosMateria.tsx: los datos
// (lib/ajustes/proximamente.ts) guardan el NOMBRE del ícono, este mapa lo
// resuelve al componente real — la lista de datos no importa React.
const ICONOS: Record<NombreIconoProximamente, LucideIcon> = { HardDrive, MessageCircle, History, CalendarRange, Brain }

export default function CategoriaProximamente() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-paper flex items-center gap-2">
          <Sparkles size={16} className="text-coral" />
          Próximamente
        </h2>
        <p className="text-muted text-xs mt-1">Esto está en camino — todavía no puedes usarlo.</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {PROXIMAMENTE.map((item) => {
          const Icono = ICONOS[item.icono]
          return (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5 opacity-70">
              <span className="flex-shrink-0 w-9 h-9 rounded-full bg-panel-2 flex items-center justify-center text-muted">
                <Icono size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-paper font-medium">{item.nombre}</p>
                <p className="text-muted text-xs mt-0.5 truncate">{item.descripcion}</p>
              </div>
              <span className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wide text-coral bg-coral/10 rounded-full px-2.5 py-1">
                Próximamente
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
