'use client'
import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Materia } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import { inferirFechaEntrega } from '@/lib/horario/inferirFecha'
import { hoyISOLocal } from '@/lib/horario/hoy'
import MateriaPicker, { MATERIA_NUEVA } from '@/components/ui/MateriaPicker'
import PremiumDatePicker from '@/components/ui/PremiumDatePicker'
import SegmentedToggle from '@/components/ui/SegmentedToggle'

export type TareaEditable = {
  id: string
  titulo: string
  materiaId: string
  nuevaMateria: string
  fecha: string
  prioridad: string
  // Sprint 10: lo detecta TaskManagementAgent — se lleva tal cual hasta
  // crearTarea() para que las colisiones "mismo tipo examen" tengan datos
  // reales. Nombrado `tipoTarea` (no `tipo`) porque OperacionCrearEditable
  // es `{ tipo: 'crear' } & TareaEditable` — un campo `tipo` acá chocaría
  // con ese discriminante. Sin picker propio en esta fila: no hay ningún
  // control de tipo en la UI todavía, solo persistencia.
  tipoTarea: string
  // Cierre de Fase 1 — el mensaje libre completo del turno del que salió
  // esta operación (no editable en la fila, solo se lleva hasta crearTarea()
  // para que ExamAgent tenga algo que leer si tipoTarea==='examen').
  textoOrigen: string
}

const PRIORIDADES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
]

type Props = {
  tarea: TareaEditable
  materias: Materia[]
  horario: BloqueHorario[]
  onChange: (id: string, cambios: Partial<TareaEditable>) => void
  onRemove: (id: string) => void
}

// Fila de una tarea detectada por la IA, editable por completo sin
// modales — mismo patrón de "clic para editar" que TaskRow, más los
// mismos controles de AddTaskBar (materia/fecha/prioridad) para no
// inventar un lenguaje visual nuevo para esta pantalla.
export default function ResultTaskRow({ tarea, materias, horario, onChange, onRemove }: Props) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(tarea.titulo)

  // Mismo preview de fecha por horario que AddTaskBar (Sprint 7) — acá sin
  // el texto de `motivo` debajo, para no romper el alto compacto de la
  // fila; el tooltip de PremiumDatePicker ya explica de dónde sale la
  // fecha sugerida al pasar el mouse.
  const inferencia = useMemo(() => {
    if (tarea.fecha || tarea.materiaId === MATERIA_NUEVA) return null
    return inferirFechaEntrega({
      fechaExplicita: null,
      origenExplicita: 'ia',
      materiaId: tarea.materiaId,
      horario,
      hoy: hoyISOLocal(),
    })
  }, [tarea.fecha, tarea.materiaId, horario])

  function guardar() {
    const limpio = valor.trim()
    if (limpio) onChange(tarea.id, { titulo: limpio })
    else setValor(tarea.titulo)
    setEditando(false)
  }

  return (
    <div className="group flex flex-wrap items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-panel-glass backdrop-blur-xl">
      {editando ? (
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') guardar()
            if (e.key === 'Escape') { setValor(tarea.titulo); setEditando(false) }
          }}
          style={{ boxShadow: '0 1.5px 0 0 var(--color-coral)' }}
          className="flex-1 min-w-[180px] bg-transparent text-sm text-paper outline-none pb-0.5"
        />
      ) : (
        <p onClick={() => setEditando(true)} title="Clic para editar" className="flex-1 min-w-[180px] text-sm text-paper cursor-text">
          {tarea.titulo}
        </p>
      )}

      <MateriaPicker
        id={`materia-resultado-${tarea.id}`}
        materias={materias}
        materiaId={tarea.materiaId}
        nuevaMateria={tarea.nuevaMateria}
        onMateriaIdChange={(id) => onChange(tarea.id, { materiaId: id })}
        onNuevaMateriaChange={(nombre) => onChange(tarea.id, { nuevaMateria: nombre })}
      />

      <PremiumDatePicker value={tarea.fecha} onChange={(fecha) => onChange(tarea.id, { fecha })} sugerencia={inferencia?.fecha ?? undefined} />

      <SegmentedToggle options={PRIORIDADES} value={tarea.prioridad} onChange={(prioridad) => onChange(tarea.id, { prioridad })} />

      <button
        onClick={() => onRemove(tarea.id)}
        title="Quitar de la lista"
        className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition p-1 ml-auto"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
