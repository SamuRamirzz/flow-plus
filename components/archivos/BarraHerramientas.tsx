'use client'

import { useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, LayoutList, LayoutGrid, Plus, Sparkles, X } from 'lucide-react'
import { CHIPS, pareceUnaPregunta, type ChipFiltro } from '@/lib/archivos/formato'
import type { VistaArchivos } from '@/lib/archivos/tipos'

type Props = {
  busqueda: string
  onBusqueda: (v: string) => void
  chip: ChipFiltro
  onChip: (c: ChipFiltro) => void
  vista: VistaArchivos
  onVista: (v: VistaArchivos) => void
  onSubir: () => void
  onPreguntarIA: (texto: string) => void
  subiendo: boolean
}

export default function BarraHerramientas({ busqueda, onBusqueda, chip, onChip, vista, onVista, onSubir, onPreguntarIA, subiendo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const esPregunta = pareceUnaPregunta(busqueda)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        {/* Buscador */}
        <div className="relative flex-1 min-w-0 basis-full sm:basis-auto">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            ref={inputRef}
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && esPregunta) onPreguntarIA(busqueda)
              if (e.key === 'Escape') onBusqueda('')
            }}
            placeholder="Buscar por nombre o preguntar a la IA…"
            className="w-full rounded-2xl bg-panel-glass backdrop-blur-md pl-11 pr-11 py-3 text-sm text-paper placeholder:text-muted/60 outline-none focus:ring-1 focus:ring-coral/50 transition"
          />
          {busqueda.length > 0 && (
            <button
              onClick={() => {
                onBusqueda('')
                inputRef.current?.focus()
              }}
              aria-label="Limpiar búsqueda"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-paper transition"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Toggle lista/grid */}
        <div className="flex items-center gap-0.5 rounded-2xl bg-panel-glass backdrop-blur-md p-1 shrink-0">
          {(
            [
              { id: 'lista' as const, Icono: LayoutList, label: 'Vista de lista' },
              { id: 'grid' as const, Icono: LayoutGrid, label: 'Vista de cuadrícula' },
            ] satisfies { id: VistaArchivos; Icono: typeof LayoutList; label: string }[]
          ).map(({ id, Icono, label }) => (
            <button
              key={id}
              onClick={() => onVista(id)}
              aria-label={label}
              aria-pressed={vista === id}
              className={`relative rounded-xl px-2.5 py-2 transition ${vista === id ? 'text-paper' : 'text-muted hover:text-paper'}`}
            >
              {vista === id && <motion.span layoutId="vista-activa" className="absolute inset-0 rounded-xl bg-panel-2" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
              <Icono size={16} className="relative" />
            </button>
          ))}
        </div>

        {/* Subir archivo */}
        <motion.button
          onClick={onSubir}
          disabled={subiendo}
          whileHover={subiendo ? undefined : { scale: 1.02 }}
          whileTap={subiendo ? undefined : { scale: 0.97 }}
          className="shrink-0 flex items-center gap-2 rounded-2xl bg-coral px-4 sm:px-5 py-3 text-sm font-semibold text-ink transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{subiendo ? 'Subiendo…' : 'Subir archivo'}</span>
        </motion.button>
      </div>

      {/* Atajo a la IA — aparece solo cuando lo escrito parece una pregunta y
          NUNCA reemplaza el filtrado de la tabla, que sigue corriendo debajo.
          Es una oferta, no un cambio de modo: si el usuario de verdad estaba
          buscando un archivo con un nombre largo, no perdió nada. */}
      <AnimatePresence initial={false}>
        {esPregunta && (
          <motion.button
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onPreguntarIA(busqueda)}
            className="overflow-hidden text-left"
          >
            <span className="flex items-center gap-2.5 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-paper hover:bg-coral/15 transition w-full">
              <Sparkles size={15} className="text-coral shrink-0" />
              <span className="min-w-0 truncate">
                Preguntarle esto a la IA: <span className="text-muted">“{busqueda}”</span>
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chips de tipo */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            onClick={() => onChip(c.id)}
            className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              chip === c.id ? 'text-ink' : 'text-muted hover:text-paper bg-panel-glass backdrop-blur-md'
            }`}
          >
            {chip === c.id && <motion.span layoutId="chip-activo" className="absolute inset-0 rounded-full bg-coral" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
            <span className="relative">{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
