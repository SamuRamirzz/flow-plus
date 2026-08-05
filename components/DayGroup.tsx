'use client'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { ChevronDown } from 'lucide-react'
import TaskCard from './TaskCard'

type Tarea = { id: string; titulo: string; materia_id: string; fecha_entrega: string | null; prioridad: string; completada: boolean }
type Materia = { id: string; nombre: string; color: string }

type Props = {
  id?: string
  label: string
  tareas: Tarea[]
  materias: Materia[]
  onToggle: (id: string, actual: boolean) => void
  onDelete: (id: string) => void
  onEdit: (id: string, nuevoTitulo: string) => void
}

export default function DayGroup({ id, label, tareas, materias, onToggle, onDelete, onEdit }: Props) {
  const materiaDe = (mid: string) => materias.find((m) => m.id === mid)

  return (
    <Disclosure defaultOpen>
      {({ open }) => (
        <div id={id} className="mb-4 scroll-mt-6">
          <DisclosureButton className="flex items-center gap-2 w-full text-left mb-2.5 outline-none">
            <ChevronDown size={14} className={`text-muted transition-transform ${open ? '' : '-rotate-90'}`} />
            <span className="font-display text-[13px] font-semibold text-paper capitalize">{label}</span>
            <span className="font-mono text-[11px] text-muted">{tareas.length}</span>
            <span className="flex-1 border-t border-line ml-2" />
          </DisclosureButton>
          <DisclosurePanel className="flex flex-col gap-2 pl-5">
            {tareas.map((t) => {
              const m = materiaDe(t.materia_id)
              return (
                <TaskCard
                  key={t.id}
                  titulo={t.titulo}
                  materia={m?.nombre ?? '—'}
                  color={m?.color ?? '#5C7FA6'}
                  prioridad={t.prioridad}
                  fecha={t.fecha_entrega}
                  completada={t.completada}
                  onToggle={() => onToggle(t.id, t.completada)}
                  onDelete={() => onDelete(t.id)}
                  onEdit={(nuevo) => onEdit(t.id, nuevo)}
                />
              )
            })}
          </DisclosurePanel>
        </div>
      )}
    </Disclosure>
  )
}
