'use client'

import { useRef } from 'react'
import { motion } from 'motion/react'
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import MagicBentoCard from '@/components/reactbits/MagicBento'
import type { ActividadIA as Actividad } from '@/lib/archivos/tipos'
import { formatearRelativo } from '@/lib/archivos/formato'
import IconoArchivo from './IconoArchivo'

type Props = {
  actividad: Actividad[]
  onAbrir: (archivoId: string) => void
}

// Franja inferior "Actividad de IA reciente" — carrusel horizontal de
// GlowCards (MagicBentoCard), como pide la referencia.
//
// La fuente es `GET /api/archivos/actividad`, que consulta la tabla
// `archivos` por `analizado_en`, NO `ai_events`. Esa decisión está
// documentada en el propio endpoint: `ai_events` registra ejecuciones de
// agentes con payload genérico, sin relación con filas de `archivos` — sirve
// para depurar el pipeline, no para contarle al usuario qué hizo la IA con
// SUS archivos. Las etiquetas ("3 tareas detectadas") también vienen ya
// derivadas del servidor, para que no haya dos fuentes de verdad con la
// columna "IA" de la tabla.
//
// Si no hay nada analizado todavía, la franja NO se muestra: una franja vacía
// que dice "aún no hay actividad" ocuparía espacio permanente para no decir
// nada. Lo maneja el llamador.
export default function ActividadIA({ actividad, onAbrir }: Props) {
  const carrilRef = useRef<HTMLDivElement>(null)

  function desplazar(direccion: -1 | 1) {
    carrilRef.current?.scrollBy({ left: direccion * 320, behavior: 'smooth' })
  }

  return (
    <section className="rounded-3xl bg-panel-glass backdrop-blur-md p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="flex items-center gap-2 text-sm font-display font-semibold text-paper">
          <Sparkles size={15} className="text-coral" />
          Actividad de IA reciente
        </h2>
        <div className="flex items-center gap-1">
          {(
            [
              [-1, ChevronLeft, 'Ver anteriores'],
              [1, ChevronRight, 'Ver siguientes'],
            ] as const
          ).map(([dir, Icono, label]) => (
            <button key={label} onClick={() => desplazar(dir)} aria-label={label} className="rounded-lg p-1.5 text-muted hover:text-paper hover:bg-panel-2 transition">
              <Icono size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* `snap` para que las tarjetas no queden cortadas a la mitad al soltar
          el scroll táctil, que es como se navega esto en móvil. */}
      <div ref={carrilRef} className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1">
        {actividad.map((a, i) => (
          <motion.button
            key={a.archivoId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
            onClick={() => onAbrir(a.archivoId)}
            className="snap-start shrink-0 w-[15rem] text-left"
          >
            <MagicBentoCard className="h-full">
              <div className="p-3.5">
                <div className="flex items-start gap-2.5 mb-2.5">
                  <IconoArchivo mimeType={a.mimeType} nombre={a.nombre} tam={30} />
                  <p className="text-[12px] font-medium text-paper leading-snug line-clamp-2 min-w-0">{a.nombre}</p>
                </div>
                <p className="text-[11px] text-coral mb-1.5">{a.etiqueta}</p>
                <p className="text-[10px] text-muted">{formatearRelativo(a.analizadoEn, new Date())}</p>
              </div>
            </MagicBentoCard>
          </motion.button>
        ))}
      </div>
    </section>
  )
}
