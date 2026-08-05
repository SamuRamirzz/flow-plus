'use client'
import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { useMontado } from '@/lib/useMontado'

export type SelectOption = { id: string; label: string; color?: string; icon?: ReactNode }

type Props = {
  id: string
  options: SelectOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

export default function PremiumSelect({ id, options, value, onChange, placeholder = 'Seleccionar' }: Props) {
  const montado = useMontado()
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.id === value)

  useEffect(() => {
    function place() {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, left: r.left, width: r.width })
    }
    if (open) {
      place()
      window.addEventListener('scroll', place, true)
      window.addEventListener('resize', place)
      return () => {
        window.removeEventListener('scroll', place, true)
        window.removeEventListener('resize', place)
      }
    }
  }, [open])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Cierre de fase — antes esto era un useEffect sobre [open, value, options]
  // que llamaba a setHighlight en cuanto `open` pasaba a true; era uno de los
  // errores de react-hooks/set-state-in-effect que el proyecto arrastraba
  // desde antes de los sprints de IA. La causa de que la lista se resalte no
  // es "open cambió", es "el usuario la abrió" — un evento concreto — así que
  // el estado se calcula ahí y el efecto desaparece (el patrón de
  // react.dev/learn/you-might-not-need-an-effect).
  function abrir() {
    setHighlight(Math.max(0, options.findIndex((o) => o.id === value)))
    setOpen(true)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); abrir() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(options.length - 1, h + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); onChange(options[highlight].id); setOpen(false) }
  }

  return (
    <div onKeyDown={onKeyDown}>
      <motion.button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : abrir())}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 bg-panel-glass backdrop-blur-md border border-line rounded-full pl-3 pr-2.5 py-2 text-xs text-paper outline-none transition focus-visible:ring-2 focus-visible:ring-coral/50"
      >
        {selected?.icon ? (
          <span className="flex-shrink-0 text-muted">{selected.icon}</span>
        ) : (
          selected?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selected.color }} />
        )}
        <span className="whitespace-nowrap">{selected?.label ?? placeholder}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={12} className="text-muted" />
        </motion.span>
      </motion.button>

      {montado && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              role="listbox"
              initial={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.97, y: 6, filter: 'blur(6px)' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
              // Bug real encontrado en la auditoría de cierre de Fase 1: sin
              // tope de altura ni scroll, con suficientes opciones (34
              // materias reales en esta cuenta hoy) el panel medía 1236px
              // de alto contra un viewport de 900px — "+ Nueva materia…"
              // (siempre la ÚLTIMA opción, ver MateriaPicker.tsx) quedaba
              // fuera de la pantalla y, al ser `position: fixed`, no había
              // scroll de página que lo alcanzara: literalmente
              // imposible de seleccionar con el mouse. `max-h` + overflow
              // interno es el mismo patrón que ya usan TaskListPanel
              // (max-h-[55vh]) y NotificationBell (max-h-96) para esto.
              style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 190), maxHeight: 'min(60vh, 22rem)' }}
              className="bg-panel-glass backdrop-blur-2xl border border-line/60 rounded-2xl p-1.5 shadow-2xl z-[100] origin-top overflow-y-auto"
            >
              {options.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => { onChange(o.id); setOpen(false) }}
                  className="relative w-full flex items-center gap-2 text-left text-xs text-paper px-3 py-2.5 rounded-xl"
                >
                  {highlight === i && (
                    <motion.span
                      layoutId={`premium-select-highlight-${id}`}
                      className="absolute inset-0 bg-coral/15 rounded-xl"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2 flex-1">
                    {o.icon ? (
                      <span className="flex-shrink-0 text-muted">{o.icon}</span>
                    ) : (
                      o.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />
                    )}
                    {o.label}
                  </span>
                  {o.id === value && <span className="relative w-1.5 h-1.5 rounded-full bg-coral flex-shrink-0" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
