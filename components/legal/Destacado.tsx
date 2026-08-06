import type { LucideIcon } from 'lucide-react'
import MagicBentoCard from '@/components/reactbits/MagicBento'

// Caja de resumen/aviso destacado dentro del contenido legal — reusa
// MagicBentoCard (ya construido para la landing) en vez de inventar un
// componente de tarjeta nuevo. `tono` distingue un punto de confianza
// positivo ("no vendemos tus datos") de una limitación real que hay que
// declarar con honestidad ("esto todavía no existe").
type Props = {
  icono: LucideIcon
  titulo: string
  tono?: 'positivo' | 'pendiente'
  children: React.ReactNode
}

export default function Destacado({ icono: Icono, titulo, tono = 'positivo', children }: Props) {
  return (
    <MagicBentoCard className="my-6" glowColor={tono === 'pendiente' ? '139, 143, 155' : undefined}>
      <div className="p-5 sm:p-6 flex gap-4">
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${tono === 'pendiente' ? 'bg-muted/10' : 'bg-coral/10'}`}>
          <Icono size={18} className={tono === 'pendiente' ? 'text-muted' : 'text-coral'} />
        </div>
        <div className="min-w-0">
          <p className="font-display font-semibold text-paper mb-1.5">{titulo}</p>
          <div className="text-sm leading-relaxed text-muted [&_strong]:text-paper [&_strong]:font-medium">{children}</div>
        </div>
      </div>
    </MagicBentoCard>
  )
}
