'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { MoreHorizontal, Download, Eye, Trash2, Sparkles } from 'lucide-react'
import { useMontado } from '@/lib/useMontado'
import { urlContenido } from '@/lib/archivos/api'
import type { Archivo } from '@/lib/archivos/tipos'

type Props = {
  archivo: Archivo
  onVerDetalle: () => void
  onAnalizar: () => void
  onEliminar: () => void
}

// Mismo patrón de overlay que PremiumSelect/DayDetailModal/NotificationBell:
// createPortal a document.body + posición calculada con
// getBoundingClientRect(). Se repite acá (en vez de abstraerlo) porque
// abstraer ese patrón es un refactor propio que tocaría 5 componentes ya
// verificados — está anotado como deuda técnica conocida en
// PROJECT_CONTEXT.md, no es algo que este sprint deba resolver de paso.
//
// `useMontado()` y no `typeof document !== 'undefined'`: ese guard causaba un
// desajuste de hidratación real en cada carga, corregido en la auditoría de
// cierre de Fase 1.
export default function MenuAcciones({ archivo, onVerDetalle, onAnalizar, onEliminar }: Props) {
  const montado = useMontado()
  const [abierto, setAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const botonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = () => setAbierto(false)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [abierto])

  function alternar(e: React.MouseEvent) {
    e.stopPropagation()
    const r = botonRef.current?.getBoundingClientRect()
    if (r) {
      // 200px es el ancho del menú; se abre hacia la izquierda del botón para
      // no salirse por el borde derecho de la ventana, que es donde vive
      // siempre esta columna.
      setPos({ top: r.bottom + 6, left: Math.max(8, r.right - 200) })
    }
    setConfirmando(false)
    setAbierto((v) => !v)
  }

  const puedeAnalizar = archivo.drive_file_id !== null

  return (
    <>
      <button
        ref={botonRef}
        onClick={alternar}
        aria-label={`Acciones para ${archivo.nombre}`}
        className="rounded-lg p-1.5 text-muted hover:text-paper hover:bg-panel-2 transition"
      >
        <MoreHorizontal size={16} />
      </button>

      {montado &&
        createPortal(
          <AnimatePresence>
            {abierto && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setAbierto(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  style={{ top: pos.top, left: pos.left, width: 200 }}
                  className="fixed z-[91] rounded-2xl bg-panel-glass backdrop-blur-xl shadow-2xl p-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Opcion
                    Icono={Eye}
                    label="Ver detalle"
                    onClick={() => {
                      setAbierto(false)
                      onVerDetalle()
                    }}
                  />
                  <a
                    href={urlContenido(archivo.id, 'descargar')}
                    onClick={() => setAbierto(false)}
                    className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-[13px] text-muted hover:text-paper hover:bg-panel-2 transition"
                  >
                    <Download size={14} className="shrink-0" />
                    Descargar
                  </a>
                  {puedeAnalizar && (
                    <Opcion
                      Icono={Sparkles}
                      label={archivo.analizado_en ? 'Volver a analizar' : 'Analizar con IA'}
                      onClick={() => {
                        setAbierto(false)
                        onAnalizar()
                      }}
                    />
                  )}

                  <div className="h-px bg-line my-1.5 mx-2" />

                  {/* Confirmación de dos toques, mismo criterio que
                      BotonConfirmacion (que no se reusa tal cual acá porque
                      su forma de píldora no encaja en una fila de menú). */}
                  <button
                    onClick={() => {
                      if (!confirmando) return setConfirmando(true)
                      setAbierto(false)
                      onEliminar()
                    }}
                    className={`flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-[13px] transition ${
                      confirmando ? 'bg-danger text-ink font-semibold' : 'text-danger hover:bg-danger/10'
                    }`}
                  >
                    <Trash2 size={14} className="shrink-0" />
                    {confirmando ? '¿Seguro? Toca de nuevo' : 'Eliminar'}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}

function Opcion({ Icono, label, onClick }: { Icono: typeof Eye; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-[13px] text-muted hover:text-paper hover:bg-panel-2 transition">
      <Icono size={14} className="shrink-0" />
      {label}
    </button>
  )
}
