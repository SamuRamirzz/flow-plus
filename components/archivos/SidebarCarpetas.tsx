'use client'

import { motion } from 'motion/react'
import { Folder, FolderOpen, Sparkles, CalendarDays, FileQuestion, StickyNote } from 'lucide-react'
import type { Materia } from '@/lib/types'
import type { Archivo } from '@/lib/archivos/tipos'
import { contarPorCarpeta, mismaCarpeta, type CarpetaId } from '@/lib/archivos/formato'

type Props = {
  materias: Materia[]
  archivos: Archivo[]
  seleccionada: CarpetaId
  onSeleccionar: (c: CarpetaId) => void
  // Sprint Sistema de Notas Unificado — "Notas" es una VISTA de nivel
  // superior (Parte C), no una carpeta más de `CarpetaId`: esa unión
  // discriminada filtra ARCHIVOS, y una nota no es un archivo (puede no
  // tener ninguno asociado). `notasActiva` es independiente de `seleccionada`
  // — las dos vistas son mutuamente excluyentes, decididas por el padre.
  notasActiva: boolean
  onAbrirNotas: () => void
  totalNotas: number
}

// Sidebar interno de carpetas, replicando la columna izquierda de la
// referencia.
//
// ── Estas carpetas YA son reales ──────────────────────────────────────────
// Desde el sprint de subcarpetas, cada materia tiene una subcarpeta de verdad
// dentro de "Flow+" en el Drive del usuario (`materias.drive_folder_id`), y
// los archivos se suben ahí. Lo que se ve acá y lo que se ve abriendo Drive
// coinciden.
//
// ── Por qué se sigue agrupando por `materia_id` y no listando Drive ───────
// Se evaluó listar las carpetas reales con la API de Drive. Se descartó por
// tres motivos, en orden de peso:
//   1. Una materia sin archivos todavía NO tiene carpeta (se crean
//      perezosamente, al subir el primer archivo). Listando Drive, esa
//      materia desaparecería del sidebar — justo la que el usuario necesita
//      ver para poder subirle algo.
//   2. Pintar el sidebar dependería de la latencia de red a Drive, cuando la
//      lista de archivos ya viene de Postgres en la misma carga.
//   3. `archivos.materia_id` es la fuente de verdad de a qué materia
//      pertenece un archivo; la carpeta de Drive es el espejo. Listar el
//      espejo en vez de la fuente invertiría esa relación.
// Las entradas de "Filtros" (Analizados por IA, Horarios, Sin materia) sí son
// puramente derivadas, y está bien que lo sean: son vistas, no ubicaciones.
export default function SidebarCarpetas({ materias, archivos, seleccionada, onSeleccionar, notasActiva, onAbrirNotas, totalNotas }: Props) {
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
        activa={!notasActiva && seleccionada.tipo === 'todos'}
        onClick={() => onSeleccionar({ tipo: 'todos' })}
      />

      {materias.length > 0 && (
        <>
          <Separador texto="Materias" />
          {materias.map((m) => {
            const id: CarpetaId = { tipo: 'materia', materiaId: m.id }
            const activa = !notasActiva && mismaCarpeta(seleccionada, id)
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
        <Fila
          key={label}
          label={label}
          Icono={Icono}
          conteo={contarPorCarpeta(archivos, id)}
          activa={!notasActiva && mismaCarpeta(seleccionada, id)}
          onClick={() => onSeleccionar(id)}
        />
      ))}
      <Fila label="Notas" Icono={StickyNote} conteo={totalNotas} activa={notasActiva} onClick={onAbrirNotas} />
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
