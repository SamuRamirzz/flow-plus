'use client'

import { motion } from 'motion/react'
import { Folder, FolderOpen, Sparkles, CalendarDays, FileQuestion } from 'lucide-react'
import type { Materia } from '@/lib/types'
import type { Archivo } from '@/lib/archivos/tipos'
import { contarPorCarpeta, mismaCarpeta, type CarpetaId } from '@/lib/archivos/formato'

type Props = {
  materias: Materia[]
  archivos: Archivo[]
  seleccionada: CarpetaId
  onSeleccionar: (c: CarpetaId) => void
}

// Sidebar interno de "carpetas", replicando la columna izquierda de la
// referencia.
//
// ⚠️ LIMITACIÓN REAL, documentada acá y no disimulada: estas NO son carpetas
// de Google Drive. El backend sube TODO a una única carpeta "Flow+"
// (`asegurarCarpetaRaiz`) más una subcarpeta "Notas" — las subcarpetas por
// materia nunca se construyeron (ver la nota de pendientes en ROADMAP.md).
// Son agrupaciones derivadas de `materia_id` / `tipo_documento` /
// `analizado_en`, que es exactamente lo que el usuario espera ver y filtrar;
// la diferencia solo se percibe si abre su Drive por fuera de Flow+.
export default function SidebarCarpetas({ materias, archivos, seleccionada, onSeleccionar }: Props) {
  const especiales: { id: CarpetaId; label: string; Icono: typeof Folder }[] = [
    { id: { tipo: 'analizados' }, label: 'Analizados por IA', Icono: Sparkles },
    { id: { tipo: 'horarios' }, label: 'Horarios', Icono: CalendarDays },
    { id: { tipo: 'sin-materia' }, label: 'Sin materia', Icono: FileQuestion },
  ]

  return (
    <nav aria-label="Carpetas" className="rounded-3xl bg-panel-glass backdrop-blur-md p-2.5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <Fila
        label="Todos"
        Icono={seleccionada.tipo === 'todos' ? FolderOpen : Folder}
        conteo={archivos.length}
        activa={seleccionada.tipo === 'todos'}
        onClick={() => onSeleccionar({ tipo: 'todos' })}
      />

      {materias.length > 0 && (
        <>
          <Separador texto="Materias" />
          {materias.map((m) => {
            const id: CarpetaId = { tipo: 'materia', materiaId: m.id }
            const activa = mismaCarpeta(seleccionada, id)
            return (
              <Fila
                key={m.id}
                label={m.nombre}
                Icono={activa ? FolderOpen : Folder}
                colorPunto={m.color}
                conteo={contarPorCarpeta(archivos, id)}
                activa={activa}
                onClick={() => onSeleccionar(id)}
              />
            )
          })}
        </>
      )}

      <Separador texto="Filtros" />
      {especiales.map(({ id, label, Icono }) => (
        <Fila key={label} label={label} Icono={Icono} conteo={contarPorCarpeta(archivos, id)} activa={mismaCarpeta(seleccionada, id)} onClick={() => onSeleccionar(id)} />
      ))}
    </nav>
  )
}

function Separador({ texto }: { texto: string }) {
  return <p className="px-3 pt-4 pb-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-muted/60">{texto}</p>
}

type FilaProps = {
  label: string
  Icono: typeof Folder
  conteo: number
  activa: boolean
  onClick: () => void
  colorPunto?: string
}

function Fila({ label, Icono, conteo, activa, onClick, colorPunto }: FilaProps) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${activa ? 'text-paper' : 'text-muted hover:text-paper'}`}
    >
      {activa && <motion.span layoutId="carpeta-activa" className="absolute inset-0 rounded-xl bg-panel-2" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
      <Icono size={15} className={`relative shrink-0 ${activa ? 'text-coral' : ''}`} />
      <span className="relative min-w-0 flex-1 text-left truncate">{label}</span>
      {colorPunto && <span className="relative shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorPunto }} aria-hidden="true" />}
      {conteo > 0 && <span className="relative shrink-0 text-[10px] font-mono text-muted/70 tabular-nums">{conteo}</span>}
    </button>
  )
}
