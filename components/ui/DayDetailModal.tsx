'use client'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, Check, Trash2 } from 'lucide-react'
import type { Materia, Tarea } from '@/lib/types'

type Props = {
  fecha: string | null
  tareas: Tarea[]
  materias: Materia[]
  onClose: () => void
  onToggle: (id: string, actual: boolean) => void
  onDelete: (id: string) => void
}

export default function DayDetailModal({ fecha, tareas, materias, onClose, onToggle, onDelete }: Props) {
  if (typeof document === 'undefined') return null
  const materiaDe = (id: string) => materias.find((m) => m.id === id)
  const label = fecha
    ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return createPortal(
    <AnimatePresence>
      {fecha && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.97, y: 8, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[90vw] max-w-md max-h-[70vh] overflow-auto bg-panel-glass backdrop-blur-2xl rounded-2xl p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-base font-semibold text-paper capitalize">{label}</p>
              <button onClick={onClose} className="text-muted hover:text-paper transition">
                <X size={16} />
              </button>
            </div>

            {tareas.length === 0 ? (
              <p className="text-muted text-sm text-center py-8">No tienes tareas para este día ✨</p>
            ) : (
              <div className="flex flex-col gap-2">
                {tareas.map((t) => {
                  const m = materiaDe(t.materia_id)
                  const color = m?.color ?? '#5C7FA6'
                  return (
                    <div key={t.id} className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-panel-2 ${t.completada ? 'opacity-50' : ''}`}>
                      <button
                        onClick={() => onToggle(t.id, t.completada)}
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          boxShadow: t.completada ? 'none' : `inset 0 0 0 2px ${color}`,
                          backgroundColor: t.completada ? 'var(--color-success)' : 'transparent',
                        }}
                      >
                        {t.completada && <Check size={11} className="text-ink" strokeWidth={3} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm text-paper truncate ${t.completada ? 'line-through' : ''}`}>{t.titulo}</p>
                        <span className="text-[10px] font-mono text-muted">{m?.nombre ?? '—'}</span>
                      </div>
                      <button onClick={() => onDelete(t.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
