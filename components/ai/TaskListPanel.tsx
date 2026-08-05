'use client'

import { motion } from 'motion/react'
import { Undo2, Check } from 'lucide-react'
import type { Materia, Tarea } from '@/lib/types'
import { estadoListaTareas } from './overlayLogic'
import { chipsDeCambios } from './OperacionRow'
import type { RegistroOperacion } from './registroOperaciones'
import { IconoMateria } from '@/components/ui/iconosMateria'

type Props = {
  tareas: Tarea[] | null
  cargando: boolean
  materias: Materia[]
  // Sprint 7.2 Parte B: reemplaza idsRecienCreadas/idsModificadas — un solo
  // registro (de sesión, vive en app/ai/page.tsx) alcanza para decidir tanto
  // el resaltado como el botón Deshacer, sin dos props paralelas que puedan
  // desincronizarse entre sí.
  registro: RegistroOperacion[]
  onDeshacer: (registroId: string) => void
  /** Alto máximo del scroll interno. El overlay y el panel de la página
   *  tienen espacio distinto disponible. */
  maxAlturaClase?: string
}

// coral para creada/modificada (cambios no destructivos), danger solo para
// eliminada — mismo esquema ya usado en OperacionRow.tsx para las
// operaciones propuestas; acá es el mismo criterio aplicado a operaciones
// ya aplicadas de verdad, no una paleta paralela.
const ESTILO: Record<'crear' | 'modificar' | 'borrar', { fondo: string; sombra: string; etiqueta: string; colorTexto: string }> = {
  crear: {
    fondo: 'rgba(255, 107, 77, 0.12)',
    sombra: '0 0 0 1px rgba(255,107,77,0.35), 0 0 24px -8px rgba(255,107,77,0.55)',
    etiqueta: 'Nueva',
    colorTexto: 'var(--color-coral)',
  },
  modificar: {
    fondo: 'rgba(255, 107, 77, 0.12)',
    sombra: '0 0 0 1px rgba(255,107,77,0.35), 0 0 24px -8px rgba(255,107,77,0.55)',
    etiqueta: 'Actualizada',
    colorTexto: 'var(--color-coral)',
  },
  borrar: {
    fondo: 'rgba(239, 68, 68, 0.1)',
    sombra: '0 0 0 1px rgba(239,68,68,0.3), 0 0 24px -8px rgba(239,68,68,0.5)',
    etiqueta: 'Eliminada',
    colorTexto: 'var(--color-danger)',
  },
}

// Segunda pasada de pulido (post sub-sprint 7.5) — mismo lenguaje visual que
// PRIORIDAD_STYLE en TaskRow.tsx (tabla principal de "/"), para que una
// tarea se vea igual de "seria" la vea desde donde la vea.
const PRIORIDAD_ESTILO: Record<string, string> = {
  alta: 'bg-danger/15 text-danger',
  media: 'bg-coral/15 text-coral',
  baja: 'bg-panel-2 text-muted',
}

// Fecha relativa con color — mismo criterio que formatFecha en TaskRow.tsx:
// "Hoy"/"Mañana"/"En N días" en tono neutro, "Venció..." en rojo. Antes
// esta lista no mostraba NINGUNA fecha ni materia por fila — con eso, un
// título suelto y un puntito de color era todo lo que había, por eso se
// veía plano. `hoy` se resuelve en el momento del render (hora del
// navegador) — coherente con el resto de la UI cliente-side de fechas
// relativas (TaskRow, AgendaSummary), que tampoco recibe `hoy` inyectado.
function fechaRelativa(fecha: string | null): { texto: string; clase: string } | null {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dia = new Date(fecha + 'T00:00:00')
  const diff = Math.round((dia.getTime() - hoy.getTime()) / 86400000)
  if (diff === 0) return { texto: 'Hoy', clase: 'text-coral' }
  if (diff === 1) return { texto: 'Mañana', clase: 'text-muted' }
  if (diff > 1) return { texto: `En ${diff} días`, clase: 'text-muted' }
  if (diff === -1) return { texto: 'Venció ayer', clase: 'text-danger' }
  return { texto: `Venció hace ${Math.abs(diff)} días`, clase: 'text-danger' }
}

// Sub-sprint 7.5 Parte C — un chip por campo cambiado ("fecha → 15 ago"),
// no un único renglón mono con todo junto: cada campo se lee de un vistazo
// y el conjunto escala mejor cuando hay 3-4 cambios a la vez.
function ChipsCambios({ chips }: { chips: string[] }) {
  return (
    <>
      {chips.map((chip) => (
        <span key={chip} className="text-[10px] font-mono text-coral/90 bg-coral/10 rounded-full px-2 py-0.5">
          {chip}
        </span>
      ))}
    </>
  )
}

