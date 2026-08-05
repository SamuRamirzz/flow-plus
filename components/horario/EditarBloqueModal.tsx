'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, Check, Trash2, Loader2 } from 'lucide-react'
import type { Materia } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import MateriaPicker, { MATERIA_NUEVA } from '@/components/ui/MateriaPicker'
import PremiumTimePicker from '@/components/ui/PremiumTimePicker'

export type CambiosBloqueEditado = {
  materiaId: string
  nuevaMateria: string
  horaInicio: string
  horaFin: string
  aula: string
  profesor: string
}

type Props = {
  /** El bloque en edición, o null si el modal está cerrado. */
  bloque: BloqueHorario | null
  materias: Materia[]
  guardando: boolean
  onGuardar: (cambios: CambiosBloqueEditado) => void
  onEliminar: () => void
  onCerrar: () => void
}

// Sub-sprint 8.2 — el "clic-para-editar" que quedó pendiente del Sprint 8.
// Mismo patrón que DayDetailModal (portal + backdrop + tarjeta centrada +
// spring): un modal centrado calza mejor que un popover anclado a la celda
// porque son 5 campos y la grilla en móvil ya vive apretada a un solo día.
export default function EditarBloqueModal({ bloque, materias, guardando, onGuardar, onEliminar, onCerrar }: Props) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {bloque && (
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
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[90vw] max-w-sm bg-panel-glass backdrop-blur-2xl rounded-2xl p-5 shadow-2xl"
          >
            {/* `key` fuerza un remount con estado fresco cada vez que se abre
                un bloque DISTINTO — sin esto, useState seguiría mostrando
                los valores del bloque anterior. */}
            <Formulario
              key={bloque.id}
              bloque={bloque}
              materias={materias}
              guardando={guardando}
              onGuardar={onGuardar}
              onEliminar={onEliminar}
              onCerrar={onCerrar}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

function Formulario({
  bloque,
  materias,
  guardando,
  onGuardar,
  onEliminar,
  onCerrar,
}: {
  bloque: BloqueHorario
  materias: Materia[]
  guardando: boolean
  onGuardar: (cambios: CambiosBloqueEditado) => void
  onEliminar: () => void
  onCerrar: () => void
}) {
  const [materiaId, setMateriaId] = useState(bloque.materiaId)
  const [nuevaMateria, setNuevaMateria] = useState('')
  const [horaInicio, setHoraInicio] = useState(bloque.horaInicio ?? '')
  const [horaFin, setHoraFin] = useState(bloque.horaFin ?? '')
  const [aula, setAula] = useState(bloque.aula ?? '')
  const [profesor, setProfesor] = useState(bloque.profesor ?? '')
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false)

  const puedeGuardar = materiaId !== MATERIA_NUEVA || nuevaMateria.trim().length > 0

  function guardar() {
    if (!puedeGuardar || guardando) return
    onGuardar({ materiaId, nuevaMateria: nuevaMateria.trim(), horaInicio, horaFin, aula: aula.trim(), profesor: profesor.trim() })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-base font-semibold text-paper">Editar clase</p>
        <button onClick={onCerrar} className="text-muted hover:text-paper transition" title="Cerrar">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MateriaPicker
            id="materia-editar-bloque"
            materias={materias}
            materiaId={materiaId}
            nuevaMateria={nuevaMateria}
            onMateriaIdChange={setMateriaId}
            onNuevaMateriaChange={setNuevaMateria}
          />
        </div>

        <div className="flex items-center gap-2.5">
          <PremiumTimePicker value={horaInicio} onChange={setHoraInicio} label="Hora de inicio" />
          <span className="text-muted text-xs">a</span>
          <PremiumTimePicker value={horaFin} onChange={setHoraFin} label="Hora de fin" />
        </div>

        <div className="flex items-center gap-2.5">
          <input
            value={aula}
            onChange={(e) => setAula(e.target.value)}
            placeholder="Aula"
            className="flex-1 min-w-0 bg-panel-glass backdrop-blur-md rounded-full px-3.5 py-2 text-xs text-paper placeholder:text-muted outline-none focus:ring-1 focus:ring-coral/60 transition"
          />
          <input
            value={profesor}
            onChange={(e) => setProfesor(e.target.value)}
            placeholder="Profesor"
            className="flex-1 min-w-0 bg-panel-glass backdrop-blur-md rounded-full px-3.5 py-2 text-xs text-paper placeholder:text-muted outline-none focus:ring-1 focus:ring-coral/60 transition"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-5">
        <button
          onClick={() => (confirmandoBorrar ? onEliminar() : setConfirmandoBorrar(true))}
          disabled={guardando}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-full transition disabled:opacity-50 ${
            confirmandoBorrar ? 'bg-danger text-ink' : 'text-muted hover:text-danger'
          }`}
        >
          <Trash2 size={13} />
          {confirmandoBorrar ? '¿Seguro? Borrar' : 'Eliminar'}
        </button>

        <button
          onClick={guardar}
          disabled={!puedeGuardar || guardando}
          className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full bg-coral text-ink hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Guardar
        </button>
      </div>
    </>
  )
}
