'use client'

import { useMemo, useState } from 'react'
import { useToast } from '@/lib/toast'
import { crearTarea, actualizarTarea, eliminarTarea as eliminarTareaApi, fusionarMaterias } from '@/lib/tasks'
import { useDatosAgenda } from '@/lib/useDatosAgenda'
import { mensajeAvisoCalendario, type PosibleDuplicadoMateria } from '@/lib/ai/agents/calendar'
import AvisoDuplicadoMateria from '@/components/ui/AvisoDuplicadoMateria'
import AddTaskBar from '@/components/AddTaskBar'
import TaskTable from '@/components/TaskTable'
import MiniCalendar from '@/components/MiniCalendar'
import AgendaSummary from '@/components/AgendaSummary'
import PremiumSelect from '@/components/ui/PremiumSelect'
import DayDetailModal from '@/components/ui/DayDetailModal'
import NotificationBell from '@/components/ui/NotificationBell'
import { IconoMateria } from '@/components/ui/iconosMateria'
import BannerInvitado from '@/components/invitado/BannerInvitado'

// Sprint Home — CORRECCIÓN DE ALCANCE. El sprint anterior había fusionado el
// pulso del día + informes de rendimiento DENTRO de esta pantalla; no era lo
// pedido. Este archivo vuelve a ser exactamente lo que era antes de eso: la
// vista de trabajo de Agenda — formulario, filtros, tabla de tareas,
// calendario lateral. El pulso del día y los informes ahora viven en su
// propia sección separada (`app/home/`, `components/home/`), que reusa la
// MISMA lógica pura ya construida (`lib/estadisticas/`) sin haber tenido que
// tocarla — solo cambió dónde se renderiza.
const ESTADOS = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'completadas', label: 'Completadas' },
]

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function AgendaHome() {
  const { notify } = useToast()
  // Sprint Home — el hook compartido (lib/useDatosAgenda.ts) es ahora la
  // ÚNICA fuente de `materias`/`tareas`/`horario`: ya no hay una copia local
  // que sincronizar a mano. Tras cada mutación se llama a `recargar()`, que
  // el hook expone y que actualiza este mismo estado — mismo resultado que
  // el `cargarDatos()` de antes, sin mantener dos copias del mismo dato.
  const { materias, tareas, horario, cargando, invitado, recargar } = useDatosAgenda()
  const [estadoFiltro, setEstadoFiltro] = useState('todas')
  const [materiaFiltro, setMateriaFiltro] = useState('todas')
  const [diaModal, setDiaModal] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Cierre de Fase 1 — dedup semántico. `materiaOrigenId` es la materia
  // recién creada (la que desaparece si el usuario fusiona); `nombreNuevo`
  // es su nombre, para el texto del aviso. Un solo aviso a la vez: si se
  // crea otra tarea con otra materia nueva mientras este sigue visible, lo
  // reemplaza — no se apilan avisos de dedup.
  const [avisoDuplicado, setAvisoDuplicado] = useState<{ materiaOrigenId: string; nombreNuevo: string; aviso: PosibleDuplicadoMateria } | null>(null)

  async function agregarTarea(data: { titulo: string; materiaId: string | null; nuevaMateria: string | null; fecha: string; prioridad: string }) {
    const resultado = await crearTarea(data, materias)
    if (!resultado.ok) { setError(resultado.error); notify('No se pudo crear la tarea', false); return }
    setError(null)
    const aviso = mensajeAvisoCalendario(resultado.avisoFecha, resultado.colisiones)
    notify(aviso ? `Tarea creada — ${aviso}` : 'Tarea creada')
    // Cierre de Fase 1 — solo hay algo que fusionar cuando de verdad se creó
    // una materia nueva (materiaCreada) Y CalendarAgent encontró una
    // coincidencia con confianza suficiente (posibleDuplicado).
    if (resultado.materiaCreada && resultado.posibleDuplicado) {
      setAvisoDuplicado({ materiaOrigenId: resultado.materiaCreada.id, nombreNuevo: resultado.materiaCreada.nombre, aviso: resultado.posibleDuplicado })
    }
    recargar()
  }

  async function fusionarConSugerido() {
    if (!avisoDuplicado) return
    const resultado = await fusionarMaterias(avisoDuplicado.materiaOrigenId, avisoDuplicado.aviso.materiaId)
    if (!resultado.ok) { notify('No se pudo fusionar las materias', false); return }
    notify(
      resultado.tareasReasignadas > 0
        ? `Fusionado con "${avisoDuplicado.aviso.nombre}" — ${resultado.tareasReasignadas} tarea${resultado.tareasReasignadas === 1 ? '' : 's'} movida${resultado.tareasReasignadas === 1 ? '' : 's'}`
        : `Fusionado con "${avisoDuplicado.aviso.nombre}"`
    )
    setAvisoDuplicado(null)
    recargar()
  }

  async function toggle(id: string, actual: boolean) {
    const resultado = await actualizarTarea(id, { completada: !actual })
    if (!resultado.ok) { notify('No se pudo actualizar la tarea', false); return }
    notify(!actual ? 'Tarea completada' : 'Tarea marcada como pendiente')
    recargar()
  }

  async function eliminarTarea(id: string) {
    const resultado = await eliminarTareaApi(id)
    if (!resultado.ok) { notify('No se pudo eliminar la tarea', false); return }
    notify('Tarea eliminada')
    recargar()
  }

  async function editarTarea(id: string, nuevoTitulo: string) {
    const resultado = await actualizarTarea(id, { titulo: nuevoTitulo })
    if (!resultado.ok) { notify('No se pudo editar la tarea', false); return }
    notify('Tarea actualizada')
    recargar()
  }

  const materiaOpciones = [
    { id: 'todas', label: 'Todas', color: undefined, icon: undefined },
    ...materias.map((m) => ({ id: m.id, label: m.nombre, color: m.color, icon: <IconoMateria icono={m.icono} size={12} /> })),
  ]

  const visibles = useMemo(() => {
    return tareas
      .filter((t) => {
        if (materiaFiltro !== 'todas' && t.materia_id !== materiaFiltro) return false
        if (estadoFiltro === 'pendientes' && t.completada) return false
        if (estadoFiltro === 'completadas' && !t.completada) return false
        return true
      })
      .sort((a, b) => {
        if (a.completada !== b.completada) return a.completada ? 1 : -1
        if (!a.fecha_entrega) return 1
        if (!b.fecha_entrega) return -1
        return a.fecha_entrega.localeCompare(b.fecha_entrega)
      })
  }, [tareas, materiaFiltro, estadoFiltro])

  const pendientes = tareas.filter((t) => !t.completada).length
  const vencidas = tareas.filter((t) => !t.completada && t.fecha_entrega && new Date(t.fecha_entrega + 'T00:00:00') < new Date(new Date().toDateString())).length
  const completadas = tareas.filter((t) => t.completada).length
  const hoyStr = new Date().toISOString().slice(0, 10)
  const tareasHoy = tareas.filter((t) => !t.completada && t.fecha_entrega === hoyStr).length

  return (
    <main className="relative z-10 min-h-screen px-6 lg:pl-24 py-12 pb-28 max-w-6xl mx-auto">
      <BannerInvitado />
      <header className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[32px] font-semibold text-paper tracking-tight mb-1">Agenda</h1>
          <p className="text-muted text-sm mb-4">Tareas pendientes, organizadas por materia</p>
          <div className="flex items-center gap-4 font-mono text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-coral" /><b className="text-paper text-sm font-normal">{pendientes}</b> pendientes</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-danger" /><b className="text-danger text-sm font-normal">{vencidas}</b> vencidas</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-success" /><b className="text-paper text-sm font-normal">{completadas}</b> completadas</span>
          </div>
        </div>

        <div className="text-right">
          {/* Sin sesión no hay a quién saludar por nombre — "Samuel" es el
              único usuario real de hoy, hardcodeado desde antes de que
              existiera modo invitado (deuda técnica preexistente, ver
              PROJECT_CONTEXT.md); un invitado nunca debe verlo. */}
          <p className="text-paper text-sm font-medium mb-0.5">{invitado ? saludo() : `${saludo()}, Samuel 👋`}</p>
          <p className="text-muted text-xs mb-2">
            {tareasHoy > 0 ? `Tienes ${tareasHoy} tarea${tareasHoy === 1 ? '' : 's'} pendiente${tareasHoy === 1 ? '' : 's'} para hoy.` : 'No tienes tareas para hoy 🎉'}
          </p>
          {/* Sin sesión, /api/notificaciones 401 en silencio (campana vacía,
              sin error visible) — pero seguiría disparando una llamada de
              red inútil en cada carga. Se oculta entero para invitado.
              `!cargando &&`: `invitado` empieza en `false` hasta que el
              efecto de carga lo resuelve — sin este chequeo, la campana
              montaría de todos modos en ese primer instante y dispararía
              el fetch igual, antes de desmontarse. */}
          {!cargando && !invitado && <NotificationBell materias={materias} />}
        </div>
      </header>

      {error && <p className="text-danger text-sm mb-4">Error: {error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
        <div>
          {avisoDuplicado && (
            <AvisoDuplicadoMateria
              nombreNuevo={avisoDuplicado.nombreNuevo}
              aviso={avisoDuplicado.aviso}
              onFusionar={fusionarConSugerido}
              onDescartar={() => setAvisoDuplicado(null)}
            />
          )}
          <AddTaskBar materias={materias} horario={horario} onAdd={agregarTarea} />

          <div className="flex items-center justify-end gap-2 mb-4">
            <PremiumSelect id="estado-filtro" options={ESTADOS} value={estadoFiltro} onChange={setEstadoFiltro} />
            <PremiumSelect id="materia-filtro" options={materiaOpciones} value={materiaFiltro} onChange={setMateriaFiltro} />
          </div>

          <TaskTable tareas={visibles} materias={materias} onToggle={toggle} onDelete={eliminarTarea} onEdit={editarTarea} />
        </div>

        <div className="flex flex-col gap-4">
          <MiniCalendar tareas={tareas} seleccionado={diaModal} onSelect={setDiaModal} />
          <AgendaSummary materias={materias} tareas={tareas} />
        </div>
      </div>

      <DayDetailModal
        fecha={diaModal}
        tareas={tareas.filter((t) => t.fecha_entrega === diaModal)}
        materias={materias}
        onClose={() => setDiaModal(null)}
        onToggle={toggle}
        onDelete={eliminarTarea}
      />
    </main>
  )
}
