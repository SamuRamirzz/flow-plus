'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Plus, CalendarClock, ImagePlus, Loader2, Eraser } from 'lucide-react'
import type { Materia } from '@/lib/types'
import type { BloqueHorario, DiaSemana } from '@/lib/horario/tipos'
import { cargarHorario } from '@/lib/horario/cargar'
import { filaABloqueHorario, type FilaHorario } from '@/lib/horario/mapear'
import { crearBloqueHorario, eliminarBloqueHorario, actualizarBloqueHorario } from '@/lib/horario/mutar'
import { importarHorarioDesdeFoto } from '@/lib/horario/importarFoto'
import { diffTieneCambios, type DiffHorario } from '@/lib/horario/diff'
import { detectarConflictosFusion, construirPlanFusion, type DecisionConflicto } from '@/lib/horario/conflictos'
import { aplicarCreaciones, aplicarCambiosHora, aplicarCambiosMateria, limpiarTodosLosBloques } from '@/lib/horario/aplicarImportacion'
import type { ClassScheduleAgentOutput } from '@/lib/ai/agents/classSchedule'
import { cargarMaterias, crearMateria } from '@/lib/tasks'
import { useToast } from '@/lib/toast'
import { useRealtimeSync } from '@/lib/useRealtimeSync'
import { reconciliar } from '@/lib/realtimeReconciliar'
import MateriaPicker, { MATERIA_NUEVA } from '@/components/ui/MateriaPicker'
import SegmentedToggle from '@/components/ui/SegmentedToggle'
import BotonConfirmacion from '@/components/ui/BotonConfirmacion'
import PremiumTimePicker from '@/components/ui/PremiumTimePicker'
import BorderGlow from '@/components/reactbits/BorderGlow'
import PropuestaFoto from '@/components/horario/PropuestaFoto'
import ResolverImportacion from '@/components/horario/ResolverImportacion'
import GrillaSemanal from '@/components/horario/GrillaSemanal'
import EditarBloqueModal, { type CambiosBloqueEditado } from '@/components/horario/EditarBloqueModal'

const DIAS: { value: DiaSemana; nombre: string; letra: string }[] = [
  { value: 1, nombre: 'Lunes', letra: 'L' },
  { value: 2, nombre: 'Martes', letra: 'M' },
  { value: 3, nombre: 'Miércoles', letra: 'X' },
  { value: 4, nombre: 'Jueves', letra: 'J' },
  { value: 5, nombre: 'Viernes', letra: 'V' },
  { value: 6, nombre: 'Sábado', letra: 'S' },
  { value: 7, nombre: 'Domingo', letra: 'D' },
]

const DIA_OPCIONES = DIAS.map((d) => ({ value: String(d.value), label: d.letra }))

