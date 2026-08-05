'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Check, X } from 'lucide-react'
import { useMontado } from './useMontado'

type ToastItem = { id: string; mensaje: string; exito: boolean }
type ToastContextType = { notify: (mensaje: string, exito?: boolean) => void }

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const montado = useMontado()

  const notify = useCallback((mensaje: string, exito: boolean = true) => {
    const id = 'toast-' + Date.now() + Math.random().toString(36).slice(2, 6)
    setToasts((t) => [...t, { id, mensaje, exito }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 3200)
  }, [])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {montado && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col-reverse gap-2 items-center pointer-events-none">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                // Sin fade: solo se desliza desde fuera de la pantalla (abajo)
                // hacia su posición, y al salir vuelve a deslizarse hacia
                // abajo — la opacidad se mantiene en 1 todo el tiempo.
                initial={{ y: 90 }}
                animate={{ y: 0 }}
                exit={{ y: 90 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="flex items-center gap-2.5 bg-panel-glass backdrop-blur-2xl rounded-full pl-1.5 pr-4 py-1.5 shadow-2xl pointer-events-auto"
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: t.exito ? 'var(--color-success)' : 'var(--color-danger)' }}
                >
                  {t.exito ? <Check size={13} className="text-ink" strokeWidth={3} /> : <X size={13} className="text-ink" strokeWidth={3} />}
                </span>
                <span className="text-xs text-paper font-medium whitespace-nowrap">{t.mensaje}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}
