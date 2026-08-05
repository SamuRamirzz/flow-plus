'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/lib/toast'
import type { Materia, Tarea } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import { cargarHorario } from '@/lib/horario/cargar'
import { crearTarea, cargarTareas, actualizarTarea as actualizarTareaApi, eliminarTarea as eliminarTareaApi, fusionarMaterias } from '@/lib/tasks'
import { MATERIA_NUEVA } from '@/components/ui/MateriaPicker'
import { type OperacionEditable } from '@/components/ai/OperacionRow'
import { materiaParaNombre } from '@/components/ai/conversacion'
import { payloadDeshacer, type RegistroOperacion } from '@/components/ai/registroOperaciones'
import { createId } from '@/lib/ai/utils'
import { mensajeAvisoCalendario, type PosibleDuplicadoMateria } from '@/lib/ai/agents/calendar'
import { useAdjuntosPendientes, type AdjuntoPendiente } from '@/lib/ai/useAdjuntosPendientes'
import AdjuntoBoton from '@/components/ai/AdjuntoBoton'
import DictadoBoton from '@/components/ai/DictadoBoton'
import AdjuntosPendientesChips from '@/components/ai/AdjuntosPendientesChips'
import AIImmersiveOverlay from '@/components/ai/AIImmersiveOverlay'
import TaskListPanel from '@/components/ai/TaskListPanel'
import { overlayFaseReducer, FASE1_EXPANSION_MS, FASE2_VACIO_MS, RADIO_PILDORA, type RectOrigen } from '@/components/ai/overlayLogic'
import BorderGlow from '@/components/reactbits/BorderGlow'
import TextType from '@/components/reactbits/TextType'
import { ShimmeringText } from '@/components/animate-ui/ShimmeringText'

const EJEMPLOS = [
  'Examen de química el jueves, repasar todo el fin de semana',
  'Entregar el ensayo de literatura el lunes',
  'Leer el capítulo 4 de historia antes del viernes',
]

// Sub-sprint 7.5 Parte A — ciclo de frases del heading en estado idle. La
// primera es la que ya existía ("¿Qué tienes en mente?") para no perder esa
// voz; las demás son variaciones del mismo tono (tuteo, directo) sin repetir
// la misma apertura. Es también la frase que queda fija cuando el usuario
// empieza a interactuar (ver `interactuando` más abajo) — por eso es la
// primera del arreglo, no una al azar.
//
// ⚠️ SI AGREGAS O CAMBIAS UNA FRASE ACÁ: el `min-h-[...]` del <motion.h1>
// de más abajo NO es font-size×1.05×líneas — se midió pixel por pixel
// contra el DOM real porque esa fórmula da mal: el cursor de TextType
// (span "ml-1 inline-block" con "|") por sí solo, sin importar cuánto texto
// haya, ya ocupa la altura de una línea EXTRA por su propio
// alineamiento de baseline — así que "1 línea de texto" en pantalla mide
// como 2 line-heights nominales, y "2 líneas de texto" miden como 3.
//
// Ajuste (4ta vuelta) — se ensanchó el contenedor (`main` pasó de
// max-w-3xl/6xl a max-w-4xl/7xl, ver más abajo en el JSX) específicamente
// para que las frases largas necesiten MENOS líneas: remedido contra el DOM
// real con ese ancho nuevo, el peor caso real en lg bajó de 189px (≈3
// line-heights nominales) a 126px (≈2) — es decir, de "2 líneas de texto +
// cursor" a "1 línea de texto + cursor" en el breakpoint más ancho. En
// mobile/sm el ancho disponible no cambió (el viewport ya era más angosto
// que el max-w viejo Y el nuevo, así que ensanchar el contenedor no mueve
// la aguja ahí) — sus valores siguen siendo los mismos medidos antes.
// Valores actuales (375/768/1440px): 94.5px / 92.4px / 126px, con ~2px de
// margen sobre el máximo real encontrado en cada uno (96/94/128px).
// Se midió también "Todo listo" (ShimmeringText, rama nueva de
// `confirmacionVisible` más abajo) en los 3 breakpoints — nunca pasa de 1
// línea (31.5/46.2/63px), no es el peor caso en ningún breakpoint.
//
// Procedimiento para comprobarlo con una frase nueva (no hay test
// automatizado — Playwright no es dependencia del proyecto, solo se usó ad
// hoc para esta medición):
//   1. Con `npm run dev` corriendo, en cada breakpoint (375/768/1440px de
//      ancho de viewport, en 1440px probar TANTO con panelVisible=false
//      como =true — el ancho disponible del h1 difiere entre esos dos
//      estados), medí contra el h1 REAL (no un cálculo a mano): para cada
//      prefijo de la frase nueva (1 carácter, 2 caracteres... hasta la
//      frase completa), poné ese prefijo + el cursor real (span
//      "ml-1 inline-block" con "|") como contenido del h1 y leé
//      `document.querySelector('h1').getBoundingClientRect().height` (con
//      `h1.style.minHeight = '0px'` puesto antes de medir, para ver la
//      altura NATURAL sin el piso actual tapando el resultado).
//   2. Si el máximo encontrado supera el `min-h-[...]` actual de ese
//      breakpoint, subilo a ese máximo real (no a una fórmula).
const FRASES_BIENVENIDA = [
  '¿Qué tienes en mente?',
  'Cuéntame tu próxima tarea',
  '¿Qué necesitas entregar esta semana?',
  'Hablemos de tu próximo examen',
  '¿Se te quedó algo pendiente?',
]

