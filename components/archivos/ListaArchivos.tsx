'use client'

import { motion } from 'motion/react'
import { FolderOpen } from 'lucide-react'
import type { Materia } from '@/lib/types'
import type { Archivo, VistaArchivos } from '@/lib/archivos/tipos'
import { formatearTamano, formatearUltimaApertura } from '@/lib/archivos/formato'
import { usePreferencias } from '@/lib/preferencias'
import IconoArchivo from './IconoArchivo'
import EtiquetaIA from './EtiquetaIA'
import MenuAcciones from './MenuAcciones'

type Props = {
  archivos: Archivo[]
  materias: Materia[]
  vista: VistaArchivos
  seleccionadoId: string | null
  cargando: boolean
  hayFiltro: boolean
  onSeleccionar: (a: Archivo) => void
  onAnalizar: (a: Archivo) => void
  onEliminar: (a: Archivo) => void
}

export default function ListaArchivos({ archivos, materias, vista, seleccionadoId, cargando, hayFiltro, onSeleccionar, onAnalizar, onEliminar }: Props) {
  const { formatoReloj } = usePreferencias()
  const ahora = new Date()
  const nombreMateria = (id: string | null) => (id ? (materias.find((m) => m.id === id)?.nombre ?? '—') : '—')

  if (cargando) return <EsqueletoCarga vista={vista} />
  if (archivos.length === 0) return <EstadoVacio hayFiltro={hayFiltro} />

  if (vista === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {archivos.map((a) => (
          // `div role="button"` y NO `<button>`: la tarjeta contiene el menú
          // de acciones, que a su vez es un <button>. Un botón anidado dentro
          // de otro es HTML inválido y React lo reporta como error de
          // hidratación (encontrado en la prueba real de este sprint, no
          // leyendo el código). Misma solución que ya usan las filas de la
          // vista de lista, acá abajo.
          <motion.div
            key={a.id}
            layout
            role="button"
            tabIndex={0}
            onClick={() => onSeleccionar(a)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSeleccionar(a)
              }
            }}
            className={`group relative text-left rounded-2xl p-3.5 transition cursor-pointer ${seleccionadoId === a.id ? 'bg-panel-2' : 'bg-panel-glass backdrop-blur-md hover:bg-panel-2/60'}`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <IconoArchivo mimeType={a.mime_type} nombre={a.nombre} tam={38} />
              <span className="opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                <MenuAcciones archivo={a} onVerDetalle={() => onSeleccionar(a)} onAnalizar={() => onAnalizar(a)} onEliminar={() => onEliminar(a)} />
              </span>
            </div>
            <p className="text-[13px] font-medium text-paper leading-snug line-clamp-2 mb-1.5">{a.nombre}</p>
            <p className="text-[11px] text-muted mb-2.5">
              {nombreMateria(a.materia_id)} · {formatearTamano(a.tamano_bytes)}
            </p>
            <EtiquetaIA archivo={a} />
          </motion.div>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-panel-glass backdrop-blur-md overflow-hidden">
      {/* Encabezado — oculto en móvil: seis columnas no caben en 390px, y la
          fila ya repite cada dato con su propia etiqueta implícita ahí. */}
      <div className="hidden lg:grid grid-cols-[minmax(0,2.4fr)_1fr_1.3fr_1.1fr_0.7fr_auto] gap-3 px-5 py-3 text-[11px] font-medium text-muted">
        <span>Nombre</span>
        <span>Materia</span>
        <span>IA</span>
        <span>Última apertura</span>
        <span className="text-right">Tamaño</span>
        <span className="w-7" />
      </div>
      <div className="h-px bg-line hidden lg:block" />

      {archivos.map((a, i) => (
        <motion.div
          key={a.id}
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.2) }}
          onClick={() => onSeleccionar(a)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSeleccionar(a)
            }
          }}
          className={`grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,2.4fr)_1fr_1.3fr_1.1fr_0.7fr_auto] gap-x-3 gap-y-1.5 items-center px-4 lg:px-5 py-3 cursor-pointer transition ${
            seleccionadoId === a.id ? 'bg-panel-2' : 'hover:bg-panel-2/50'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <IconoArchivo mimeType={a.mime_type} nombre={a.nombre} />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-paper truncate">{a.nombre}</p>
              {/* Móvil: la materia y el tamaño viajan bajo el nombre en vez
                  de tener columna propia. */}
              <p className="lg:hidden text-[11px] text-muted truncate mt-0.5">
                {nombreMateria(a.materia_id)} · {formatearTamano(a.tamano_bytes)}
              </p>
            </div>
          </div>

          <span className="hidden lg:block text-[13px] text-muted truncate">{nombreMateria(a.materia_id)}</span>
          <span className="hidden lg:block min-w-0">
            <EtiquetaIA archivo={a} />
          </span>
          <span className="hidden lg:block text-[12px] text-muted truncate">{formatearUltimaApertura(a.ultima_apertura_en, ahora, formatoReloj)}</span>
          <span className="hidden lg:block text-[12px] text-muted text-right tabular-nums">{formatearTamano(a.tamano_bytes)}</span>

          <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
            <span className="lg:hidden">
              <EtiquetaIA archivo={a} />
            </span>
            <MenuAcciones archivo={a} onVerDetalle={() => onSeleccionar(a)} onAnalizar={() => onAnalizar(a)} onEliminar={() => onEliminar(a)} />
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function EsqueletoCarga({ vista }: { vista: VistaArchivos }) {
  const n = vista === 'grid' ? 8 : 6
  return (
    <div className={vista === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3' : 'rounded-3xl bg-panel-glass backdrop-blur-md p-4 space-y-3'}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={`animate-pulse ${vista === 'grid' ? 'rounded-2xl bg-panel-glass h-36' : 'flex items-center gap-3'}`}>
          {vista === 'lista' && (
            <>
              <div className="w-[34px] h-[34px] rounded-lg bg-panel-2 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-panel-2" />
                <div className="h-2.5 w-1/5 rounded bg-panel-2" />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// Estado vacío honesto: distingue "no tienes archivos todavía" de "tu filtro
// no encontró nada", que son problemas distintos con soluciones distintas.
function EstadoVacio({ hayFiltro }: { hayFiltro: boolean }) {
  return (
    <div className="rounded-3xl bg-panel-glass backdrop-blur-md px-6 py-16 text-center">
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-panel-2 mb-4">
        <FolderOpen size={20} className="text-muted" />
      </span>
      <p className="font-display font-semibold text-paper mb-1.5">{hayFiltro ? 'Nada coincide con este filtro' : 'Todavía no tienes archivos'}</p>
      <p className="text-sm text-muted max-w-sm mx-auto leading-relaxed">
        {hayFiltro
          ? 'Prueba con otro término, otro tipo de archivo, o vuelve a “Todos”.'
          : 'Sube un PDF, una foto de un enunciado o tus apuntes, y la IA los leerá para extraer tareas y generar un resumen.'}
      </p>
    </div>
  )
}
