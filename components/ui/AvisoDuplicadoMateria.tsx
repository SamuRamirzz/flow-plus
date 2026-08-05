'use client'
import { useState } from 'react'
import { Merge, X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import type { PosibleDuplicadoMateria } from '@/lib/ai/agents/calendar'

type Props = {
  nombreNuevo: string
  aviso: PosibleDuplicadoMateria
  onFusionar: () => Promise<void>
  onDescartar: () => void
}

// Cierre de Fase 1 — la acción detrás del dedup semántico de CalendarAgent.
// Mismo lenguaje visual pasivo (coral, backdrop-blur, cero bordes duros)
// que ya usan los otros avisos de CalendarAgent (colisión, fecha
// implausible) vía notify() — pero ESTE no puede ser un toast: necesita
// sobrevivir más de 3.2s para que el usuario alcance a leer y decidir, y
// necesita dos botones. Por eso es un componente propio, no una llamada
// más a useToast().
//
// La prominencia (`aviso.autonomia`, ya resuelta por decidirAutonomia en
// el servidor) es la única diferencia visual entre los dos casos: confianza
// alta ('autonomo') usa el mismo brillo coral que ya "gana" contra el fondo
// negro puro (ver el ajuste de contraste de ShimmeringText, Sprint 11);
// confianza media ('requiere_revision') se ve más discreta — sin el glow,
// texto más chico — para no insistir de más en algo menos seguro.
export default function AvisoDuplicadoMateria({ nombreNuevo, aviso, onFusionar, onDescartar }: Props) {
  const [fusionando, setFusionando] = useState(false)
  const prominente = aviso.autonomia === 'autonomo'

  async function fusionar() {
    setFusionando(true)
    await onFusionar()
    setFusionando(false)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.35 }}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl backdrop-blur-xl mb-3"
        style={{
          backgroundColor: 'rgba(255, 107, 77, 0.12)',
          boxShadow: prominente ? '0 0 0 1px rgba(255,107,77,0.35), 0 0 24px -8px rgba(255,107,77,0.55)' : '0 0 0 1px rgba(255,107,77,0.2)',
        }}
      >
        <Merge size={prominente ? 15 : 13} className="text-coral flex-shrink-0" />
        <p className={`flex-1 min-w-0 text-paper ${prominente ? 'text-xs' : 'text-[11px] text-paper/80'}`}>
          «{nombreNuevo}» se parece a <span className="font-semibold">«{aviso.nombre}»</span>, que ya tenías. ¿Es la misma materia?
        </p>
        <button
          onClick={fusionar}
          disabled={fusionando}
          className="flex-shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full bg-coral text-ink hover:opacity-90 transition disabled:opacity-50 disabled:cursor-wait"
        >
          {fusionando ? 'Fusionando…' : `Fusionar con «${aviso.nombre}»`}
        </button>
        <button
          onClick={onDescartar}
          disabled={fusionando}
          title="Mantener separadas"
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-muted hover:text-paper hover:bg-panel-2/70 transition disabled:opacity-50"
        >
          <X size={13} />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