// Respiro entre que el overlay termina de cerrarse y que la página empieza
// a reacomodarse a dos columnas — deja que el ojo registre "volví a la
// pantalla principal" antes de que todo se mueva otra vez.
const RESPIRO_POST_CIERRE_MS = 260

// Ajuste — 2600ms no le daba tiempo al ojo: justo después de aplicar, la
// atención del usuario está en el botón "¡Listo!" que acaba de tocar (columna
// izquierda), no en la columna "TAREAS" (derecha) donde vive el shimmer —
// para cuando el usuario mira para allá, muchas veces ya se apagó.
// Confirmado por el propio usuario: la tarea se aplicaba bien, el shimmer
// simplemente nunca alcanzaba a verse. No es un bug de render (confirmado
// con capturas reales en los 3 tipos de operación y ambas superficies) —
// es que la ventana era demasiado corta para un patrón de atención humano
// normal. Un solo valor con nombre para los dos timers que la usan
// (aplicarOperaciones y alCerrarseOverlay) — antes eran dos "2600" sueltos
// que podían desincronizarse si se tocaba uno sin el otro.
const CONFIRMACION_VISIBLE_MS = 4200

// Curva "asentándose", el mismo lenguaje de movimiento del overlay.
const EASE_ASENTAR = [0.16, 1, 0.3, 1] as [number, number, number, number]

