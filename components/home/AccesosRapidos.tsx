'use client'

import { useRouter } from 'next/navigation'
import { Sparkles, BookOpen, ListChecks } from 'lucide-react'
import MagicBentoCard from '@/components/reactbits/MagicBento'
import { RUTA_AGENDA } from '@/lib/rutas'

type Props = { className?: string }

// Reusa las transiciones `to-ai`/`to-agenda` que ya existen en
// globals.css/ModeTransition.tsx — mismo mecanismo que NavDock/Sidebar, no
// una animación de navegación nueva.
//
// Sprint Home / corrección de alcance — tercer acceso a Agenda, agregado acá
// porque antes no hacía falta (Agenda y Home eran la misma pantalla). Con
// las dos separadas, y con NavDock (móvil) sin ranura fija para "Agenda"
// entre sus 5 íconos, este es el único camino de un toque hacia la tabla de
// tareas completa en móvil — en desktop además está en AppSidebar.
//
// Rediseño bento — ya NO recibe `proximaClase`: ese dato en vivo se movió a
// ProximasTareas.tsx (ahora la tarjeta "Hoy"), así que este componente queda
// como navegación pura — mismas 3 tarjetas, mismo texto siempre, sin
// condicionales de estado. Column compacta lateral, no un dato a vigilar.
export default function AccesosRapidos({ className }: Props) {
  const router = useRouter()

  return (
    <div className={`flex flex-col gap-3 h-full ${className ?? ''}`}>
      <MagicBentoCard>
        <button
          onClick={() => router.push('/ai', { transitionTypes: ['to-ai'] })}
          className="group flex items-center gap-3 p-4 w-full text-left"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-coral/15 text-coral flex-shrink-0">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-paper font-medium">Contarle algo a la IA</p>
            <p className="text-muted text-xs truncate">Texto, foto o voz — ella organiza</p>
          </div>
        </button>
      </MagicBentoCard>

      <MagicBentoCard>
        <button onClick={() => router.push('/horario')} className="group flex items-center gap-3 p-4 w-full text-left">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-panel-2 text-paper flex-shrink-0">
            <BookOpen size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-paper font-medium">Ver tu horario</p>
            <p className="text-muted text-xs">Repasa tu semana</p>
          </div>
        </button>
      </MagicBentoCard>

      <MagicBentoCard>
        <button onClick={() => router.push(RUTA_AGENDA, { transitionTypes: ['to-agenda'] })} className="group flex items-center gap-3 p-4 w-full text-left">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-panel-2 text-paper flex-shrink-0">
            <ListChecks size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-paper font-medium">Ver toda tu Agenda</p>
            <p className="text-muted text-xs">La tabla completa, con filtros</p>
          </div>
        </button>
      </MagicBentoCard>
    </div>
  )
}