function BotonDeshacer({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Deshacer"
      className="flex items-center gap-1 text-[10px] font-mono text-muted hover:text-paper bg-panel-2/0 hover:bg-panel-2/70 transition-colors rounded-full px-2 py-1 flex-shrink-0"
    >
      <Undo2 size={11} />
      Deshacer
    </button>
  )
}

// Insignia de estado — hace doble función: comunica completada/pendiente
// COMO YA hacía, pero cuando está pendiente ahora muestra el ícono de la
// materia (en vez de un anillo vacío), reusando el ícono automático del
// sub-sprint de materias en el lugar donde más se nota. Completada sigue
// siendo el check relleno de verde — ese estado nunca necesitó decir de
// qué materia era, ya está tachada.
function InsigniaEstado({ completada, color, icono }: { completada: boolean; color: string; icono: string | undefined }) {
  if (completada) {
    return (
      <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-success)' }}>
        <Check size={12} className="text-ink" strokeWidth={3} />
      </span>
    )
  }
  return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ boxShadow: `inset 0 0 0 1.5px ${color}` }}>
      <IconoMateria icono={icono} size={12} style={{ color }} />
    </span>
  )
}

// Fila meta compartida: nombre de materia · fecha relativa — la misma
// línea de "contexto" tanto para una tarea activa como para una recién
// eliminada (FilaFantasma), para que las dos lean igual. El ícono de la
// materia ya vive en InsigniaEstado, así que acá solo va el nombre (sin
// repetir el ícono una segunda vez en la misma fila).
function FilaMeta({ materia, fecha }: { materia: Materia | undefined; fecha: string | null }) {
  const rel = fechaRelativa(fecha)
  if (!materia && !rel) return null
  return (
    <div className="flex items-center gap-1.5 pl-[34px] text-[11px] text-muted min-w-0">
      {materia && <span className="truncate">{materia.nombre}</span>}
      {rel && (
        <>
          {materia && <span className="text-muted/40">·</span>}
          <span className={`flex-shrink-0 font-mono ${rel.clase}`}>{rel.texto}</span>
        </>
      )}
    </div>
  )
}

// Fila de una tarea real, decorada si el registro de esta sesión tiene una
// operación activa (no deshecha) sobre ella — 'crear'/'modificar' son las
// únicas posibles acá: una tarea con una operación 'borrar' activa ya no
// está en `tareas` (se refetchea tras cada aplicar), así que esa nunca
// llega a esta función — ver FilaFantasma para ese caso.
function TareaExistente({
  tarea,
  materias,
  registro,
  onDeshacer,
}: {
  tarea: Tarea
  materias: Materia[]
  registro: RegistroOperacion | undefined
  onDeshacer: (id: string) => void
}) {
  const materia = materias.find((m) => m.id === tarea.materia_id)
  const color = materia?.color ?? '#5C7FA6'
  const estilo = registro && registro.tipo !== 'borrar' ? ESTILO[registro.tipo] : null
  const chips = registro?.tipo === 'modificar' ? chipsDeCambios(registro.cambiosAplicados) : []
  // El título vive en SU PROPIA fila a ancho completo: antes competía por
  // espacio en la misma línea con la etiqueta Nueva/Actualizada y el botón
  // Deshacer, así que un título medianamente largo se truncaba mucho antes
  // de lo necesario. La etiqueta + chips + Deshacer bajan a una fila
  // secundaria, más chica y clara jerárquicamente — es metadata del
  // cambio, no el contenido.
  const hayMeta = Boolean(estilo) || chips.length > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-1.5 px-3.5 py-3 rounded-2xl backdrop-blur-xl transition-colors duration-500"
      style={{ backgroundColor: estilo?.fondo ?? 'var(--color-panel-2)', boxShadow: estilo?.sombra ?? 'none' }}
    >
      <div className="flex items-center gap-2.5">
        <InsigniaEstado completada={tarea.completada} color={color} icono={materia?.icono} />
        <span className={`text-sm flex-1 min-w-0 truncate ${tarea.completada ? 'text-muted line-through' : 'text-paper'}`}>{tarea.titulo}</span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 capitalize ${PRIORIDAD_ESTILO[tarea.prioridad] ?? PRIORIDAD_ESTILO.media}`}>
          {tarea.prioridad}
        </span>
      </div>

      <FilaMeta materia={materia} fecha={tarea.fecha_entrega} />

      {hayMeta && (
        <div className="flex items-center justify-between gap-2 pl-[34px]">
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {estilo && (
              <span
                className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ color: estilo.colorTexto, backgroundColor: estilo.fondo }}
              >
                {estilo.etiqueta}
              </span>
            )}
            <ChipsCambios chips={chips} />
          </div>
          {registro && <BotonDeshacer onClick={() => onDeshacer(registro.id)} />}
        </div>
      )}
    </motion.div>
  )
}

// Tarea borrada en esta sesión — ya no existe en `tareas`, así que se
// inyecta como fila propia (tachada, en rojo) en vez de decorar una fila
// que ya no está. Deshacer la recrea de verdad contra Supabase.
function FilaFantasma({
  registro,
  materias,
  onDeshacer,
}: {
  registro: Extract<RegistroOperacion, { tipo: 'borrar' }>
  materias: Materia[]
  onDeshacer: (id: string) => void
}) {
  const estilo = ESTILO.borrar
  const materia = materias.find((m) => m.id === registro.tareaEliminada.materia_id)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-1.5 px-3.5 py-3 rounded-2xl backdrop-blur-xl"
      style={{ backgroundColor: estilo.fondo, boxShadow: estilo.sombra }}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-danger" />
        </span>
        <span className="text-sm flex-1 min-w-0 truncate text-paper/70 line-through">{registro.titulo}</span>
      </div>
      <FilaMeta materia={materia} fecha={registro.tareaEliminada.fecha_entrega} />
      <div className="flex items-center justify-between gap-2 pl-[34px]">
        <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: estilo.colorTexto, backgroundColor: estilo.fondo }}>
          {estilo.etiqueta}
        </span>
        <BotonDeshacer onClick={() => onDeshacer(registro.id)} />
      </div>
    </motion.div>
  )
}

// Segunda pasada de pulido — antes cada fila "flotaba" suelta sobre el
// fondo de la página/overlay, sin nada que las agrupara como una sola
// pieza. Ahora todo (banner de confirmación, filas, footer de progreso)
// vive dentro de UNA tarjeta contenedora — mismo `bg-panel-glass +
// backdrop-blur + sombra` que ya usa el resto del proyecto para separar
// paneles, nunca una línea divisoria dura (la directiva de cero-bordes de
// globals.css la anularía de todos modos).
function Contenedor({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-panel-glass backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] p-3 flex flex-col gap-1">
      {children}
      {footer}
    </div>
  )
}

