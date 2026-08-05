'use client'
import { Trash2, HelpCircle, Info } from 'lucide-react'
import type { CambiosTarea, TareaContexto } from '@/lib/ai/agents/taskManagement'
import type { TareaEditable } from './ResultTaskRow'

export type OperacionModificarEditable = { tipo: 'modificar'; id: string; tareaId: string; antes: TareaContexto; cambios: CambiosTarea }
export type OperacionBorrarEditable = { tipo: 'borrar'; id: string; tareaId: string; antes: TareaContexto }
export type OperacionAmbiguaEditable = {
  tipo: 'ambiguo'
  id: string
  descripcion: string
  accionOriginal: 'modificar' | 'borrar'
  cambiosPropuestos: CambiosTarea | null
  candidatos: TareaContexto[]
}
export type OperacionSinCoincidenciasEditable = { tipo: 'sin_coincidencias'; id: string; descripcion: string }
export type OperacionCrearEditable = { tipo: 'crear' } & TareaEditable

// Estado del lado del cliente para una operación propuesta por
// TaskManagementAgent — 'crear' reusa exactamente TareaEditable (para poder
// reusar ResultTaskRow sin traducir campos), el resto son de solo-lectura +
// "quitar"/"resolver". Vive acá (no en app/ai/page.tsx) porque es el mismo
// módulo que ya sabe cómo renderizar cada variante.
export type OperacionEditable =
  | OperacionCrearEditable
  | OperacionModificarEditable
  | OperacionBorrarEditable
  | OperacionAmbiguaEditable
  | OperacionSinCoincidenciasEditable

const PRIORIDAD_LABEL: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' }

export function formatoFecha(fecha: string): string {
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function chipsDeCambios(cambios: CambiosTarea): string[] {
  const chips: string[] = []
  if (cambios.titulo !== undefined) chips.push(`título → "${cambios.titulo}"`)
  if (cambios.materia !== undefined) chips.push(`materia → ${cambios.materia ?? '—'}`)
  if (cambios.fecha !== undefined) chips.push(`fecha → ${cambios.fecha ? formatoFecha(cambios.fecha) : 'sin fecha'}`)
  if (cambios.prioridad !== undefined) chips.push(`prioridad → ${PRIORIDAD_LABEL[cambios.prioridad] ?? cambios.prioridad}`)
  if (cambios.completada !== undefined) chips.push(cambios.completada ? 'marcar completada' : 'marcar pendiente')
  return chips
}

// Fila de una operación de gestión que NO es "crear" (esas reusan
// ResultTaskRow tal cual, ver AIImmersiveOverlay). Mismo lenguaje visual
// (panel-glass, backdrop-blur, cero bordes duros) pero de solo-lectura +
// "quitar" — a diferencia de ResultTaskRow no hay campos que editar: el
// texto ya viene resuelto contra la tarea real.
type Props = {
  operacion: OperacionModificarEditable | OperacionBorrarEditable | OperacionAmbiguaEditable | OperacionSinCoincidenciasEditable
  onQuitar: (id: string) => void
  onResolverAmbiguo: (id: string, candidato: TareaContexto) => void
}

export default function OperacionRow({ operacion, onQuitar, onResolverAmbiguo }: Props) {
  if (operacion.tipo === 'modificar') {
    const chips = chipsDeCambios(operacion.cambios)
    return (
      <div className="group flex items-start gap-2.5 px-4 py-3.5 rounded-2xl bg-panel-glass backdrop-blur-xl">
        <span className="w-1.5 h-1.5 rounded-full bg-coral flex-shrink-0 mt-1.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-paper truncate">{operacion.antes.titulo}</p>
          {chips.length > 0 ? (
            <p className="text-[11px] font-mono text-coral/80 mt-0.5">{chips.join(' · ')}</p>
          ) : (
            <p className="text-[11px] font-mono text-muted mt-0.5">sin cambios especificados</p>
          )}
        </div>
        <button onClick={() => onQuitar(operacion.id)} title="No aplicar este cambio" className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition p-1 flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  if (operacion.tipo === 'borrar') {
    return (
      <div className="group flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-danger/10 backdrop-blur-xl">
        <span className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0" />
        <p className="flex-1 min-w-0 text-sm text-paper/80 line-through truncate">{operacion.antes.titulo}</p>
        <span className="text-[10px] font-mono uppercase tracking-wide text-danger bg-danger/15 px-2 py-0.5 rounded-full flex-shrink-0">
          Se eliminará
        </span>
        <button onClick={() => onQuitar(operacion.id)} title="No eliminar esta tarea" className="opacity-0 group-hover:opacity-100 text-muted hover:text-paper transition p-1 flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  if (operacion.tipo === 'ambiguo') {
    return (
      <div className="flex flex-col gap-2 px-4 py-3.5 rounded-2xl bg-panel-glass backdrop-blur-xl">
        <div className="flex items-start gap-2.5">
          <HelpCircle size={15} className="text-coral mt-0.5 flex-shrink-0" />
          <p className="text-sm text-paper">
            ¿Cuál tarea es <span className="text-muted">&ldquo;{operacion.descripcion}&rdquo;</span>? Elige una:
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 pl-6">
          {operacion.candidatos.map((c) => (
            <button
              key={c.id}
              onClick={() => onResolverAmbiguo(operacion.id, c)}
              className="text-[11px] text-paper bg-panel-2/70 hover:bg-coral/20 rounded-full px-3 py-1.5 transition cursor-pointer"
            >
              {c.titulo}
              {c.fecha ? ` · ${formatoFecha(c.fecha)}` : ''}
            </button>
          ))}
          <button onClick={() => onQuitar(operacion.id)} className="text-[11px] text-muted hover:text-danger px-2 py-1.5 transition cursor-pointer">
            Ninguna
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-panel-glass backdrop-blur-xl">
      <Info size={15} className="text-muted flex-shrink-0" />
      <p className="flex-1 min-w-0 text-sm text-muted">
        No encontré ninguna tarea que coincida con &ldquo;{operacion.descripcion}&rdquo;.
      </p>
      <button onClick={() => onQuitar(operacion.id)} title="Descartar" className="text-muted hover:text-paper transition p-1 flex-shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
