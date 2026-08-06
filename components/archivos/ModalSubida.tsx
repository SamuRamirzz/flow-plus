'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, UploadCloud, Sparkles, AlertTriangle, Loader2 } from 'lucide-react'
import { useMontado } from '@/lib/useMontado'
import type { Materia } from '@/lib/types'
import type { ProgresoSubida } from '@/lib/archivos/api'
import { formatearTamano, sePuedePrevisualizar } from '@/lib/archivos/formato'
import IconoArchivo from './IconoArchivo'

// Tope real del bucket `archivos-staging` (50 MB, migración 20260809000200).
// Se comprueba en el CLIENTE además de en el servidor para no hacer esperar
// al usuario una subida completa que ya se sabe que va a fallar.
const MAX_BYTES = 50 * 1024 * 1024

const ETIQUETA_FASE: Record<ProgresoSubida['fase'], string> = {
  preparando: 'Preparando…',
  subiendo: 'Subiendo archivo…',
  registrando: 'Guardando en tu Drive…',
  analizando: 'Analizando con IA…',
}

type Props = {
  abierto: boolean
  archivo: File | null
  materias: Materia[]
  progreso: ProgresoSubida | null
  error: string | null
  onCerrar: () => void
  onConfirmar: (materiaId: string | null, analizar: boolean) => void
}

export default function ModalSubida({ abierto, archivo, materias, progreso, error, onCerrar, onConfirmar }: Props) {
  const montado = useMontado()
  const [materiaId, setMateriaId] = useState<string | null>(null)
  const [analizar, setAnalizar] = useState(true)

  if (!montado) return null

  const subiendo = progreso !== null
  const demasiadoGrande = archivo !== null && archivo.size > MAX_BYTES
  // El análisis solo se ofrece si el formato se puede leer de verdad — misma
  // política que `politicaDeAnalisis` en el servidor. Ofrecerlo para un .docx
  // sería prometer algo que va a fallar con un 422.
  const analizable = archivo !== null && sePuedePrevisualizar(archivo.type, archivo.name)

  return createPortal(
    <AnimatePresence>
      {abierto && archivo && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={subiendo ? undefined : onCerrar}
            className="fixed inset-0 z-[100] bg-ink/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            role="dialog"
            aria-label="Subir archivo"
            className="fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(28rem,calc(100vw-2rem))] rounded-3xl bg-panel-glass backdrop-blur-xl shadow-2xl p-5"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-display font-semibold text-paper flex items-center gap-2">
                <UploadCloud size={17} className="text-coral" />
                Subir archivo
              </h2>
              {!subiendo && (
                <button onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-muted hover:text-paper hover:bg-panel-2 transition">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-panel-2/60 p-3 mb-4">
              <IconoArchivo mimeType={archivo.type} nombre={archivo.name} tam={38} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-paper truncate">{archivo.name}</p>
                <p className="text-[11px] text-muted mt-0.5">{formatearTamano(archivo.size)}</p>
              </div>
            </div>

            {demasiadoGrande ? (
              <Aviso tono="error">
                Este archivo pesa {formatearTamano(archivo.size)} y el límite actual es de 50 MB. Subir archivos más grandes necesita <em>upload resumable</em>, que todavía no
                está construido.
              </Aviso>
            ) : subiendo ? (
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="flex items-center gap-2 text-[12px] text-paper">
                    <Loader2 size={13} className="animate-spin text-coral" />
                    {ETIQUETA_FASE[progreso.fase]}
                  </span>
                  {progreso.fase === 'subiendo' && <span className="text-[11px] font-mono text-muted tabular-nums">{Math.round(progreso.porcentaje)}%</span>}
                </div>
                <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-coral"
                    animate={{ width: progreso.fase === 'subiendo' ? `${progreso.porcentaje}%` : '100%' }}
                    transition={{ duration: 0.25, ease: 'linear' }}
                  />
                </div>
                {/* Fases posteriores a la transferencia: el porcentaje real de
                    bytes ya llegó a 100 y lo que falta es trabajo del servidor
                    (Drive, Gemini) sin progreso observable. Se dice, en vez de
                    fingir una barra que sigue avanzando sola. */}
                {progreso.fase !== 'subiendo' && <p className="mt-2 text-[10px] text-muted leading-relaxed">Esto puede tardar unos segundos.</p>}
              </div>
            ) : (
              <>
                <label className="block text-[11px] font-medium text-muted mb-1.5">Materia (opcional)</label>
                <select
                  value={materiaId ?? ''}
                  onChange={(e) => setMateriaId(e.target.value === '' ? null : e.target.value)}
                  className="w-full rounded-xl bg-panel-2/60 px-3 py-2.5 text-[13px] text-paper outline-none focus:ring-1 focus:ring-coral/50 transition mb-4"
                >
                  <option value="">Sin materia</option>
                  {materias.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => analizable && setAnalizar((v) => !v)}
                  disabled={!analizable}
                  className={`w-full flex items-start gap-2.5 rounded-2xl p-3 text-left transition mb-4 ${
                    analizable ? (analizar ? 'bg-coral/12' : 'bg-panel-2/60 hover:bg-panel-2') : 'bg-panel-2/40 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Sparkles size={14} className={`mt-0.5 shrink-0 ${analizar && analizable ? 'text-coral' : 'text-muted'}`} />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium text-paper">Analizar con IA al subir</span>
                    <span className="block text-[11px] text-muted leading-relaxed mt-0.5">
                      {analizable ? 'Genera un resumen y detecta tareas dentro del documento.' : 'Este formato todavía no se puede analizar automáticamente.'}
                    </span>
                  </span>
                </button>

                <motion.button
                  onClick={() => onConfirmar(materiaId, analizar && analizable)}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full rounded-2xl bg-coral py-3 text-sm font-semibold text-ink transition cursor-pointer"
                >
                  Subir a mi Drive
                </motion.button>
              </>
            )}

            {error && (
              <div className="mt-3">
                <Aviso tono="error">{error}</Aviso>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

function Aviso({ tono, children }: { tono: 'error'; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl p-3 ${tono === 'error' ? 'bg-danger/10' : 'bg-coral/10'}`}>
      <AlertTriangle size={14} className="text-danger mt-0.5 shrink-0" />
      <p className="text-[11px] leading-relaxed text-muted">{children}</p>
    </div>
  )
}
