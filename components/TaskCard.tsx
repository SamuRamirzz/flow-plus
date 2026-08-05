'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import BorderGlow from './reactbits/BorderGlow'
import { hexToHSL } from '@/lib/color'

type Props = {
  titulo: string
  materia: string
  color: string
  prioridad: string
  fecha: string | null
  completada: boolean
  onToggle: () => void
  onDelete: () => void
  onEdit: (nuevoTitulo: string) => void
}

function formatFecha(f: string) {
  const [, m, d] = f.split('-')
  return `${d}/${m}`
}

function esVencida(fecha: string | null, completada: boolean) {
  if (!fecha || completada) return false
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  return new Date(fecha + 'T00:00:00') < hoy
}

export default function TaskCard({ titulo, materia, color, prioridad, fecha, completada, onToggle, onDelete, onEdit }: Props) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(titulo)
  const vencida = esVencida(fecha, completada)
  const glow = vencida ? '350 90 65' : hexToHSL(color)

  function guardar() {
    const limpio = valor.trim()
    if (limpio && limpio !== titulo) onEdit(limpio)
    else setValor(titulo)
    setEditando(false)
  }

  return (
    <BorderGlow
      backgroundColor="var(--color-panel-glass)"
      borderRadius={12}
      glowRadius={22}
      glowIntensity={0.85}
      edgeSensitivity={35}
      coneSpread={30}
      glowColor={glow}
      className={completada ? 'opacity-40' : ''}
    >
      <div
        className="group flex items-center gap-3.5 px-4 py-3.5 rounded-[12px] overflow-hidden"
        style={{ borderLeft: `3px solid ${vencida ? '#FF5470' : color}` }}
      >
        <button
          onClick={onToggle}
          className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition"
          style={{ borderColor: color, backgroundColor: completada ? color : 'transparent' }}
        />
        <div className="flex-1 min-w-0">
          {editando ? (
            <input
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={guardar}
              onKeyDown={(e) => {
                if (e.key === 'Enter') guardar()
                if (e.key === 'Escape') { setValor(titulo); setEditando(false) }
              }}
              className="w-full bg-transparent text-[14px] text-paper outline-none border-b border-coral pb-0.5"
            />
          ) : (
            <p
              onClick={() => setEditando(true)}
              title="Clic para editar"
              className={`text-[14px] text-paper leading-snug cursor-text ${completada ? 'line-through' : ''}`}
            >
              {titulo}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap font-mono text-[10.5px]">
            <span className="px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}1A` }}>
              {materia}
            </span>
            {fecha && (
              <span className={vencida ? 'text-danger' : 'text-muted'}>
                {vencida ? 'venció ' : ''}{formatFecha(fecha)}
              </span>
            )}
            {prioridad === 'alta' && <span className="text-danger">● alta</span>}
          </div>
        </div>
        <button
          onClick={onDelete}
          title="Eliminar tarea"
          className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition flex-shrink-0 p-1"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </BorderGlow>
  )
}
