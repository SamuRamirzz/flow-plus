'use client'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Materia } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import { inferirFechaEntrega } from '@/lib/horario/inferirFecha'
import { hoyISOLocal } from '@/lib/horario/hoy'
import BorderGlow from './reactbits/BorderGlow'
import MateriaPicker, { MATERIA_NUEVA } from './ui/MateriaPicker'
import PremiumDatePicker from './ui/PremiumDatePicker'
import SegmentedToggle from './ui/SegmentedToggle'

type Props = {
  materias: Materia[]
  horario: BloqueHorario[]
  onAdd: (data: { titulo: string; materiaId: string | null; nuevaMateria: string | null; fecha: string; prioridad: string }) => void
}

const PRIORIDADES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
]
const NUEVA = MATERIA_NUEVA

export default function AddTaskBar({ materias, horario, onAdd }: Props) {
  const [titulo, setTitulo] = useState('')
  // `materias` llega vacío en el primer render (la carga es async) y luego
  // se rellena — inicializar materiaId con materias[0]?.id se evalúa UNA
  // sola vez, con la lista todavía vacía, así que el picker quedaba
  // encallado en "+ Nueva materia…" para siempre aunque ya hubiera
  // materias. Separar "lo que el usuario eligió explícitamente" (nullable)
  // de "el valor efectivo a usar" evita el problema sin un efecto: cuando
  // materias[0] aparece, materiaId ya lo refleja, sin volver a renderizar
  // ni disparar nada.
  const [materiaIdElegida, setMateriaIdElegida] = useState<string | null>(null)
  const materiaId = materiaIdElegida ?? materias[0]?.id ?? NUEVA
  const [nuevaMateria, setNuevaMateria] = useState('')
  const [fecha, setFecha] = useState('')
  const [prioridad, setPrioridad] = useState('media')

  // Preview de la Parte "horario" (Sprint 7): NUNCA escribe en `fecha` —
  // es solo informativo. Si el usuario no toca la fecha, al enviar
  // `fecha` sigue vacía y es el servidor (POST /api/tareas) quien corre
  // esta MISMA función con los MISMOS datos y decide de verdad; acá solo
  // se anticipa el resultado para no dejar al usuario a ciegas.
  const inferencia = useMemo(() => {
    if (fecha || materiaId === NUEVA) return null
    return inferirFechaEntrega({
      fechaExplicita: null,
      origenExplicita: 'usuario',
      materiaId,
      horario,
      hoy: hoyISOLocal(),
    })
  }, [fecha, materiaId, horario])

  const puedeAgregar = titulo.trim().length > 0 && (materiaId !== NUEVA || nuevaMateria.trim().length > 0)

  function submit() {
    if (!puedeAgregar) return
    onAdd({
      titulo,
      materiaId: materiaId === NUEVA ? null : materiaId,
      nuevaMateria: materiaId === NUEVA ? nuevaMateria.trim() : null,
      fecha,
      prioridad,
    })
    setTitulo(''); setNuevaMateria(''); setFecha('')
  }

  return (
    <BorderGlow
      backgroundColor="var(--color-panel-glass)"
      borderRadius={18}
      glowRadius={26}
      glowIntensity={0.6}
      fillOpacity={0.4}
      edgeSensitivity={35}
      coneSpread={28}
      glowColor="14 100 65"
      className="mb-6"
    >
      <div className="p-5">
        <p className="font-display text-sm font-semibold text-paper mb-3.5">¿Qué tienes pendiente?</p>

        <div className="flex flex-wrap items-center gap-2.5 mb-1">
          <MateriaPicker
            id="materia-tarea"
            materias={materias}
            materiaId={materiaId}
            nuevaMateria={nuevaMateria}
            onMateriaIdChange={setMateriaIdElegida}
            onNuevaMateriaChange={setNuevaMateria}
          />

          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Nombre de la tarea"
            className="flex-1 min-w-[160px] bg-panel-glass backdrop-blur-md rounded-full px-4 py-2 text-xs text-paper placeholder:text-muted outline-none focus:ring-1 focus:ring-coral/60 transition"
          />

          <PremiumDatePicker value={fecha} onChange={setFecha} sugerencia={inferencia?.fecha ?? undefined} />
        </div>

        {inferencia?.motivo && (
          <p className="text-[10px] font-mono text-coral/80 mb-2.5 pl-1">{inferencia.motivo} — se completará sola si no eliges otra fecha</p>
        )}

        <div className="flex items-center gap-2.5 mt-2.5">
          <SegmentedToggle options={PRIORIDADES} value={prioridad} onChange={setPrioridad} />

          <button
            onClick={submit}
            disabled={!puedeAgregar}
            className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-5 py-2.5 rounded-full transition ${
              puedeAgregar ? 'bg-coral text-ink hover:opacity-90 cursor-pointer' : 'bg-panel-2 text-muted cursor-not-allowed'
            }`}
          >
            Agregar tarea
            <Plus size={14} />
          </button>
        </div>
      </div>
    </BorderGlow>
  )
}