export default function HorarioPage() {
  const { notify } = useToast()
  const [materias, setMaterias] = useState<Materia[]>([])
  const [bloques, setBloques] = useState<BloqueHorario[]>([])
  const [cargando, setCargando] = useState(true)

  const [materiaId, setMateriaId] = useState<string>(MATERIA_NUEVA)
  const [nuevaMateria, setNuevaMateria] = useState('')
  const [diaSemana, setDiaSemana] = useState('1')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Sprint 8 — importar por foto. `propuesta` es lo que la IA leyó y todavía
  // NO está guardado: el agente nunca escribe (autonomyLevel de solo
  // propuesta), el guardado ocurre en confirmarPropuesta() con los mismos
  // endpoints del Sprint 7 que usa el alta manual.
  const [analizando, setAnalizando] = useState(false)
  const [propuesta, setPropuesta] = useState<{ salida: ClassScheduleAgentOutput; diff: DiffHorario } | null>(null)
  const [guardandoPropuesta, setGuardandoPropuesta] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  // Sub-sprint 8.2 Parte A — clic-para-editar. `bloqueEditando` es el
  // bloque real (no una copia): EditarBloqueModal lee sus valores para
  // inicializar el formulario y se remonta solo (`key={bloque.id}`) cuando
  // cambia a un bloque distinto.
  const [bloqueEditando, setBloqueEditando] = useState<BloqueHorario | null>(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  // Parte B — "Limpiar horario".
  const [limpiando, setLimpiando] = useState(false)

  // Patrón "fetch en un Effect" con guarda de montaje — evita el update de
  // estado obsoleto si el componente se desmonta antes de que resuelva, y
  // es lo que hace que este efecto no dispare react-hooks/set-state-in-effect
  // (ver app/page.tsx para el mismo patrón, ya verificado contra el lint).
  useEffect(() => {
    let activo = true
    ;(async () => {
      const [mData, hData] = await Promise.all([cargarMaterias(), cargarHorario()])
      if (!activo) return
      setMaterias(mData)
      setBloques(hData)
      setCargando(false)
    })()
    return () => {
      activo = false
    }
  }, [])

  // Sincronización en tiempo real entre dispositivos — esta pantalla no
  // usa useDatosAgenda() (mantiene su propio estado local, con sus propias
  // funciones de recarga tras cada mutación), así que se wirea acá aparte.
  // No necesita `tareas`. Mismo criterio de idempotencia que
  // lib/useDatosAgenda.ts: el eco de una escritura propia no duplica nada.
  useRealtimeSync<Materia>('materias', !cargando, (evento) => setMaterias((actuales) => reconciliar(actuales, evento)))
  useRealtimeSync<FilaHorario>('horario', !cargando, (evento) =>
    setBloques((actuales) => reconciliar(actuales, { tipo: evento.tipo, fila: filaABloqueHorario(evento.fila) }))
  )

  async function agregarBloque() {
    if (guardando) return
    let materiaIdFinal = materiaId

    if (materiaId === MATERIA_NUEVA) {
      const nombre = nuevaMateria.trim()
      if (!nombre) return
      setGuardando(true)
      const resultadoMateria = await crearMateria(nombre)
      if (!resultadoMateria.ok) {
        notify('No se pudo crear la materia', false)
        setGuardando(false)
        return
      }
      materiaIdFinal = resultadoMateria.materia.id
      setMaterias((actuales) => [...actuales, resultadoMateria.materia])
    } else {
      setGuardando(true)
    }

    const resultado = await crearBloqueHorario({
      materiaId: materiaIdFinal,
      diaSemana: Number(diaSemana) as DiaSemana,
      horaInicio: horaInicio || null,
      horaFin: horaFin || null,
    })
    setGuardando(false)

    if (!resultado.ok) {
      notify(resultado.error, false)
      return
    }

    setBloques((actuales) => [...actuales, resultado.bloque])
    notify('Bloque agregado')
    setNuevaMateria('')
    setHoraInicio('')
    setHoraFin('')
  }

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    // El input se limpia siempre: si no, elegir la MISMA foto otra vez no
    // dispara el change y el usuario cree que la app se colgó.
    e.target.value = ''
    if (!archivo || analizando) return

    setAnalizando(true)
    setPropuesta(null)
    const resultado = await importarHorarioDesdeFoto(archivo)
    setAnalizando(false)

    if (!resultado.ok) {
      notify(resultado.error, false)
      return
    }
    setPropuesta({ salida: resultado.salida, diff: resultado.diff })
  }

  // Guarda la propuesta usando EXACTAMENTE los mismos endpoints que el alta
  // manual (crearBloqueHorario / actualizarBloqueHorario) — el agente no
  // escribe y acá no se duplica lógica de escritura.
  //
  // Los `eliminados` del diff NO se tocan a propósito: que una materia no
  // aparezca en la foto no prueba que ya no exista (la foto puede estar
  // recortada, o ser solo de un semestre). Borrar es irreversible; se
  // muestran en la lista para que el usuario los quite a mano si quiere.
  async function confirmarPropuesta() {
    if (!propuesta || guardandoPropuesta) return
    setGuardandoPropuesta(true)

    // aplicarCreaciones/aplicarCambiosHora (lib/horario/aplicarImportacion.ts)
    // son las mismas funciones que usan reemplazarTodoImportacion() y
    // fusionarImportacion() más abajo — un solo lugar resuelve materia +
    // escribe, en vez de repetir el bucle en cada camino.
    const resCrear = await aplicarCreaciones(propuesta.diff.agregados, materias)
    const resHora = await aplicarCambiosHora(
      propuesta.diff.movidos.map((m) => ({ id: m.antes.id, horaInicio: m.despues.horaInicio, horaFin: m.despues.horaFin }))
    )

    setMaterias(resCrear.materiasActuales)
    setBloques(await cargarHorario())
    setGuardandoPropuesta(false)
    setPropuesta(null)

    if (resCrear.errores.length > 0 || resHora.errores.length > 0) notify('Algunos bloques no se pudieron guardar', false)

    const partes: string[] = []
    if (resCrear.aplicados > 0) partes.push(`${resCrear.aplicados} ${resCrear.aplicados === 1 ? 'bloque nuevo' : 'bloques nuevos'}`)
    if (resHora.aplicados > 0) partes.push(`${resHora.aplicados} ${resHora.aplicados === 1 ? 'actualizado' : 'actualizados'}`)
    notify(partes.length > 0 ? `Horario: ${partes.join(', ')}` : 'No se guardó ningún bloque', partes.length > 0)
  }

  // Parte C — el usuario ya tenía un horario guardado y decide REEMPLAZARLO
  // por completo: se borra todo (mismo camino que "Limpiar horario") y se
  // crean todos los bloques de la foto desde cero, sin pasar por el diff
  // (contra un horario vacío, todo sería "agregado" de todas formas).
  async function reemplazarTodoImportacion() {
    if (!propuesta || propuesta.salida.tipoRespuesta !== 'bloques' || guardandoPropuesta) return
    setGuardandoPropuesta(true)

    const { errores: erroresLimpiar } = await limpiarTodosLosBloques(bloques)
    if (erroresLimpiar.length > 0) {
      setGuardandoPropuesta(false)
      notify('No se pudo limpiar el horario actual', false)
      return
    }

    const resCrear = await aplicarCreaciones(propuesta.salida.bloques, materias)
    setMaterias(resCrear.materiasActuales)
    setBloques(await cargarHorario())
    setGuardandoPropuesta(false)
    setPropuesta(null)

    if (resCrear.errores.length > 0) notify(`Horario reemplazado con algunos errores (${resCrear.aplicados} bloques)`, false)
    else notify(`Horario reemplazado — ${resCrear.aplicados} ${resCrear.aplicados === 1 ? 'bloque' : 'bloques'}`)
  }

  function descartarPropuesta() {
    setPropuesta(null)
  }

  // Parte C — fusión: construirPlanFusion (puro, lib/horario/conflictos.ts)
  // decide QUÉ hacer con cada franja según las decisiones que ya tomó el
  // usuario en ResolverImportacion; acá solo se ejecuta ese plan.
  async function fusionarImportacion(decisiones: Record<string, DecisionConflicto>) {
    if (!propuesta || propuesta.salida.tipoRespuesta !== 'bloques' || guardandoPropuesta) return
    setGuardandoPropuesta(true)

    const nombrePorMateriaId = new Map(materias.map((m) => [m.id, m.nombre]))
    const conflictos = detectarConflictosFusion({ guardado: bloques, propuesto: propuesta.salida.bloques, nombrePorMateriaId })
    const plan = construirPlanFusion({ diff: propuesta.diff, conflictos, decisiones })

    const resCrear = await aplicarCreaciones(plan.crear, materias)
    const resHora = await aplicarCambiosHora(plan.actualizarHora)
    const resMateria = await aplicarCambiosMateria(plan.actualizarMateria, resCrear.materiasActuales)

    setMaterias(resMateria.materiasActuales)
    setBloques(await cargarHorario())
    setGuardandoPropuesta(false)
    setPropuesta(null)

    const aplicados = resCrear.aplicados + resHora.aplicados + resMateria.aplicados
    const huboErrores = resCrear.errores.length > 0 || resHora.errores.length > 0 || resMateria.errores.length > 0
    if (huboErrores) notify('Fusión aplicada con algunos errores', false)
    notify(aplicados > 0 ? `Horario fusionado — ${aplicados} ${aplicados === 1 ? 'cambio' : 'cambios'}` : 'Nada que fusionar, ya estaba al día', aplicados > 0)
  }

  // Parte B — confirmación de dos toques vía BotonConfirmacion. La grilla
  // queda vacía de inmediato (sin refetch) para que se vea el estado "Sin
  // clases" al toque, no después de una vuelta al servidor.
  async function limpiarHorario() {
    if (bloques.length === 0 || limpiando) return
    setLimpiando(true)
    const { errores } = await limpiarTodosLosBloques(bloques)
    setLimpiando(false)

    if (errores.length > 0) {
      notify('Algunos bloques no se pudieron borrar', false)
      setBloques(await cargarHorario())
      return
    }
    setBloques([])
    notify('Horario limpiado')
  }

  // Parte A — edición inline.
  async function guardarEdicionBloque(cambios: CambiosBloqueEditado) {
    if (!bloqueEditando) return
    setGuardandoEdicion(true)

    let materiaId = cambios.materiaId
    let materiasActuales = materias
    if (materiaId === MATERIA_NUEVA) {
      const resMateria = await crearMateria(cambios.nuevaMateria)
      if (!resMateria.ok) {
        notify('No se pudo crear la materia', false)
        setGuardandoEdicion(false)
        return
      }
      materiaId = resMateria.materia.id
      materiasActuales = [...materiasActuales, resMateria.materia]
    }

    const resultado = await actualizarBloqueHorario(bloqueEditando.id, {
      materiaId,
      horaInicio: cambios.horaInicio || null,
      horaFin: cambios.horaFin || null,
      aula: cambios.aula || null,
      profesor: cambios.profesor || null,
    })
    setGuardandoEdicion(false)

    if (!resultado.ok) {
      notify(resultado.error, false)
      return
    }
    setMaterias(materiasActuales)
    setBloques((actuales) => actuales.map((b) => (b.id === resultado.bloque.id ? resultado.bloque : b)))
    setBloqueEditando(null)
    notify('Bloque actualizado')
  }

  async function eliminarBloqueDesdeModal() {
    if (!bloqueEditando) return
    const id = bloqueEditando.id
    setBloqueEditando(null)
    await quitarBloque(id)
  }

  async function quitarBloque(id: string) {
    const resultado = await eliminarBloqueHorario(id)
    if (!resultado.ok) {
      notify('No se pudo eliminar el bloque', false)
      return
    }
    setBloques((actuales) => actuales.filter((b) => b.id !== id))
    notify('Bloque eliminado')
  }

  const puedeAgregar = materiaId !== MATERIA_NUEVA || nuevaMateria.trim().length > 0

  // `overflow-x-hidden` en el <main>: el fondo WebGL y el dock se pasan unos
  // pocos píxeles del viewport en móvil y provocan scroll horizontal de toda
  // la página (ocurre igual en `/`, es anterior a esta pantalla). Es el mismo
  // remedio que ya aplica `app/ai/page.tsx`. La grilla gestiona su propio
  // scroll horizontal por dentro, así que esto no le quita nada.
  return (
    <main className="relative z-10 min-h-screen px-6 py-16 pb-28 max-w-6xl mx-auto lg:pl-24 overflow-x-hidden">
      <div className="mb-10">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-coral mb-4">
          <CalendarClock size={12} />
          Horario
        </span>
        <h1 className="font-display text-[32px] sm:text-[40px] font-semibold text-paper tracking-tight mb-2">Tu horario de clases</h1>
        <p className="text-muted text-sm max-w-lg">
          Guarda qué materia se dicta cada día — la IA lo usa para poner la fecha automáticamente cuando creas una tarea sin decir cuándo es.
        </p>

        <input ref={inputFotoRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={elegirFoto} className="hidden" />
        <div className="flex flex-wrap items-center gap-2.5 mt-5">
          <button
            onClick={() => inputFotoRef.current?.click()}
            disabled={analizando}
            className="inline-flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full bg-panel-glass backdrop-blur-md text-paper hover:bg-panel-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {analizando ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            {analizando ? 'Leyendo la foto…' : 'Importar desde una foto'}
          </button>
          {bloques.length > 0 && (
            <BotonConfirmacion
              onConfirmar={limpiarHorario}
              etiqueta={limpiando ? 'Borrando…' : 'Limpiar horario'}
              etiquetaConfirmar="¿Seguro? Borrar todo"
              icono={limpiando ? <Loader2 size={13} className="animate-spin" /> : <Eraser size={13} />}
              disabled={limpiando}
            />
          )}
        </div>
      </div>

      {/* Parte C — con horario existente Y cambios de verdad que resolver, la
          decisión de tres vías reemplaza al flujo simple de PropuestaFoto
          (que se queda para horario vacío, sin cambios, o el caso de error). */}
      <AnimatePresence>
        {propuesta &&
          (propuesta.salida.tipoRespuesta === 'bloques' && bloques.length > 0 && diffTieneCambios(propuesta.diff) ? (
            <ResolverImportacion
              key="resolver"
              salida={propuesta.salida}
              diff={propuesta.diff}
              bloquesActuales={bloques}
              materias={materias}
              aplicando={guardandoPropuesta}
              onReemplazarTodo={reemplazarTodoImportacion}
              onDescartar={descartarPropuesta}
              onFusionar={fusionarImportacion}
            />
          ) : (
            <PropuestaFoto
              key="propuesta"
              salida={propuesta.salida}
              diff={propuesta.diff}
              materias={materias}
              guardando={guardandoPropuesta}
              onConfirmar={confirmarPropuesta}
              onDescartar={descartarPropuesta}
            />
          ))}
      </AnimatePresence>

      <BorderGlow
        backgroundColor="var(--color-panel-glass)"
        borderRadius={20}
        glowRadius={28}
        glowIntensity={0.6}
        fillOpacity={0.4}
        edgeSensitivity={35}
        coneSpread={28}
        glowColor="14 100 65"
        className="mb-8"
      >
        <div className="p-5">
          <p className="font-display text-sm font-semibold text-paper mb-3.5">Agregar un bloque</p>

          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <MateriaPicker
              id="materia-horario"
              materias={materias}
              materiaId={materiaId}
              nuevaMateria={nuevaMateria}
              onMateriaIdChange={setMateriaId}
              onNuevaMateriaChange={setNuevaMateria}
            />
            <SegmentedToggle options={DIA_OPCIONES} value={diaSemana} onChange={setDiaSemana} />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <PremiumTimePicker value={horaInicio} onChange={setHoraInicio} label="Hora de inicio" />
            <span className="text-muted text-xs">a</span>
            <PremiumTimePicker value={horaFin} onChange={setHoraFin} label="Hora de fin" />

            <button
              onClick={agregarBloque}
              disabled={!puedeAgregar || guardando}
              className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-5 py-2.5 rounded-full transition ${
                puedeAgregar && !guardando ? 'bg-coral text-ink hover:opacity-90 cursor-pointer' : 'bg-panel-2 text-muted cursor-not-allowed'
              }`}
            >
              Agregar
              <Plus size={14} />
            </button>
          </div>
        </div>
      </BorderGlow>

      <GrillaSemanal bloques={bloques} materias={materias} cargando={cargando} onQuitar={quitarBloque} onEditar={setBloqueEditando} />

      <EditarBloqueModal
        bloque={bloqueEditando}
        materias={materias}
        guardando={guardandoEdicion}
        onGuardar={guardarEdicionBloque}
        onEliminar={eliminarBloqueDesdeModal}
        onCerrar={() => setBloqueEditando(null)}
      />
    </main>
  )
}