// Lista de las tareas reales del usuario, compartida por la columna
// "TAREAS" del overlay y el panel de tareas de la página /ai.
//
// Deliberadamente NO recibe nada del resultado del agente directamente: su
// contenido depende de las tareas que ya existen en Supabase + el registro
// de operaciones de la sesión — si la IA falla, esta lista se sigue viendo
// igual (el bug original era que el render estaba atado al éxito de la IA).
export default function TaskListPanel({ tareas, cargando, materias, registro, onDeshacer, maxAlturaClase = 'max-h-[55vh]' }: Props) {
  const estado = estadoListaTareas({ cargando, tareas })

  if (estado === 'cargando') {
    return (
      <Contenedor>
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-panel-2/60 animate-pulse" />
          ))}
        </div>
      </Contenedor>
    )
  }

  // Última operación activa (no deshecha) por tareaId — si una tarea se
  // creó y luego se modificó en la misma sesión, gana la más reciente; al
  // deshacerla, la anterior (todavía sin deshacer) vuelve a quedar como la
  // activa sola porque el filtro se recalcula, sin lógica extra.
  const activasPorTarea = new Map<string, RegistroOperacion>()
  for (const r of registro) {
    if (!r.deshecho) activasPorTarea.set(r.tareaId, r)
  }
  const fantasmas = [...activasPorTarea.values()].filter((r) => r.tipo === 'borrar')

  if (estado === 'vacio' && fantasmas.length === 0) {
    return (
      <Contenedor>
        <div className="px-4 py-6 text-center">
          <p className="text-muted text-sm">Todavía no tienes tareas registradas.</p>
        </div>
      </Contenedor>
    )
  }

  const total = (tareas?.length ?? 0) + fantasmas.length
  const completadas = tareas?.filter((t) => t.completada).length ?? 0

  return (
    <Contenedor
      footer={
        total > 0 && (
          <div className="flex items-center justify-between px-1 pt-2">
            <span className="text-[10px] font-mono uppercase tracking-wide text-muted">Tareas pendientes</span>
            <span className="text-xs font-mono text-paper">
              {completadas} de {total} completadas
            </span>
          </div>
        )
      }
    >
      <div className={`flex flex-col gap-2 overflow-y-auto pr-1 ${maxAlturaClase}`}>
        {fantasmas.map((r) => (
          <FilaFantasma key={r.id} registro={r} materias={materias} onDeshacer={onDeshacer} />
        ))}
        {tareas?.map((t) => (
          <TareaExistente key={t.id} tarea={t} materias={materias} registro={activasPorTarea.get(t.id)} onDeshacer={onDeshacer} />
        ))}
      </div>
    </Contenedor>
  )
}
