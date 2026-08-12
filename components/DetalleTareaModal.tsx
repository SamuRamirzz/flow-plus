'use client'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { useMontado } from '@/lib/useMontado'
import type { Tarea } from '@/lib/types'
import SeccionNotas from '@/components/notas/SeccionNotas'

type Props = {
  /** La tarea en detalle, o null si el modal está cerrado. */
  tarea: Tarea | null
  materiaNombre: string
  onCerrar: () => void
}

// Sprint Sistema de Notas Unificado — primer "detalle de tarea" real del
// proyecto: hasta ahora /agenda solo tenía edición inline del título
// (TaskRow) y DayDetailModal (lista de un día, sin detalle individual).
// Mismo patrón que EditarBloqueModal (horario): portal + backdrop + tarjeta
// centrada con spring. Se abre desde un botón nuevo en TaskRow (ícono
// StickyNote), sin robarle el clic al título (que sigue editando inline) ni
// al checkbox/borrar.
//
// Si la tarea es un examen (tipo === 'examen'), se muestran temario/
// formato/peso si existen — mismo contenido que ya vive en la fila, ahora
// visible en un solo lugar junto con sus notas. Sin rótulo especial: el
// encargo confirma que no hace falta, el contexto ya lo deja claro.
export default function DetalleTareaModal({ tarea, materiaNombre, onCerrar }: Props) {
  const montado = useMontado()
  if (!montado) return null

  return createPortal(
    <AnimatePresence>
      {tarea && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCerrar}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.97, y: 8, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[90vw] max-w-md bg-panel-glass backdrop-blur-2xl rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            {/* `key` fuerza remount con estado fresco al cambiar de tarea —
                mismo motivo que EditarBloqueModal: sin esto, SeccionNotas
                seguiría mostrando las notas de la tarea anterior un
                instante antes de que su propio efecto recargue. */}
            <Contenido key={tarea.id} tarea={tarea} materiaNombre={materiaNombre} onCerrar={onCerrar} />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

function Contenido({ tarea, materiaNombre, onCerrar }: { tarea: Tarea; materiaNombre: string; onCerrar: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="font-display text-base font-semibold text-paper leading-snug">{tarea.titulo}</p>
        <button onClick={onCerrar} className="text-muted hover:text-paper transition flex-shrink-0" title="Cerrar">
          <X size={16} />
        </button>
      </div>
      <p className="text-xs text-muted mb-4">{materiaNombre}</p>

      {tarea.tipo === 'examen' && (tarea.temario || tarea.formato || tarea.peso !== null) && (
        <div className="rounded-xl bg-panel-2/40 px-3 py-2.5 mb-2 flex flex-col gap-1 text-[12px]">
          {tarea.temario && (
            <p className="text-muted">
              <span className="text-paper font-medium">Temario:</span> {tarea.temario}
            </p>
          )}
          {tarea.formato && (
            <p className="text-muted">
              <span className="text-paper font-medium">Formato:</span> {tarea.formato}
            </p>
          )}
          {tarea.peso !== null && (
            <p className="text-muted">
              <span className="text-paper font-medium">Vale:</span> {tarea.peso}% de la nota
            </p>
          )}
        </div>
      )}

      <SeccionNotas ancla={{ tipo: 'tarea', id: tarea.id }} mensajeVacio="Aún no hay notas en esta tarea." />
    </>
  )
}
