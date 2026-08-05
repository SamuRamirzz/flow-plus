'use client'

import { motion } from 'motion/react'
import { Loader2, Check, X, ImageIcon, AlertCircle, BookPlus } from 'lucide-react'
import type { Materia } from '@/lib/types'
import { detectarMateriasNuevas, type DiffHorario } from '@/lib/horario/diff'
import type { ClassScheduleAgentOutput } from '@/lib/ai/agents/classSchedule'
import { usePreferencias } from '@/lib/preferencias'
import DiffResumenLista from './DiffResumenLista'

type Props = {
  salida: ClassScheduleAgentOutput
  diff: DiffHorario
  materias: Materia[]
  guardando: boolean
  onConfirmar: () => void
  onDescartar: () => void
}

// Lista de cambios detectados por la foto, ANTES de escribir nada. No es un
// overlay inmersivo como el de /ai: subir una foto y revisarla es una
// interacción corta y lineal, no una conversación — replicar aquella
// coreografía sería ruido. Mismos tokens y cero bordes duros, como el resto.
export default function PropuestaFoto({ salida, diff, materias, guardando, onConfirmar, onDescartar }: Props) {
  const { formatoReloj } = usePreferencias()

  // La imagen no era un horario legible: no hay nada que confirmar, solo
  // explicar. Se distingue del error de sistema — es una foto que hay que
  // repetir, no un fallo de la app.
  if (salida.tipoRespuesta !== 'bloques') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-panel-glass backdrop-blur-xl p-5 mb-6">
        <div className="flex items-start gap-2.5">
          <AlertCircle size={16} className="text-coral mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-paper">
              {salida.mensaje ??
                (salida.tipoRespuesta === 'no_es_horario'
                  ? 'Esa imagen no parece un horario de clases.'
                  : 'No pude leer bien ese horario — prueba con una foto más nítida o de frente.')}
            </p>
          </div>
          <button onClick={onDescartar} className="text-muted hover:text-paper transition p-1 flex-shrink-0" title="Cerrar">
            <X size={15} />
          </button>
        </div>
      </motion.div>
    )
  }

  const total = diff.agregados.length + diff.movidos.length + diff.eliminados.length
  const materiasNuevas = detectarMateriasNuevas(diff.agregados, materias)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-panel-glass backdrop-blur-xl p-5 mb-6">
      <div className="flex items-start gap-2.5 mb-4">
        <ImageIcon size={16} className="text-coral mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-display text-sm font-semibold text-paper">
            Leí {salida.bloques.length} {salida.bloques.length === 1 ? 'bloque' : 'bloques'} en la foto
          </p>
          <p className="text-muted text-xs mt-0.5">
            {total === 0
              ? 'Coincide con el horario que ya tienes guardado — no hay nada que cambiar.'
              : 'Revisa los cambios antes de guardarlos. Puedes editar cualquier bloque después en la grilla.'}
          </p>
        </div>
        <button onClick={onDescartar} className="text-muted hover:text-paper transition p-1 flex-shrink-0" title="Descartar">
          <X size={15} />
        </button>
      </div>

      {total > 0 && (
        <div className="mb-4">
          <DiffResumenLista diff={diff} formato={formatoReloj} />
        </div>
      )}

      {/* Informativo, no una puerta: el botón de abajo ya es la
          confirmación. Esto solo hace visible una consecuencia que antes
          quedaba implícita en la lista de bloques — que crear/fusionar
          materias ya pasa automático (resolverOCrearMateria, con ícono y
          dedup) no significa que deba pasar en silencio. */}
      {materiasNuevas.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-coral/10 mb-4 text-xs">
          <BookPlus size={13} className="text-coral flex-shrink-0 mt-0.5" />
          <p className="text-paper/90">
            Esto también creará {materiasNuevas.length} {materiasNuevas.length === 1 ? 'materia nueva' : 'materias nuevas'}:{' '}
            <span className="text-paper font-medium">{materiasNuevas.join(', ')}</span>
          </p>
        </div>
      )}

      {(diff.agregados.length > 0 || diff.movidos.length > 0) && (
        <button
          onClick={onConfirmar}
          disabled={guardando}
          className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full bg-coral text-ink hover:opacity-90 transition disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Guardar {diff.agregados.length + diff.movidos.length}{' '}
          {diff.agregados.length + diff.movidos.length === 1 ? 'bloque' : 'bloques'}
        </button>
      )}
    </motion.div>
  )
}
