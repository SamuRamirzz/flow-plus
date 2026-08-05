'use client'
import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Loader2, Check, X, ImageIcon, GitMerge, RotateCcw, BookPlus } from 'lucide-react'
import type { Materia } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import { detectarConflictosFusion, type DecisionConflicto } from '@/lib/horario/conflictos'
import { detectarMateriasNuevas, type DiffHorario } from '@/lib/horario/diff'
import type { ClassScheduleAgentOutput } from '@/lib/ai/agents/classSchedule'
import { usePreferencias } from '@/lib/preferencias'
import BotonConfirmacion from '@/components/ui/BotonConfirmacion'
import DiffResumenLista, { NOMBRE_DIA, rango } from './DiffResumenLista'

type Props = {
  /** El padre (app/horario/page.tsx) solo renderiza esto cuando tipoRespuesta === 'bloques'. */
  salida: ClassScheduleAgentOutput
  diff: DiffHorario
  bloquesActuales: BloqueHorario[]
  materias: Materia[]
  aplicando: boolean
  onReemplazarTodo: () => void
  onDescartar: () => void
  onFusionar: (decisiones: Record<string, DecisionConflicto>) => void
}

// Sub-sprint 8.2 — se muestra en vez de PropuestaFoto cuando el usuario
// importa una foto y YA tiene un horario guardado: acá no hay un único
// camino obvio ("guardar lo que cambió"), hay tres, y fusionar además puede
// necesitar que la persona decida franja por franja. PropuestaFoto se
// queda intacto para el caso simple (horario vacío o sin cambios).
export default function ResolverImportacion({ salida, diff, bloquesActuales, materias, aplicando, onReemplazarTodo, onDescartar, onFusionar }: Props) {
  const { formatoReloj } = usePreferencias()
  const [paso, setPaso] = useState<'elegir' | 'conflictos'>('elegir')
  const [decisiones, setDecisiones] = useState<Record<string, DecisionConflicto>>({})

  const nombrePorMateriaId = useMemo(() => new Map(materias.map((m) => [m.id, m.nombre])), [materias])
  const conflictos = useMemo(
    () => detectarConflictosFusion({ guardado: bloquesActuales, propuesto: salida.bloques, nombrePorMateriaId }),
    [bloquesActuales, salida.bloques, nombrePorMateriaId]
  )
  // Válido para las 3 vías (fusionar/reemplazar todo/conflictos): un
  // bloque en `movidos`/`sinCambios` siempre referencia una materia que ya
  // existe (así quedó clasificado), así que agregados es la fuente
  // correcta pase lo que pase — no hace falta distinguir por vía.
  const materiasNuevas = useMemo(() => detectarMateriasNuevas(diff.agregados, materias), [diff.agregados, materias])

  const todosResueltos = conflictos.every((c) => decisiones[c.existente.id] !== undefined)

  function elegirFusionar() {
    // Sin conflictos, no hay nada que decidir franja por franja — se aplica
    // directo, mismo resultado que una fusión con decisiones vacías.
    if (conflictos.length === 0) {
      onFusionar({})
      return
    }
    setPaso('conflictos')
  }

  function decidir(idExistente: string, decision: DecisionConflicto) {
    setDecisiones((actuales) => ({ ...actuales, [idExistente]: decision }))
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-panel-glass backdrop-blur-xl p-5 mb-6">
      <div className="flex items-start gap-2.5 mb-4">
        <ImageIcon size={16} className="text-coral mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-display text-sm font-semibold text-paper">
            Leí {salida.bloques.length} {salida.bloques.length === 1 ? 'bloque' : 'bloques'} en la foto
          </p>
          <p className="text-muted text-xs mt-0.5">Ya tienes un horario guardado — decide qué hacer con el nuevo antes de guardar nada.</p>
        </div>
        <button onClick={onDescartar} disabled={aplicando} className="text-muted hover:text-paper transition p-1 flex-shrink-0 disabled:opacity-50" title="Descartar">
          <X size={15} />
        </button>
      </div>

      <div className="mb-4">
        <DiffResumenLista diff={diff} formato={formatoReloj} />
      </div>

      {materiasNuevas.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-coral/10 mb-4 text-xs">
          <BookPlus size={13} className="text-coral flex-shrink-0 mt-0.5" />
          <p className="text-paper/90">
            Esto también creará {materiasNuevas.length} {materiasNuevas.length === 1 ? 'materia nueva' : 'materias nuevas'}:{' '}
            <span className="text-paper font-medium">{materiasNuevas.join(', ')}</span>
          </p>
        </div>
      )}

      {paso === 'elegir' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={elegirFusionar}
            disabled={aplicando}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-full bg-coral text-ink hover:opacity-90 transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {aplicando ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
            Fusionar los dos horarios
          </button>
          <BotonConfirmacion
            onConfirmar={onReemplazarTodo}
            etiqueta="Reemplazar todo"
            etiquetaConfirmar="¿Seguro? Reemplazar todo"
            icono={<RotateCcw size={13} />}
            disabled={aplicando}
          />
          <button
            onClick={onDescartar}
            disabled={aplicando}
            className="text-xs font-semibold px-4 py-2.5 rounded-full text-muted hover:text-paper transition disabled:opacity-50"
          >
            Descartar la foto
          </button>
        </div>
      )}

      {paso === 'conflictos' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">
            {conflictos.length} {conflictos.length === 1 ? 'franja choca' : 'franjas chocan'} entre los dos horarios — elige cuál te quedas en cada una:
          </p>

          <div className="flex flex-col gap-2">
            {conflictos.map((c) => {
              const nombreExistente = nombrePorMateriaId.get(c.existente.materiaId) ?? '—'
              const decision = decisiones[c.existente.id]
              return (
                <div key={c.existente.id} className="rounded-xl bg-panel-2/40 p-3">
                  <p className="text-[11px] font-mono text-muted mb-2">
                    {NOMBRE_DIA[c.dia]} {rango(c.horaInicio, c.horaFin, formatoReloj)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => decidir(c.existente.id, 'existente')}
                      className={`text-xs px-3 py-2 rounded-full transition ${
                        decision === 'existente' ? 'bg-success text-ink font-semibold' : 'bg-panel-glass text-paper hover:bg-panel-2'
                      }`}
                    >
                      Mantener &ldquo;{nombreExistente}&rdquo;
                    </button>
                    <button
                      onClick={() => decidir(c.existente.id, 'propuesto')}
                      className={`text-xs px-3 py-2 rounded-full transition ${
                        decision === 'propuesto' ? 'bg-coral text-ink font-semibold' : 'bg-panel-glass text-paper hover:bg-panel-2'
                      }`}
                    >
                      Usar &ldquo;{c.propuesto.materia}&rdquo;
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => onFusionar(decisiones)}
              disabled={!todosResueltos || aplicando}
              title={!todosResueltos ? 'Resuelve todas las franjas antes de confirmar' : undefined}
              className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full bg-coral text-ink hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {aplicando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Confirmar fusión
            </button>
            <button
              onClick={() => setPaso('elegir')}
              disabled={aplicando}
              className="text-xs font-semibold px-4 py-2.5 rounded-full text-muted hover:text-paper transition disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
