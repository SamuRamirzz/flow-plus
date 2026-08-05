'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Clock } from 'lucide-react'
import { useMontado } from '@/lib/useMontado'
import { usePreferencias } from '@/lib/preferencias'
import { formatearHora } from '@/lib/hora'

type Props = {
  value: string // 'HH:MM' 24h, o '' sin hora
  onChange: (v: string) => void
  label: string // para aria-label del disparador — "Hora de inicio" / "Hora de fin"
}

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
// Incrementos de 15 min: alcanza para un horario de clases real (el
// horario de referencia del proyecto solo usa horas en punto) sin ser una
// lista de 60 filas por scrollear. Si un bloque ya guardado tiene un minuto
// fuera de esta grilla (ej. importado de una foto con una hora rara), se
// agrega como opción extra más abajo — nunca se le fuerza un valor distinto
// al que ya tenía.
const MINUTOS_BASE = ['00', '15', '30', '45']

function partes(v: string): { hora: string; minuto: string } {
  const m = /^(\d{2}):(\d{2})$/.exec(v)
  return m ? { hora: m[1], minuto: m[2] } : { hora: '', minuto: '' }
}

// Sub-sprint 8.3 — reemplaza el <input type="time"> nativo (dos columnas
// scrolleables sin ningún tratamiento visual propio) en EditarBloqueModal.
// Mismo patrón de PremiumDatePicker (portal + posición manual + spring),
// pero con una estructura distinta a propósito: una fecha es una sola
// elección (un día en un calendario), una hora son DOS elecciones
// independientes (hora y minuto) — dos columnas scrolleables comunican eso
// mejor que replicar la grilla de un calendario.
export default function PremiumTimePicker({ value, onChange, label }: Props) {
  const montado = useMontado()
  const { formatoReloj } = usePreferencias()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const horaRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const minutoRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const actual = partes(value)
  const minutos = MINUTOS_BASE.includes(actual.minuto) || !actual.minuto ? MINUTOS_BASE : [...MINUTOS_BASE, actual.minuto].sort()

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

  // Al abrir, la hora/minuto ya elegidos quedan a la vista sin que el
  // usuario tenga que scrollear a ciegas a buscarlos.
  useEffect(() => {
    if (!open) return
    horaRefs.current[actual.hora]?.scrollIntoView({ block: 'nearest' })
    minutoRefs.current[actual.minuto]?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function elegirHora(h: string) {
    onChange(`${h}:${actual.minuto || '00'}`)
  }
  function elegirMinuto(m: string) {
    onChange(`${actual.hora || '00'}:${m}`)
  }

  return (
    <>
      <motion.button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        aria-label={label}
        className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-panel-glass backdrop-blur-md rounded-full px-3.5 py-2 text-xs text-paper outline-none focus-visible:ring-1 focus-visible:ring-coral/60 transition"
      >
        <Clock size={12} className="text-muted flex-shrink-0" />
        {/* Solo el texto YA ELEGIDO se formatea con la preferencia — las
            columnas internas del panel (HORAS/minutos, más abajo) se
            quedan en 24h siempre: son un selector de valor, no una vista
            de lectura, y onChange sigue emitiendo 'HH:MM' 24h sin cambios
            en su contrato. */}
        <span className="font-mono tabular-nums">{value ? formatearHora(value, formatoReloj) : '--:--'}</span>
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
              className="w-44 bg-panel-glass backdrop-blur-2xl border border-line/60 rounded-2xl p-2 shadow-2xl z-[100] origin-top-left"
            >
              <div className="flex gap-1.5">
                <div className="flex-1 h-40 overflow-y-auto flex flex-col gap-0.5">
                  {HORAS.map((h) => (
                    <button
                      key={h}
                      ref={(el) => { horaRefs.current[h] = el }}
                      onClick={() => elegirHora(h)}
                      className={`w-full text-center text-[11px] font-mono tabular-nums py-1.5 rounded-lg transition ${
                        h === actual.hora ? 'bg-coral text-ink font-semibold' : 'text-paper hover:bg-panel-2'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <div className="flex-1 h-40 overflow-y-auto flex flex-col gap-0.5">
                  {minutos.map((m) => (
                    <button
                      key={m}
                      ref={(el) => { minutoRefs.current[m] = el }}
                      onClick={() => elegirMinuto(m)}
                      className={`w-full text-center text-[11px] font-mono tabular-nums py-1.5 rounded-lg transition ${
                        m === actual.minuto ? 'bg-coral text-ink font-semibold' : 'text-paper hover:bg-panel-2'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2 mt-2">
                <button onClick={() => { onChange(''); setOpen(false) }} className="text-[11px] text-muted hover:text-danger transition">
                  Borrar
                </button>
                <button onClick={() => setOpen(false)} className="text-[11px] text-coral hover:underline">
                  Listo
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
