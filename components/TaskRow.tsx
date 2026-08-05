'use client'
import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { IconoMateria } from '@/components/ui/iconosMateria'

type Props = {
  titulo: string
  materia: string
  color: string
  icono?: string
  prioridad: string
  fecha: string | null
  completada: boolean
  onToggle: () => void
  onDelete: () => void
  onEdit: (nuevo: string) => void
}

const PRIORIDAD_STYLE: Record<string, string> = {
  alta: 'bg-danger/15 text-danger',
  media: 'bg-coral/15 text-coral',
  baja: 'bg-panel-2 text-muted',
}

function formatFecha(f: string) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(f + 'T00:00:00')
  const diff = Math.round((fecha.getTime() - hoy.getTime()) / 86400000)
  if (diff === 0) return { texto: 'Hoy', clase: 'text-coral' }
  if (diff === 1) return { texto: 'Mañana', clase: 'text-muted' }
  if (diff > 1) return { texto: `En ${diff} días`, clase: 'text-muted' }
  if (diff === -1) return { texto: 'Venció ayer', clase: 'text-danger' }
  return { texto: `Venció hace ${Math.abs(diff)} días`, clase: 'text-danger' }
}

export default function TaskRow({ titulo, materia, color, icono, prioridad, fecha, completada, onToggle, onDelete, onEdit }: Props) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(titulo)
  const info = fecha ? formatFecha(fecha) : null

  function guardar() {
    const limpio = valor.trim()
    if (limpio && limpio !== titulo) onEdit(limpio)
    else setValor(titulo)
    setEditando(false)
  }

  return (
    <div className={`group grid grid-cols-[28px_1fr_140px_100px_130px_28px] items-center gap-3 px-3 py-3 rounded-xl transition hover:bg-panel-2/60 ${completada ? 'opacity-50' : ''}`}>
      <button
        onClick={onToggle}
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition"
        style={{
          boxShadow: completada ? 'none' : `inset 0 0 0 2px ${color}`,
          backgroundColor: completada ? 'var(--color-success)' : 'transparent',
        }}
      >
        {completada && <Check size={11} className="text-ink" strokeWidth={3} />}
      </button>

      {editando ? (
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { setValor(titulo); setEditando(false) } }}
          style={{ boxShadow: '0 1.5px 0 0 var(--color-coral)' }}
          className="bg-transparent text-sm text-paper outline-none pb-0.5"
        />
      ) : (
        <p onClick={() => setEditando(true)} title="Clic para editar" className={`text-sm text-paper truncate cursor-text ${completada ? 'line-through' : ''}`}>
          {titulo}
        </p>
      )}

      <div className="flex items-center gap-1.5 text-xs text-paper min-w-0">
        <IconoMateria icono={icono} size={13} className="flex-shrink-0" style={{ color }} />
        <span className="truncate">{materia}</span>
      </div>

      <span className={`text-[11px] font-medium px-2 py-1 rounded-full text-center w-fit capitalize ${PRIORIDAD_STYLE[prioridad] ?? PRIORIDAD_STYLE.media}`}>
        {prioridad}
      </span>

      <span className={`text-xs font-mono ${info?.clase ?? 'text-muted'}`}>{info?.texto ?? '—'}</span>

      <button onClick={onDelete} title="Eliminar tarea" className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition p-1">
        <Trash2 size={13} />
      </button>
    </div>
  )
}