export default function AIPage() {
  const { notify } = useToast()

  const [materias, setMaterias] = useState<Materia[]>([])
  const [horario, setHorario] = useState<BloqueHorario[]>([])
  // Cierre de Fase 1 — dedup semántico. Mismo criterio que app/page.tsx: un
  // solo aviso a la vez, la última materia nueva de la corrida gana si el
  // turno crea más de una.
  const [avisoDuplicado, setAvisoDuplicado] = useState<{ materiaOrigenId: string; nombreNuevo: string; aviso: PosibleDuplicadoMateria } | null>(null)
  const [texto, setTexto] = useState('')
  // Sub-sprint 7.5 Parte A — una vez el usuario interactúa (foco en el
  // textarea, incluido el foco programático que dispara usarEjemplo()), el
  // heading deja de escribirse/borrarse solo: no debe competir por atención
  // con lo que el usuario está tratando de escribir. Nunca vuelve a false
  // — no tiene sentido "reactivar" la animación a mitad de una sesión.
  const [interactuando, setInteractuando] = useState(false)
  // El mensaje que de verdad se manda como primer turno — capturado aparte
  // de `texto` porque abrirAnalisis() limpia la caja de compose en el
  // mismo batch de setState en que abre el overlay (React no re-renderiza
  // entre ambos), así que pasarle `texto` directamente al overlay le
  // llegaría vacío.
  const [mensajeEnviado, setMensajeEnviado] = useState('')
  // Sub-sprint 7.3/7.3.1 — archivos adjuntados antes de analizar (foto,
  // PDF, o texto). Mismo motivo de "capturado aparte" que mensajeEnviado:
  // abrirAnalisis() limpia la lista en el mismo batch en que abre el overlay.
  const { adjuntos: adjuntosPendientes, agregar: agregarAdjuntos, quitar: quitarAdjunto, limpiar: limpiarAdjuntos } = useAdjuntosPendientes()
  const [adjuntosEnviados, setAdjuntosEnviados] = useState<AdjuntoPendiente[]>([])
  const [fase, dispatch] = useReducer(overlayFaseReducer, 'idle')

  // Rect real del botón medido en el clic — origen/destino de la caja del
  // overlay. Se mide siempre en vivo porque el botón cambia de posición
  // cuando la página se reacomoda a dos columnas.
  const [origen, setOrigen] = useState<RectOrigen | null>(null)

  // El botón permanece oculto hasta que la caja del overlay terminó de
  // colapsar de verdad (fin del `exit`), no tras un delay fijo: el spring
  // puede sobrepasar levemente el rect de destino, y con un delay estimado
  // el botón asomaría por debajo justo antes de que la caja lo cubra.
  const [overlayEnPantalla, setOverlayEnPantalla] = useState(false)

  // Tareas reales del usuario: se cargan independientemente del resultado
  // de la IA (la columna "TAREAS" nunca debe quedar en blanco porque el
  // agente haya fallado).
  const [tareasActuales, setTareasActuales] = useState<Tarea[] | null>(null)
  const [cargandoTareas, setCargandoTareas] = useState(false)

  // Sprint 7.2 Parte B: registro de operaciones REALES aplicadas contra
  // Supabase en esta visita a /ai — a propósito vive acá y NO se resetea
  // cuando el overlay se cierra (a diferencia de la conversación de turnos,
  // que sí vive y muere con el overlay). El panel de tareas de la página
  // (después de cerrar el overlay) también debe poder mostrar "esto se
  // cambió" y ofrecer Deshacer — es la razón de que ese panel exista. Se
  // pierde al recargar la página o salir de /ai: es memoria de sesión, no
  // la persistente de Supabase que sigue siendo Sprint 9.
  const [registroOperaciones, setRegistroOperaciones] = useState<RegistroOperacion[]>([])

  // Panel de tareas de la página (Parte D). Estado local de sesión: si el
  // usuario navega fuera de /ai y vuelve, la página arranca de nuevo en su
  // layout de una sola columna. Es intencional — no se persiste UI state.
  const [panelVisible, setPanelVisible] = useState(false)
  const huboCambioRef = useRef(false)

  // Sub-sprint 7.5 Parte B — "Todo listo" con ShimmeringText, disparado cada
  // vez que aplicarOperaciones() completa al menos un cambio de verdad
  // (crear/modificar/borrar). Se apaga solo a los pocos segundos: no es un
  // estado permanente, es una confirmación puntual — ver TaskListPanel para
  // el render (mismo estado alimenta la columna del overlay Y el panel de
  // la página, para no duplicar el disparo en dos sitios).
  const [confirmacionVisible, setConfirmacionVisible] = useState(false)
  const confirmacionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const respiroTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let activo = true
    Promise.all([supabase.from('materias').select('*').order('created_at'), cargarHorario()]).then(([materiasRes, horarioData]) => {
      if (!activo) return
      setMaterias(materiasRes.data ?? [])
      setHorario(horarioData)
    })
    return () => {
      activo = false
    }
  }, [])

  // Temporizadores disparados fuera de un useEffect con cleanup propio.
  useEffect(() => {
    return () => {
      if (respiroTimeoutRef.current) clearTimeout(respiroTimeoutRef.current)
      if (confirmacionTimeoutRef.current) clearTimeout(confirmacionTimeoutRef.current)
    }
  }, [])

  // Temporizadores de la coreografía del overlay — cada uno solo avanza la
  // fase que le corresponde (ver overlayFaseReducer). El fetch del primer
  // mensaje ya no corre acá (Sprint 7.2 Parte A): lo dispara el propio
  // overlay al montar, con `mensajeInicial`.
  useEffect(() => {
    if (fase !== 'expanding') return
    const t = setTimeout(() => dispatch({ type: 'EXPANSION_LISTA' }), FASE1_EXPANSION_MS)
    return () => clearTimeout(t)
  }, [fase])

  useEffect(() => {
    if (fase !== 'loading') return
    const t = setTimeout(() => dispatch({ type: 'REVELAR' }), FASE2_VACIO_MS)
    return () => clearTimeout(t)
  }, [fase])

  // 'cerrando' dura solo lo que tarda el contenido en desvanecerse; el
  // colapso de la caja lo hace la animación de `exit` del overlay una vez
  // que fase vuelve a 'idle' y AnimatePresence lo desmonta. Ya no hay
  // estado de conversación que limpiar acá — vive dentro del overlay y
  // desaparece solo al desmontarse (Sprint 7.2 Parte A).
  useEffect(() => {
    if (fase !== 'cerrando') return
    const t = setTimeout(() => dispatch({ type: 'CERRADO' }), 200)
    return () => clearTimeout(t)
  }, [fase])

  function usarEjemplo(ejemplo: string) {
    setTexto(ejemplo)
    textareaRef.current?.focus()
  }

  const refrescarTareas = useCallback(async () => {
    setCargandoTareas(true)
    const frescas = await cargarTareas()
    setTareasActuales(frescas)
    setCargandoTareas(false)
  }, [])

  function abrirAnalisis() {
    if ((!texto.trim() && adjuntosPendientes.length === 0) || fase !== 'idle') return
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    setOrigen({ top: r.top, left: r.left, width: r.width, height: r.height })
    setOverlayEnPantalla(true)
    dispatch({ type: 'ABRIR' })
    refrescarTareas()
    // El overlay manda `mensajeEnviado`/`adjuntosEnviados` como su propio
    // primer turno al montar — se limpian acá para que, si el usuario cierra
    // y abre una conversación nueva, no vea texto/adjuntos viejos en la caja
    // de compose.
    setMensajeEnviado(texto)
    setAdjuntosEnviados(adjuntosPendientes)
    setTexto('')
    limpiarAdjuntos()
  }

  // Sub-sprint 7.3.1 — pegar una imagen desde el portapapeles se trata igual
  // que elegirla por el picker. Si el portapapeles solo tiene texto, NO se
  // hace preventDefault: el pegado de texto normal sigue exactamente igual
  // que antes.
  function manejarPegado(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    const imagenes: File[] = []
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const archivo = item.getAsFile()
        if (archivo) imagenes.push(archivo)
      }
    }
    if (imagenes.length > 0) {
      e.preventDefault()
      agregarAdjuntos(imagenes)
    }
  }

  function manejarSoltar(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) agregarAdjuntos(e.dataTransfer.files)
  }

  // Aplica de verdad contra Supabase las operaciones de UN turno (crear vía
  // POST, modificar/borrar vía los mismos endpoints de app/api/tareas/[id]
  // ya construidos — nunca se duplica esa lógica de escritura). Cada
  // operación aplicada exitosamente se empuja a registroOperaciones para
  // que TaskListPanel pueda mostrarla y ofrecer Deshacer.
  async function aplicarOperaciones(operaciones: OperacionEditable[]): Promise<boolean> {
    let materiasActuales = materias
    let creadas = 0
    let modificadas = 0
    let borradas = 0
    const nuevos: RegistroOperacion[] = []
    // Sprint 10 — avisos pasivos de esFechaPlausible/detectarColisiones,
    // acumulados de TODAS las operaciones del turno para mostrarse en el
    // mismo notify() de resumen, nunca como modal ni por-fila.
    const avisos: string[] = []
    // Cierre de Fase 1 — dedup semántico: si el turno crea más de una
    // materia nueva, gana la última (mismo criterio de "un aviso a la vez").
    let duplicadoDeEsteRun: { materiaOrigenId: string; nombreNuevo: string; aviso: PosibleDuplicadoMateria } | null = null

    for (const op of operaciones) {
      if (op.tipo === 'crear') {
        const resultado = await crearTarea(
          {
            titulo: op.titulo,
            materiaId: op.materiaId === MATERIA_NUEVA ? null : op.materiaId,
            nuevaMateria: op.materiaId === MATERIA_NUEVA ? op.nuevaMateria.trim() : null,
            fecha: op.fecha,
            prioridad: op.prioridad,
            tipo: op.tipoTarea,
            fechaOrigen: 'ia',
            // Cierre de Fase 1 — conecta ExamAgent: el servidor solo lo usa
            // si tipo==='examen' (ver POST /api/tareas).
            textoOrigen: op.textoOrigen,
          },
          materiasActuales
        )
        if (!resultado.ok) {
          notify(`No se pudo crear "${op.titulo}"`, false)
          continue
        }
        creadas++
        nuevos.push({ id: createId('reg'), tipo: 'crear', tareaId: resultado.tareaCreada.id, titulo: resultado.tareaCreada.titulo, deshecho: false })
        if (resultado.materiaCreada) {
          materiasActuales = [...materiasActuales, resultado.materiaCreada]
          if (resultado.posibleDuplicado) {
            duplicadoDeEsteRun = { materiaOrigenId: resultado.materiaCreada.id, nombreNuevo: resultado.materiaCreada.nombre, aviso: resultado.posibleDuplicado }
          }
        }
        const avisoCreacion = mensajeAvisoCalendario(resultado.avisoFecha, resultado.colisiones)
        if (avisoCreacion) avisos.push(`"${resultado.tareaCreada.titulo}": ${avisoCreacion}`)
        continue
      }

      if (op.tipo === 'modificar') {
        // Snapshot del estado ANTERIOR real (no el `antes` aproximado del
        // agente, que no trae prioridad ni el id de materia) — necesario
        // para poder deshacer de verdad. Se lee de tareasActuales, que
        // refrescarTareas() ya mantiene al día tras cada aplicar.
        const estadoAnterior = tareasActuales?.find((t) => t.id === op.tareaId)

        // cambios.materia es un NOMBRE (igual que al crear) — se resuelve
        // igual que allá: materia existente por nombre → materiaId directo,
        // si no → nuevaMateria (el servidor la crea, ver PATCH /api/tareas/[id]).
        // Cuando NO cambia la materia, ninguna de las dos claves debe viajar
        // — ni siquiera como `null`: actualizarTareaSchema trata `null` como
        // "materia explícitamente vacía" (falla con "La tarea necesita una
        // materia"), no como "sin cambios". Solo `undefined` (clave
        // ausente del JSON) significa "no tocar este campo".
        const resolucionMateria = op.cambios.materia !== undefined ? materiaParaNombre(op.cambios.materia, materiasActuales) : null
        const resultado = await actualizarTareaApi(op.tareaId, {
          titulo: op.cambios.titulo,
          fecha: op.cambios.fecha,
          prioridad: op.cambios.prioridad,
          completada: op.cambios.completada,
          ...(op.cambios.fecha !== undefined ? { fechaOrigen: 'ia' as const } : {}),
          ...(resolucionMateria
            ? {
                materiaId: resolucionMateria.materiaId === MATERIA_NUEVA ? null : resolucionMateria.materiaId,
                nuevaMateria: resolucionMateria.materiaId === MATERIA_NUEVA ? resolucionMateria.nuevaMateria : null,
              }
            : {}),
        })
        if (!resultado.ok) {
          notify(`No se pudo modificar "${op.antes.titulo}"`, false)
          continue
        }
        modificadas++
        if (estadoAnterior) {
          nuevos.push({ id: createId('reg'), tipo: 'modificar', tareaId: op.tareaId, titulo: op.antes.titulo, estadoAnterior, cambiosAplicados: op.cambios, deshecho: false })
        }
        // resultado.tarea.materia_id YA es el id de la materia nueva en
        // este punto (la modificación ya se aplicó) — es el "origen" que se
        // fusionaría. resolucionMateria.nuevaMateria es su nombre: el mismo
        // que se mandó a crear, no hace falta leerlo de vuelta.
        if (resolucionMateria?.materiaId === MATERIA_NUEVA && resultado.posibleDuplicado) {
          duplicadoDeEsteRun = { materiaOrigenId: resultado.tarea.materia_id, nombreNuevo: resolucionMateria.nuevaMateria, aviso: resultado.posibleDuplicado }
        }
        const avisoModificacion = mensajeAvisoCalendario(resultado.avisoFecha, resultado.colisiones)
        if (avisoModificacion) avisos.push(`"${op.antes.titulo}": ${avisoModificacion}`)
        continue
      }

      if (op.tipo === 'borrar') {
        const resultado = await eliminarTareaApi(op.tareaId)
        if (!resultado.ok) {
          notify(`No se pudo eliminar "${op.antes.titulo}"`, false)
          continue
        }
        borradas++
        nuevos.push({ id: createId('reg'), tipo: 'borrar', tareaId: op.tareaId, titulo: op.antes.titulo, tareaEliminada: resultado.tareaEliminada, deshecho: false })
      }
      // 'sin_coincidencias' no se aplica — es puramente informativo.
    }

    setMaterias(materiasActuales)
    if (nuevos.length > 0) setRegistroOperaciones((actuales) => [...actuales, ...nuevos])
    if (duplicadoDeEsteRun) setAvisoDuplicado(duplicadoDeEsteRun)

    const total = creadas + modificadas + borradas
    if (total > 0) {
      const partes: string[] = []
      if (creadas > 0) partes.push(`${creadas} ${creadas === 1 ? 'creada' : 'creadas'}`)
      if (modificadas > 0) partes.push(`${modificadas} ${modificadas === 1 ? 'modificada' : 'modificadas'}`)
      if (borradas > 0) partes.push(`${borradas} ${borradas === 1 ? 'eliminada' : 'eliminadas'}`)
      const resumen = `Tareas: ${partes.join(', ')}`
      notify(avisos.length > 0 ? `${resumen} — ${avisos.join(' · ')}` : resumen)
      huboCambioRef.current = true
      await refrescarTareas()

      setConfirmacionVisible(true)
      if (confirmacionTimeoutRef.current) clearTimeout(confirmacionTimeoutRef.current)
      confirmacionTimeoutRef.current = setTimeout(() => setConfirmacionVisible(false), CONFIRMACION_VISIBLE_MS)
    }
    return total > 0
  }

  // Cierre de Fase 1 — acción "Fusionar" del aviso de dedup semántico.
  async function fusionarConSugerido() {
    if (!avisoDuplicado) return
    const resultado = await fusionarMaterias(avisoDuplicado.materiaOrigenId, avisoDuplicado.aviso.materiaId)
    if (!resultado.ok) { notify('No se pudo fusionar las materias', false); return }
    notify(`Fusionado con "${avisoDuplicado.aviso.nombre}"`)
    setAvisoDuplicado(null)
    // La materia origen ya no existe — sacarla de materias evita que
    // MateriaPicker la siga ofreciendo como opción en lo que queda de esta
    // sesión del overlay.
    setMaterias((actuales) => actuales.filter((m) => m.id !== avisoDuplicado.materiaOrigenId))
    await refrescarTareas()
  }

  // Deshacer es I/O real (Sprint 7.2 Parte B) — payloadDeshacer() (pura,
  // testeada) decide QUÉ mandar; acá se llama al mismo lib/tasks.ts que ya
  // usa el resto de la app, nunca se reimplementa la escritura.
  async function deshacerOperacion(registroId: string) {
    const entrada = registroOperaciones.find((r) => r.id === registroId)
    if (!entrada || entrada.deshecho) return

    const accion = payloadDeshacer(entrada)
    const resultado =
      accion.tipo === 'eliminar'
        ? await eliminarTareaApi(accion.tareaId)
        : accion.tipo === 'actualizar'
          ? await actualizarTareaApi(accion.tareaId, accion.cambios)
          : await crearTarea(accion.input, materias)

    if (!resultado.ok) {
      notify('No se pudo deshacer', false)
      return
    }
    notify('Deshecho')
    setRegistroOperaciones((actuales) => actuales.map((r) => (r.id === registroId ? { ...r, deshecho: true } : r)))
    await refrescarTareas()
  }

  // Se dispara cuando el overlay terminó de colapsar de verdad (fin de la
  // animación de `exit`), no cuando la fase cambió — es el único momento
  // en que la pantalla principal ya se ve limpia y puede empezar su propia
  // coreografía sin pisarse con la del overlay.
  function alCerrarseOverlay() {
    setOverlayEnPantalla(false)
    if (!huboCambioRef.current || panelVisible) return
    respiroTimeoutRef.current = setTimeout(() => {
      setPanelVisible(true)
      // Ajuste — confirmacionVisible es un solo timer GLOBAL
      // (CONFIRMACION_VISIBLE_MS desde que se aplicó, alimenta el overlay y
      // este panel a la vez). A un ritmo de cierre normal (usuario se queda
      // leyendo antes de cerrar, algo común) ese timer puede haber expirado
      // para cuando este panel recién aparece. Se reactiva una vez más,
      // coincidiendo con la aparición del panel, para que tenga su propia
      // ventana de verse acá también.
      setConfirmacionVisible(true)
      if (confirmacionTimeoutRef.current) clearTimeout(confirmacionTimeoutRef.current)
      confirmacionTimeoutRef.current = setTimeout(() => setConfirmacionVisible(false), CONFIRMACION_VISIBLE_MS)
    }, RESPIRO_POST_CIERRE_MS)
  }

  const escribirDeshabilitado = fase !== 'idle'

  return (
    <main
      // Ajuste (4ta vuelta) — un paso más ancho en los dos estados
      // (antes max-w-3xl/max-w-6xl) para darle al h1 más espacio real y
      // que envuelva menos — ver el comentario junto a FRASES_BIENVENIDA:
      // el min-h se remidió contra este ancho nuevo, no es gratis subirlo
      // sin volver a medir.
      className={`relative z-10 min-h-screen px-6 py-16 pb-28 mx-auto lg:pl-24 overflow-x-hidden ${
        panelVisible ? 'max-w-7xl' : 'max-w-4xl'
      }`}
    >
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
        {/* "La parte para escribir a la IA": heading + subtítulo + textarea
            + chips + botón. `layout` anima su reacomodo cuando aparece el
            panel de tareas a la derecha (Parte D). */}
        <motion.div layout transition={{ duration: 0.6, ease: EASE_ASENTAR }} className="w-full lg:flex-1 min-w-0">
          <div className="mb-8">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-coral mb-5"
            >
              <Sparkles size={12} />
              Sección IA
            </motion.span>
            {/* Ajuste — "una sola línea sin wrap" (como se hizo antes) NO es
                compatible con las 5 frases reales del set de abajo: medido
                contra el ancho real del contenedor en los 3 breakpoints, 4
                de las 5 frases necesitan envolver a una segunda línea al
                tamaño de fuente actual (30/44/60px) — forzar una sola línea
                exigiría una fuente mucho más chica solo para las frases
                largas, o cortaba el texto (el bug que esto corrige). Se
                permite wrap (whitespace-normal, ver TextType.tsx) y se
                reserva altura para el PEOR CASO real siempre — así el
                layout de abajo no se mueve sin importar cuál frase esté
                mostrando ni cuántas líneas ocupe.

                min-height: 94.5px/92.4px/126px en 375/768/1440px — medido
                pixel por pixel contra el DOM real (no una fórmula, ver el
                comentario junto a FRASES_BIENVENIDA para el porqué, el
                ajuste de ancho de la 4ta vuelta que bajó el valor de lg de
                189 a 126px, y el procedimiento si se agrega una frase
                nueva), con ~2px de margen sobre el máximo encontrado
                (94.5/92.39/126px exactos) por si el renderizado de fuente
                varía un poco entre navegadores. */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.65 }}
              className="font-display font-semibold text-paper tracking-tight leading-[1.05] whitespace-normal text-[30px] sm:text-[44px] lg:text-[60px] min-h-[96px] sm:min-h-[94px] lg:min-h-[128px]"
            >
              {/* Sub-sprint 7.5 ajuste — la entrada (TextType) ya tenía su
                  propia animación de tipeo; lo que faltaba era la SALIDA: al
                  interactuar, React desmontaba TextType y montaba el texto
                  fijo en el mismo tick, sin transición. AnimatePresence
                  mode="wait" + una clave por rama hace que la frase que se
                  va se desvanezca/desenfoque antes de que la fija entre. */}
              <AnimatePresence mode="wait">
                {confirmacionVisible ? (
                  // Ajuste (4ta vuelta) — esto es lo que realmente se pidió
                  // en el 7.5 original: el shimmer "Todo listo" reemplaza
                  // ESTE heading al terminar una operación, no un banner
                  // aparte en la columna de tareas (eso se sacó de
                  // TaskListPanel.tsx). `loop` sin especificar = default
                  // true de ShimmeringText → corre en bucle mientras
                  // confirmacionVisible esté encendido (lo apaga
                  // CONFIRMACION_VISIBLE_MS más abajo).
                  <motion.span
                    key="confirmacion"
                    initial={{ opacity: 0, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(8px)' }}
                    transition={{ duration: 0.35 }}
                    className="inline-block"
                  >
                    <ShimmeringText text="Todo listo" duration={1.1} color="var(--color-paper)" />
                  </motion.span>
                ) : interactuando ? (
                  <motion.span
                    key="frase-fija"
                    initial={{ opacity: 0, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.35 }}
                    className="inline-block"
                  >
                    {FRASES_BIENVENIDA[0]}
                  </motion.span>
                ) : (
                  <motion.span
                    key="frase-ciclando"
                    exit={{ opacity: 0, filter: 'blur(8px)' }}
                    transition={{ duration: 0.3 }}
                    className="inline-block"
                  >
                    <TextType
                      as="span"
                      text={FRASES_BIENVENIDA}
                      typingSpeed={45}
                      deletingSpeed={25}
                      pauseDuration={1800}
                      cursorClassName="text-coral"
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.7 }}
              className="text-muted text-sm sm:text-base max-w-md mt-4"
            >
              La IA separa cada tarea con materia, fecha y prioridad — tú solo escribes como le hablarías a un compañero.
            </motion.p>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.76 }}>
            <BorderGlow
              backgroundColor="var(--color-panel-glass)"
              borderRadius={24}
              glowRadius={32}
              glowIntensity={0.6}
              fillOpacity={0.35}
              edgeSensitivity={35}
              coneSpread={28}
              glowColor="14 100 65"
            >
              <div className="p-6" onDrop={manejarSoltar} onDragOver={(e) => e.preventDefault()}>
                <textarea
                  ref={textareaRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onFocus={() => setInteractuando(true)}
                  onPaste={manejarPegado}
                  placeholder="Ej: Para el viernes resolver los ejercicios 5 al 12 de matemáticas y estudiar para el examen de historia del lunes…"
                  rows={5}
                  disabled={escribirDeshabilitado}
                  className="w-full bg-transparent text-paper text-base sm:text-lg leading-relaxed placeholder:text-muted/50 outline-none resize-none disabled:opacity-60"
                />

                {adjuntosPendientes.length > 0 && (
                  <div className="mt-2">
                    <AdjuntosPendientesChips adjuntos={adjuntosPendientes} onQuitar={quitarAdjunto} />
                  </div>
                )}

                {!texto && (
                  <div className="flex flex-wrap gap-2 mt-1 mb-1">
                    {EJEMPLOS.map((ej) => (
                      <button
                        key={ej}
                        onClick={() => usarEjemplo(ej)}
                        className="text-[11px] text-muted hover:text-paper bg-panel-2/70 hover:bg-panel-2 rounded-full px-3 py-1.5 transition cursor-pointer"
                      >
                        {ej}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-4">
                  <div className="flex items-center gap-1">
                    <AdjuntoBoton onSeleccionar={agregarAdjuntos} deshabilitado={escribirDeshabilitado} />
                    {/* Sub-sprint 7.4 — mismo textarea, otra forma de
                        llenarlo. `onTranscripcion` reemplaza `texto`
                        directamente (ya llega armado con lo que había +
                        lo dictado, ver useDictado) — no se concatena acá
                        para no duplicar esa lógica en dos lugares. */}
                    <DictadoBoton textoActual={texto} onTranscripcion={setTexto} deshabilitado={escribirDeshabilitado} />
                  </div>
                  {/* El botón NO se desmonta al abrir el overlay: se atenúa.
                      Así su rect sigue siendo medible, el layout no salta, y
                      —sobre todo— no hay dos elementos disputándose una
                      transición de layout compartida (la causa del bug de
                      forma; ver overlayLogic.RADIO_PILDORA). */}
                  <motion.button
                    ref={triggerRef}
                    onClick={abrirAnalisis}
                    disabled={(!texto.trim() && adjuntosPendientes.length === 0) || escribirDeshabilitado}
                    initial={false}
                    style={{ borderRadius: RADIO_PILDORA }}
                    animate={{ opacity: overlayEnPantalla ? 0 : texto.trim() || adjuntosPendientes.length > 0 ? 1 : 0.4 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center gap-2 text-sm font-semibold px-5 py-2.5 text-ink bg-coral ${
                      (texto.trim() || adjuntosPendientes.length > 0) && !escribirDeshabilitado ? 'cursor-pointer' : 'cursor-not-allowed'
                    }`}
                  >
                    <Sparkles size={15} />
                    Analizar con IA
                  </motion.button>
                </div>
              </div>
            </BorderGlow>
          </motion.div>
        </motion.div>

        {/* Panel de tareas de la página: entra una sola vez por sesión,
            desde fuera del viewport por la derecha, con fade + desenfoque
            en una única transición coherente. */}
        <AnimatePresence>
          {panelVisible && (
            <motion.aside
              key="panel-tareas"
              initial={{ x: '110%', opacity: 0, filter: 'blur(12px)' }}
              animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: EASE_ASENTAR }}
              className="w-full lg:w-[340px] lg:flex-shrink-0"
            >
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted mb-3">
                {tareasActuales && tareasActuales.length > 0
                  ? `${tareasActuales.length} ${tareasActuales.length === 1 ? 'tarea' : 'tareas'} en tu agenda`
                  : 'Tu agenda'}
              </p>
              <TaskListPanel
                tareas={tareasActuales}
                cargando={cargandoTareas}
                materias={materias}
                registro={registroOperaciones}
                onDeshacer={deshacerOperacion}
                maxAlturaClase="max-h-[62vh]"
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence onExitComplete={alCerrarseOverlay}>
        {fase !== 'idle' && origen && (
          <AIImmersiveOverlay
            key="overlay"
            origen={origen}
            fase={fase}
            mensajeInicial={mensajeEnviado}
            adjuntosIniciales={adjuntosEnviados}
            materias={materias}
            horario={horario}
            onAplicar={aplicarOperaciones}
            onCerrar={() => dispatch({ type: 'CERRAR' })}
            tareasActuales={tareasActuales}
            cargandoTareas={cargandoTareas}
            registro={registroOperaciones}
            onDeshacer={deshacerOperacion}
            avisoDuplicado={avisoDuplicado}
            onFusionarDuplicado={fusionarConSugerido}
            onDescartarDuplicado={() => setAvisoDuplicado(null)}
          />
        )}
      </AnimatePresence>
    </main>
  )
}
