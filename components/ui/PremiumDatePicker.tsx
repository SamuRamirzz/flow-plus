'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMontado } from '@/lib/useMontado'

type Props = {
  value: string
  onChange: (v: string) => void
  // Fecha inferida por horario (Sprint 7) para mostrar como sugerencia
  // MIENTRAS `value` sigue vacío — nunca se escribe en el estado del
  // padre por su cuenta. Si el usuario elige una fecha, `value` deja de
  // estar vacío y la sugerencia desaparece sola.
  sugerencia?: string
}

export default function PremiumDatePicker({ value, onChange, sugerencia }: Props) {
  const montado = useMontado()
  const mostrandoSugerencia = !value && !!sugerencia
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [mesOffset, setMesOffset] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function place() {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, left: r.left })
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

  const base = new Date()
  const vista = new Date(base.getFullYear(), base.getMonth() + mesOffset, 1)
  const anio = vista.getFullYear()
  const mes = vista.getMonth()
  const offsetDia = (vista.getDay() + 6) % 7
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const nombreMes = vista.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const celdas: (number | null)[] = [...Array(offsetDia).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)]

  function fechaStr(dia: number) {
    return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  const fechaAMostrar = value || (mostrandoSugerencia ? sugerencia! : '')
  const label = fechaAMostrar ? new Date(fechaAMostrar + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'Fecha'

  return (
    <>
      <motion.button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        title={mostrandoSugerencia ? 'Fecha sugerida según tu horario — elige otra si quieres cambiarla' : undefined}
        className={`flex items-center gap-1.5 bg-panel-glass backdrop-blur-md border border-line rounded-full pl-3 pr-3 py-2 text-xs outline-none transition ${
          mostrandoSugerencia ? 'text-coral' : 'text-paper'
        }`}
      >
        <Calendar size={12} className={mostrandoSugerencia ? 'text-coral' : 'text-muted'} />
        {label}
      </motion.button>

      {montado && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.97, y: 6, filter: 'blur(6px)' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
              style={{ position: 'fixed', top: pos.top, left: pos.left }}
              className="w-64 bg-panel-glass backdrop-blur-2xl border border-line/60 rounded-2xl p-3 shadow-2xl z-[100] origin-top-left"
            >
              <div className="flex items-center justify-between mb-2.5">
                <p className="font-display text-xs font-semibold text-paper capitalize">{nombreMes}</p>
                <div className="flex gap-1">
                  <button onClick={() => setMesOffset((o) => o - 1)} className="w-5 h-5 flex items-center justify-center text-muted hover:text-coral transition">
                    <ChevronLeft size={13} />
                  </button>
                  <button onClick={() => setMesOffset((o) => o + 1)} className="w-5 h-5 flex items-center justify-center text-muted hover:text-coral transition">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                  <div key={d} className="text-center text-[9px] text-muted font-mono">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {celdas.map((dia, i) => {
                  if (dia === null) return <div key={`e-${i}`} />
                  const f = fechaStr(dia)
                  const activo = value === f
                  return (
                    <button
                      key={f}
                      onClick={() => { onChange(f); setOpen(false) }}
                      className={`w-7 h-7 rounded-full text-[11px] font-mono transition ${activo ? 'bg-coral text-ink font-semibold' : 'text-paper hover:bg-panel-2'}`}
                    >
                      {dia}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2">
                <button onClick={() => { onChange(''); setOpen(false) }} className="text-[11px] text-muted hover:text-danger transition">Borrar</button>
                <button
                  onClick={() => { onChange(new Date().toISOString().slice(0, 10)); setOpen(false) }}
                  className="text-[11px] text-coral hover:underline"
                >
                  Hoy
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
