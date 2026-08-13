'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, type Variants } from 'motion/react'
import { Loader2, Check, X, MessageCircle, Send, PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { Materia, Tarea } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import type { TareaContexto } from '@/lib/ai/agents/taskManagement'
import type { AgentResult } from '@/lib/ai/types'
import type { TaskManagementAgentOutput } from '@/lib/ai/agents/taskManagement'
import { createId } from '@/lib/ai/utils'
import { procesarAdjunto } from '@/lib/ai/procesarAdjunto'
import { concatenarTextoConAdjuntos } from '@/lib/ai/adjuntos'
import { useAdjuntosPendientes, type AdjuntoPendiente } from '@/lib/ai/useAdjuntosPendientes'
import { usePanelColapsado } from '@/lib/ai/usePanelColapsado'
import { useDictado } from '@/lib/ai/useDictado'
import { useAutoAlto } from '@/lib/ai/useAutoAlto'
import ResultTaskRow, { type TareaEditable } from '@/components/ai/ResultTaskRow'
import OperacionRow, { type OperacionEditable } from '@/components/ai/OperacionRow'
import AdjuntoBoton from '@/components/ai/AdjuntoBoton'
import DictadoBoton from '@/components/ai/DictadoBoton'
import AdjuntosPendientesChips from '@/components/ai/AdjuntosPendientesChips'
import TaskListPanel from '@/components/ai/TaskListPanel'
import BloquesRespuesta from '@/components/ai/bloques/BloquesRespuesta'
import TextoRico from '@/components/ai/bloques/TextoRico'
import FondoOverlay from '@/components/ai/FondoOverlay'
import { ShimmeringText } from '@/components/animate-ui/ShimmeringText'
import AvisoDuplicadoMateria from '@/components/ui/AvisoDuplicadoMateria'
import type { PosibleDuplicadoMateria } from '@/lib/ai/agents/calendar'
import type { RegistroOperacion } from '@/components/ai/registroOperaciones'
import { historialParaAgente, construirTurnoIA, type Turno, type TurnoIA } from '@/components/ai/conversacion'
import { useImmersive } from '@/lib/immersive'
import { type OverlayFase, type RectOrigen, radioDeCaja, CIERRE_CONTENIDO_MS } from './overlayLogic'

type Props = {
  /** Rect real del botón, medido en el clic — origen y destino de la caja. */
  origen: RectOrigen
  fase: OverlayFase
  /** Primer mensaje de la sesión — el overlay lo manda solo al montar. */
  mensajeInicial: string
  /** Sub-sprint 7.3.1 — archivos adjuntados junto al primer mensaje, si hay. */
  adjuntosIniciales: AdjuntoPendiente[]
  materias: Materia[]
  horario: BloqueHorario[]
  // Sprint 7.2 Parte B: aplicar un turno es I/O real contra Supabase
  // (crear/PATCH/DELETE + empujar al registro de sesión) — eso vive en
  // app/ai/page.tsx, que además necesita actualizar `materias`/
  // `tareasActuales`/`registro` que el overlay no posee. El overlay solo
  // sabe QUÉ turno lo pidió y marca su propio estado aplicando/aplicadoOk.
  onAplicar: (operaciones: OperacionEditable[]) => Promise<boolean>
  onCerrar: () => void
  // Columna derecha: tareas reales del usuario + registro de operaciones de
  // la sesión (creada/modificada/eliminada, con Deshacer) — independientes
  // de la conversación del turno actual.
  tareasActuales: Tarea[] | null
  cargandoTareas: boolean
  registro: RegistroOperacion[]
  onDeshacer: (registroId: string) => void
  // Cierre de Fase 1 — dedup semántico, mismo criterio de props que el
  // resto de este componente: la mutación real (fusionar) vive en
  // app/ai/page.tsx (necesita actualizar `materias`), el overlay solo
  // muestra el aviso y dispara los callbacks.
  avisoDuplicado: { nombreNuevo: string; aviso: PosibleDuplicadoMateria } | null
  onFusionarDuplicado: () => Promise<void>
  onDescartarDuplicado: () => void
}

// Sprint Correcciones /ai — Parte 3. Las animaciones se sentían "quebradas
// de golpe". La causa no era el easing (ya era una curva suave) sino las
// DURACIONES: 0.25-0.32s con desplazamientos de 60px hace que el ojo vea el
// salto, no el recorrido. Estas constantes centralizan el criterio para que
// todo el overlay se mueva igual, en vez de repetir números sueltos.

/** Spring blando: se asienta sin rebote seco. Para paneles y elementos grandes. */
const TRANSICION_PANEL = { type: 'spring', stiffness: 130, damping: 22, mass: 0.9 } as const

/** Para entradas/salidas de mensajes: corta pero con curva de desaceleración real. */
const TRANSICION_MENSAJE = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const

const contenidoVariants: Variants = {
  oculto: {},
  // 0.18 → 0.12: con el stagger anterior, la segunda columna tardaba casi
  // dos décimas en empezar, y eso se leía como lentitud del overlay entero.
  visible: { transition: { staggerChildren: 0.12 } },
}

const columnaVariants: Variants = {
  oculto: { opacity: 0, filter: 'blur(12px)', y: 12, transition: { duration: CIERRE_CONTENIDO_MS / 1000 } },
  visible: { opacity: 1, filter: 'blur(0px)', y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } },
}

// stiffness 190 → 150 y damping 25 → 24: la caja llegaba a su tamaño final
// con un frenazo perceptible. Más blando se siente como que se asienta.
const CAJA_SPRING = { type: 'spring', stiffness: 150, damping: 24, mass: 0.9 } as const

// Sprint Correcciones /ai — Parte 6.2. Tope de crecimiento del composer, en
// px: ~7 líneas de `text-sm leading-relaxed`. Pasado eso hace scroll interno
// en vez de seguir empujando la conversación hacia arriba.
const ALTO_MAX_COMPOSER = 168

// Texto de respaldo para el turno del usuario cuando escribió vacío y solo
// adjuntó archivos — nunca debe quedar una línea en blanco en la columna
// "Lo que entendí".
function nombresAdjuntos(adjuntos: AdjuntoPendiente[]): string {
  if (adjuntos.length === 0) return ''
  return `📎 ${adjuntos.map((a) => a.archivo.name).join(', ')}`
}

/**
 * Sprint Correcciones /ai — Parte 3.3. Antes era un spinner + un texto fijo.
 *
 * El usuario reportó a la vez "las animaciones son abruptas" y "el overlay
 * se siente lento", que parecen contradictorios pero son dos cosas
 * distintas: lo abrupto eran las duraciones (ver las constantes de arriba),
 * y la lentitud es la latencia REAL de Gemini (2-6s), que no se puede
 * reducir desde acá. Lo que sí se puede es que la espera no se sienta
 * muerta: texto con shimmer + tres líneas fantasma que laten, para que la
 * pantalla comunique "esto viene en camino" en vez de "esto se colgó".
 */
function IndicadorPensando({ primerTurno }: { primerTurno: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={TRANSICION_MENSAJE} className="flex flex-col gap-3">
      <ShimmeringText
        text={primerTurno ? 'Leyendo lo que escribiste…' : 'Pensando…'}
        duration={1.4}
        className="text-sm"
        color="var(--color-muted)"
        shimmeringColor="var(--color-coral)"
      />
      {/* Líneas fantasma: sugieren la forma de la respuesta que viene. Anchos
          distintos y desfase en la animación para que se lea como texto
          cargando, no como una barra de progreso. */}
      <div className="flex flex-col gap-2" aria-hidden>
        {[92, 78, 55].map((ancho, i) => (
          <motion.div
            key={ancho}
            className="h-2.5 rounded-full bg-panel-glass"
            style={{ width: `${ancho}%` }}
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
          />
        ))}
      </div>
    </motion.div>
  )
}

export default function AIImmersiveOverlay({
  origen,
  fase,
  mensajeInicial,
  adjuntosIniciales,
  materias,
  horario,
  onAplicar,
  onCerrar,
  tareasActuales,
  cargandoTareas,
  registro,
  onDeshacer,
  avisoDuplicado,
  onFusionarDuplicado,
  onDescartarDuplicado,
}: Props) {
  const { setActivo } = useImmersive()

  // Sprint 7.2 Parte A: la conversación de esta sesión del overlay — vive
  // acá (no en app/ai/page.tsx) y por eso se pierde sola al cerrarse (el
  // componente se desmonta, ver conversacion.ts). `enviando` cubre tanto el
  // primer mensaje como cualquier turno de seguimiento.
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [enviando, setEnviando] = useState(false)
  // Sprint Rediseño /ai — Parte B. Se recuerda entre sesiones (localStorage);
  // ver el comentario de usePanelColapsado sobre por qué.
  const [panelColapsado, setPanelColapsado] = usePanelColapsado()
  const [siguienteMensaje, setSiguienteMensaje] = useState('')
  // Sprint Correcciones /ai — Partes 5 y 6. El hook de dictado vive acá (no
  // dentro de DictadoBoton) porque `enviarSiguiente` necesita `reiniciar()`;
  // el de auto-alto necesita la ref del textarea.
  const dictado = useDictado(setSiguienteMensaje)
  const textareaSiguienteRef = useRef<HTMLTextAreaElement>(null)
  useAutoAlto(textareaSiguienteRef, siguienteMensaje, ALTO_MAX_COMPOSER)
  // Sub-sprint 7.3.1 — archivos para el PRÓXIMO turno de seguimiento (los
  // del primer mensaje viajan como prop `adjuntosIniciales`, no por acá).
  const { adjuntos: adjuntosSiguiente, agregar: agregarAdjuntosSiguiente, quitar: quitarAdjuntoSiguiente, limpiar: limpiarAdjuntosSiguiente } =
    useAdjuntosPendientes()

  const [viewport, setViewport] = useState(() => ({
    w: typeof window === 'undefined' ? 0 : window.innerWidth,
    h: typeof window === 'undefined' ? 0 : window.innerHeight,
  }))

  useEffect(() => {
    setActivo(true)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    function onResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)

    return () => {
      setActivo(false)
      document.body.style.overflow = overflowPrevio
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Solo hace el fetch y devuelve el turno resultante — SIN setState adentro
  // a propósito. react-hooks/set-state-in-effect (verificado en sprints
  // anteriores de este proyecto) marca un efecto que llama a una función
  // nombrada que a su vez hace setState, aunque sea async — la única forma
  // de que el efecto de montaje de abajo pase el lint es que el setState
  // ocurra en el cuerpo del propio efecto, nunca delegado. Separar "traer
  // el turno" (esta función) de "aplicar el turno al estado" (cada
  // llamador) deja reusar la lógica de fetch sin duplicarla.
  async function analizarMensaje(texto: string, historialActual: Turno[], archivos: File[], signal?: AbortSignal): Promise<TurnoIA> {
    try {
      // Sub-sprint 7.3.1 — TODOS los adjuntos se procesan ANTES de llamar al
      // agente: si cualquiera falla (subida o lectura), se reporta como el
      // error del turno completo, nunca se manda el mensaje con solo
      // algunos adjuntos a medias. Imagen/PDF suben a Storage; .txt/.md se
      // leen en cliente y se concatenan al texto (ver lib/ai/adjuntos.ts) —
      // nunca pasan por el mecanismo de adjuntos "visuales" del provider.
      const procesados = await Promise.all(archivos.map(procesarAdjunto))
      const fallidos = procesados.filter((p) => !p.ok)
      if (fallidos.length > 0) {
        const mensaje = fallidos.map((f) => (f as { error: string }).error).join(' · ')
        return { rol: 'ia', id: createId('turno'), tipoRespuesta: 'error', mensaje, resumen: null, bloques: [], operaciones: [], aplicando: false, aplicadoOk: false }
      }

      const rutasBinarias = procesados
        .filter((p): p is Extract<typeof p, { tipo: 'imagen' | 'documento' }> => p.ok && (p.tipo === 'imagen' || p.tipo === 'documento'))
        .map((p) => p.ruta)
      const textos = procesados.filter((p): p is Extract<typeof p, { tipo: 'texto' }> => p.ok && p.tipo === 'texto')
      const textoConAdjuntos = concatenarTextoConAdjuntos(texto, textos)

      const res = await fetch('/api/ai/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textoConAdjuntos,
          historial: historialParaAgente(historialActual),
          ...(rutasBinarias.length > 0 ? { adjuntos: rutasBinarias.map((ruta) => ({ ruta })) } : {}),
        }),
        signal,
      })
      const result = (await res.json()) as AgentResult<TaskManagementAgentOutput> | { error: string }
      const idIA = createId('turno')

      if (!('status' in result)) {
        return { rol: 'ia', id: idIA, tipoRespuesta: 'error', mensaje: result.error, resumen: null, bloques: [], operaciones: [], aplicando: false, aplicadoOk: false }
      }
      if (result.status !== 'success' || !result.output) {
        return {
          rol: 'ia',
          id: idIA,
          tipoRespuesta: 'error',
          mensaje: result.error?.message ?? 'No se pudo analizar el texto',
          resumen: null,
          bloques: [],
          operaciones: [],
          aplicando: false,
          aplicadoOk: false,
        }
      }
      // textoConAdjuntos (no `texto` a secas): incluye lo concatenado de
      // adjuntos .txt/.md, así que si el temario/peso/formato de un examen
      // vinieron en un adjunto de texto en vez de tecleados, ExamAgent
      // igual los ve (ver resolverCamposExamen, lib/server/examen.ts).
      return construirTurnoIA(idIA, result.output, materias, textoConAdjuntos)
    } catch {
      return { rol: 'ia', id: createId('turno'), tipoRespuesta: 'error', mensaje: 'No se pudo conectar con el servidor.', resumen: null, bloques: [], operaciones: [], aplicando: false, aplicadoOk: false }
    }
  }

  // El PRIMER turno se manda solo, una vez, al montar — con historial
  // vacío (todavía no hay conversación). Todo el setState vive DENTRO de
  // este efecto (guardia `activo` de montaje), nunca delegado.
  //
  // Cierre de Fase 1 (auditoría 2A) — el `AbortController` es necesario
  // además de `activo`: en dev, StrictMode monta este efecto, lo limpia y
  // lo vuelve a montar de inmediato, y sin abortar la primera llamada
  // seguía viajando hasta el final contra Gemini de verdad (confirmado:
  // 2 POST /api/ai/tareas reales por cada primer mensaje). `activo` ya
  // evitaba que el resultado obsoleto se aplicara al estado — nunca hubo
  // riesgo de turnos/tareas duplicados — pero no evitaba el segundo gasto
  // de tokens/latencia. Abortar la request obsoleta en el cleanup es
  // además correcto si el usuario cierra el overlay a mitad de la
  // respuesta del primer turno.
  useEffect(() => {
    let activo = true
    const controller = new AbortController()
    ;(async () => {
      // Sub-sprint 7.3.1: si el usuario solo adjuntó archivos sin escribir
      // nada, el turno mostrado en pantalla no puede quedar en blanco.
      const textoTurno = mensajeInicial || nombresAdjuntos(adjuntosIniciales)
      // 🐛 Bug real encontrado en la verificación visual de este sprint: el
      // turno del usuario aparecía DUPLICADO en pantalla. El comentario de
      // arriba afirmaba que `activo` ya evitaba turnos duplicados — cierto
      // para el turno de la IA (que se agrega DESPUÉS del await, ya
      // protegido), pero este se agregaba ANTES, así que el segundo montaje
      // de StrictMode lo insertaba igual. La guarda por id lo hace idempotente
      // sin depender de cuántas veces corra el efecto.
      const idTurnoInicial = createId('turno')
      setTurnos((actuales) =>
        actuales.some((t) => t.rol === 'usuario' && t.texto === textoTurno) ? actuales : [...actuales, { rol: 'usuario', id: idTurnoInicial, texto: textoTurno }]
      )
      setEnviando(true)
      const turnoIA = await analizarMensaje(
        mensajeInicial,
        [],
        adjuntosIniciales.map((a) => a.archivo),
        controller.signal
      )
      if (!activo) return
      setTurnos((actuales) => [...actuales, turnoIA])
      setEnviando(false)
    })()
    return () => {
      activo = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function enviarSiguiente() {
    const texto = siguienteMensaje.trim()
    if ((!texto && adjuntosSiguiente.length === 0) || enviando) return
    const archivosParaEnviar = adjuntosSiguiente.map((a) => a.archivo)
    setSiguienteMensaje('')
    // Parte 5 — sin esto, un resultado tardío del reconocedor de voz volvía a
    // llenar la caja justo después de vaciarla. Ver useDictado.reiniciar.
    dictado.reiniciar()
    limpiarAdjuntosSiguiente()
    const textoTurno = texto || nombresAdjuntos(adjuntosSiguiente)
    setTurnos((actuales) => [...actuales, { rol: 'usuario', id: createId('turno'), texto: textoTurno }])
    setEnviando(true)
    const turnoIA = await analizarMensaje(texto, turnos, archivosParaEnviar)
    setTurnos((actuales) => [...actuales, turnoIA])
    setEnviando(false)
  }

  // Sub-sprint 7.3.1 — mismo criterio que el composer principal (app/ai/
  // page.tsx): pegar una imagen se trata como adjuntarla; si el portapapeles
  // solo tiene texto, el pegado normal en el input no cambia.
  function manejarPegadoSiguiente(e: React.ClipboardEvent) {
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
      agregarAdjuntosSiguiente(imagenes)
    }
  }

  function manejarSoltarSiguiente(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) agregarAdjuntosSiguiente(e.dataTransfer.files)
  }

  function actualizarOperacionEnTurno(turnoId: string, opId: string, cambios: Partial<TareaEditable>) {
    setTurnos((actuales) =>
      actuales.map((t) =>
        t.id === turnoId && t.rol === 'ia'
          ? { ...t, operaciones: t.operaciones.map((op) => (op.id === opId && op.tipo === 'crear' ? { ...op, ...cambios } : op)) }
          : t
      )
    )
  }

  function quitarOperacionEnTurno(turnoId: string, opId: string) {
    setTurnos((actuales) =>
      actuales.map((t) => (t.id === turnoId && t.rol === 'ia' ? { ...t, operaciones: t.operaciones.filter((op) => op.id !== opId) } : t))
    )
  }

  function resolverAmbiguoEnTurno(turnoId: string, opId: string, candidato: TareaContexto) {
    setTurnos((actuales) =>
      actuales.map((t) => {
        if (t.id !== turnoId || t.rol !== 'ia') return t
        return {
          ...t,
          operaciones: t.operaciones.map((op): OperacionEditable => {
            if (op.id !== opId || op.tipo !== 'ambiguo') return op
            if (op.accionOriginal === 'borrar') return { tipo: 'borrar', id: op.id, tareaId: candidato.id, antes: candidato }
            return { tipo: 'modificar', id: op.id, tareaId: candidato.id, antes: candidato, cambios: op.cambiosPropuestos ?? {} }
          }),
        }
      })
    )
  }

  async function aplicarTurno(turno: TurnoIA) {
    if (turno.aplicando || turno.aplicadoOk) return
    setTurnos((actuales) => actuales.map((t) => (t.id === turno.id ? { ...t, aplicando: true } : t)))
    const ok = await onAplicar(turno.operaciones)
    setTurnos((actuales) => actuales.map((t) => (t.id === turno.id ? { ...t, aplicando: false, aplicadoOk: ok } : t)))
  }

  // Sprint 7.2 Parte A — un turno de seguimiento suele ser una CORRECCIÓN
  // del turno anterior ("ponle prioridad alta a esa tarea", "mejor que sea
  // el 10"), no una acción adicional independiente. Si cada turno con
  // operaciones mantuviera su propio botón "Aplicar" para siempre, aplicar
  // los turnos viejos por error crea tareas duplicadas (se confirmó
  // literalmente probando esto: 3 turnos refinando "crea examen de
  // historia" con prioridad/fecha corregidas producían 3 tareas si se
  // aplicaban los 3). Por eso solo el ÚLTIMO turno con operaciones
  // accionables y sin aplicar queda con el botón activo — los anteriores
  // quedan de solo lectura con una nota. Si el usuario de verdad quería dos
  // acciones independientes, alcanza con aplicar cada una antes de seguir
  // escribiendo (el botón sigue ahí hasta que la reemplaza un turno nuevo).
  const idxUltimoAccionable = (() => {
    let idx = -1
    turnos.forEach((t, i) => {
      if (t.rol === 'ia' && t.tipoRespuesta === 'operaciones' && !t.aplicadoOk && t.operaciones.some((o) => o.tipo === 'crear' || o.tipo === 'modificar' || o.tipo === 'borrar')) {
        idx = i
      }
    })
    return idx
  })()

  const anchoMV = useMotionValue(origen.width)
  const altoMV = useMotionValue(origen.height)
  const radioMV = useTransform([anchoMV, altoMV], ([w, h]: number[]) => radioDeCaja(w, h, origen.height, viewport.h))

  const cajaCerrada = { x: origen.left, y: origen.top, width: origen.width, height: origen.height, backgroundColor: '#FF6B4D' }
  // Sprint Correcciones /ai — Parte 1. El fondo del overlay vuelve a ser
  // OPACO (#06070A) y eso es correcto ahora: el Dot Field ya no está detrás
  // del overlay, sino DENTRO (ver <FondoOverlay/> más abajo). Con el fondo
  // translúcido del intento anterior se leía el contenido de la página por
  // debajo, que era el bug; opaco + el fondo propio adentro da la misma
  // textura sin nada que compita.
  const cajaAbierta = { x: 0, y: 0, width: viewport.w, height: viewport.h, backgroundColor: '#06070A' }

  if (typeof document === 'undefined') return null

  return createPortal(
    <motion.div
      initial={cajaCerrada}
      animate={cajaAbierta}
      exit={cajaCerrada}
      transition={{ ...CAJA_SPRING, backgroundColor: { duration: 0.45 } }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        width: anchoMV,
        height: altoMV,
        borderRadius: radioMV,
      }}
      className="z-[100]"
    >
      {/* Sprint Correcciones /ai — Parte 1. Dot Field + destello, dentro del
          overlay y por debajo del contenido. Solo se encienden cuando la
          caja ya terminó de expandirse: durante la apertura la caja todavía
          es pequeña y la grilla se construiría con un tamaño que va a
          cambiar en 600ms. */}
      <FondoOverlay visible={fase !== 'expanding' && fase !== 'cerrando'} ancho={viewport.w} alto={viewport.h} />

      <motion.button
        onClick={onCerrar}
        initial={{ opacity: 0 }}
        animate={{ opacity: fase === 'expanding' || fase === 'cerrando' ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        className="absolute top-6 right-6 z-10 w-9 h-9 rounded-full bg-panel-glass backdrop-blur-xl flex items-center justify-center text-muted hover:text-paper transition-colors cursor-pointer"
        aria-label="Cerrar"
      >
        <X size={16} />
      </motion.button>

      <AnimatePresence>
        {fase === 'resultado' && (
          <motion.div
            key="contenido"
            initial="oculto"
            animate="visible"
            exit="oculto"
            variants={contenidoVariants}
            style={{ width: viewport.w, height: viewport.h }}
            className="overflow-y-auto"
          >
            <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-20 flex flex-col md:flex-row gap-10 md:gap-16">
              {/* Sprint Correcciones /ai — Parte 2. La conversación NUNCA se
                  colapsa: es el contenido principal del overlay. El panel
                  que se oculta es el de Tareas (ver más abajo). */}
              <motion.div layout variants={columnaVariants} className="md:flex-1 min-w-0 relative">
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Lo que entendí</p>
                    </div>

                <div className="flex flex-col gap-5">
                  <AnimatePresence initial={false}>
                    {turnos.map((turno, i) =>
                      turno.rol === 'usuario' ? (
                        <motion.p key={turno.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={TRANSICION_MENSAJE} className="text-xs font-mono text-muted">
                          <span className="text-coral/70">Tú — </span>
                          {turno.texto}
                        </motion.p>
                      ) : (
                        <TurnoIACard
                          key={turno.id}
                          turno={turno}
                          esUltimoAccionable={i === idxUltimoAccionable}
                          materias={materias}
                          horario={horario}
                          onChange={(opId, cambios) => actualizarOperacionEnTurno(turno.id, opId, cambios)}
                          onQuitar={(opId) => quitarOperacionEnTurno(turno.id, opId)}
                          onResolverAmbiguo={(opId, candidato) => resolverAmbiguoEnTurno(turno.id, opId, candidato)}
                          onAplicar={() => aplicarTurno(turno)}
                        />
                      )
                    )}
                  </AnimatePresence>

                  {enviando && <IndicadorPensando primerTurno={turnos.length === 0} />}
                </div>

                {avisoDuplicado && (
                  <div className="mt-5">
                    <AvisoDuplicadoMateria
                      nombreNuevo={avisoDuplicado.nombreNuevo}
                      aviso={avisoDuplicado.aviso}
                      onFusionar={onFusionarDuplicado}
                      onDescartar={onDescartarDuplicado}
                    />
                  </div>
                )}

                {/* Input de seguimiento — sigue disponible mientras el
                    overlay está en fase resultado, sin cerrar y reabrir
                    (Sprint 7.2 Parte A). */}
                <div className="mt-6 sticky bottom-0" onDrop={manejarSoltarSiguiente} onDragOver={(e) => e.preventDefault()}>
                  {adjuntosSiguiente.length > 0 && (
                    <div className="mb-2 px-1">
                      <AdjuntosPendientesChips adjuntos={adjuntosSiguiente} onQuitar={quitarAdjuntoSiguiente} />
                    </div>
                  )}
                  {/* Parte 6 — era un <input>, y por eso el texto largo se
                      "salía de la caja": un input no envuelve, solo desplaza
                      el contenido a un lado. Con <textarea> el texto salta de
                      línea y la caja crece con él (useAutoAlto) hasta
                      ALTO_MAX_COMPOSER. `items-end` para que los botones se
                      queden abajo mientras crece, en vez de quedar centrados
                      contra un bloque de varias líneas. */}
                  <div className="flex items-end gap-2 bg-panel-glass backdrop-blur-xl rounded-3xl pl-4 pr-1.5 py-1.5">
                    <textarea
                      ref={textareaSiguienteRef}
                      value={siguienteMensaje}
                      onChange={(e) => setSiguienteMensaje(e.target.value)}
                      // Enter envía; Shift+Enter deja escribir varias líneas —
                      // lo que ahora tiene sentido, porque la caja crece.
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          enviarSiguiente()
                        }
                      }}
                      onPaste={manejarPegadoSiguiente}
                      disabled={enviando}
                      rows={1}
                      placeholder={turnos.length === 0 ? 'Esperando respuesta…' : 'Seguí la conversación — ej: "cámbiale la fecha"'}
                      className="flex-1 min-w-0 bg-transparent text-sm leading-relaxed text-paper placeholder:text-muted/60 outline-none resize-none disabled:opacity-50 py-1"
                    />
                    <AdjuntoBoton onSeleccionar={agregarAdjuntosSiguiente} deshabilitado={enviando} />
                    {/* Bug 7.4 — el micrófono existía solo en el composer
                        inicial de app/ai/page.tsx; acá nunca se había
                        integrado, así que dentro del overlay simplemente no
                        había botón que presionar. Mismo componente y mismo
                        hook que allá (useDictado vive en lib/ai/), no una
                        segunda implementación: `siguienteMensaje` hace de
                        `textoActual` y `setSiguienteMensaje` recibe el texto
                        ya armado (base + dictado), igual que el textarea
                        del estado idle. */}
                    <DictadoBoton
                      soportado={dictado.soportado}
                      estado={dictado.estado}
                      onAlternar={() => dictado.alternar(siguienteMensaje)}
                      deshabilitado={enviando}
                    />
                    <button
                      onClick={enviarSiguiente}
                      disabled={(!siguienteMensaje.trim() && adjuntosSiguiente.length === 0) || enviando}
                      aria-label="Enviar"
                      className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-coral text-ink disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Sprint Correcciones /ai — Partes 2 y 7. El panel de Tareas
                  es el que se colapsa (se desmonta, así la conversación se
                  reparte el ancho sola) y el que queda STICKY: al hacer
                  scroll en la conversación se mantiene a la vista, con su
                  propio scroll interno si hay más tareas de las que caben. */}
              <AnimatePresence initial={false} mode="popLayout">
                {!panelColapsado && (
                  <motion.div
                    key="panel-tareas"
                    layout
                    variants={columnaVariants}
                    // Sale hacia la DERECHA (x positivo), que es el borde por
                    // el que se va — al revés que el intento anterior.
                    exit={{ opacity: 0, x: 60, filter: 'blur(8px)', transition: TRANSICION_PANEL }}
                    className="md:flex-1 flex flex-col gap-2.5 min-w-0 md:sticky md:top-20 md:self-start md:max-h-[calc(100vh-7rem)]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Tareas</p>
                      <button
                        onClick={() => setPanelColapsado(true)}
                        aria-label="Ocultar el panel de tareas"
                        title="Ocultar este panel"
                        className="text-muted hover:text-paper transition p-1 -mr-1 cursor-pointer"
                      >
                        <PanelRightClose size={15} />
                      </button>
                    </div>
                    {/* El scroll vive acá dentro, no en la columna: así el
                        encabezado "Tareas" y el botón de ocultar se quedan
                        fijos mientras la lista se desplaza. */}
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <TaskListPanel
                        tareas={tareasActuales}
                        cargando={cargandoTareas}
                        materias={materias}
                        registro={registro}
                        onDeshacer={onDeshacer}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Pestaña de reapertura, pegada al borde DERECHO (es el panel
                de Tareas el que se oculta por ahí). Fuera del contenedor
                `max-w-5xl` para poder tocar el borde real de la pantalla y
                no el del contenido centrado. Click, no drag: no compite con
                el scroll vertical del overlay, que en móvil sería el gesto
                en conflicto. */}
            <AnimatePresence>
              {panelColapsado && (
                <motion.button
                  key="pestana-panel"
                  onClick={() => setPanelColapsado(false)}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={TRANSICION_PANEL}
                  aria-label="Mostrar el panel de tareas"
                  title="Mostrar las tareas"
                  className="fixed right-0 top-1/2 -translate-y-1/2 z-[101] flex flex-col items-center gap-2 py-5 pr-2 pl-2.5 rounded-l-2xl bg-panel-glass backdrop-blur-xl text-muted hover:text-paper transition cursor-pointer"
                >
                  <PanelRightOpen size={16} className="text-coral" />
                  {/* Texto rotado: identifica el panel oculto sin robar
                      ancho a la conversación. */}
                  <span
                    className="font-mono text-[10px] uppercase tracking-wide whitespace-nowrap"
                    style={{ writingMode: 'vertical-rl' }}
                  >
                    Tareas
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body
  )
}

// Un turno de la IA, con su propio "aplicar" cuando trae operaciones.
function TurnoIACard({
  turno,
  esUltimoAccionable,
  materias,
  horario,
  onChange,
  onQuitar,
  onResolverAmbiguo,
  onAplicar,
}: {
  turno: TurnoIA
  esUltimoAccionable: boolean
  materias: Materia[]
  horario: BloqueHorario[]
  onChange: (opId: string, cambios: Partial<TareaEditable>) => void
  onQuitar: (opId: string) => void
  onResolverAmbiguo: (opId: string, candidato: TareaContexto) => void
  onAplicar: () => void
}) {
  const accionables = turno.operaciones.filter((o) => o.tipo === 'crear' || o.tipo === 'modificar' || o.tipo === 'borrar')
  const hayAmbiguosSinResolver = turno.operaciones.some((o) => o.tipo === 'ambiguo')
  const etiquetaAplicar = (() => {
    const crear = accionables.filter((o) => o.tipo === 'crear').length
    const modificar = accionables.filter((o) => o.tipo === 'modificar').length
    const borrar = accionables.filter((o) => o.tipo === 'borrar').length
    const partes: string[] = []
    if (crear > 0) partes.push(`crear ${crear}`)
    if (modificar > 0) partes.push(`modificar ${modificar}`)
    if (borrar > 0) partes.push(`borrar ${borrar}`)
    return partes.length > 0 ? `Aplicar — ${partes.join(', ')}` : 'Aplicar'
  })()

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={TRANSICION_MENSAJE} className="flex flex-col gap-2.5">
      {turno.tipoRespuesta === 'error' ? (
        <p className="text-danger text-sm leading-relaxed">{turno.mensaje}</p>
      ) : turno.tipoRespuesta === 'conversacional' ? (
        // Sprint Rediseño /ai — el <p> plano se cambió por TextoRico (que
        // interpreta el markdown que se le escape al modelo en vez de
        // mostrar los asteriscos) + los bloques estructurados debajo.
        <div className="flex items-start gap-2.5 text-paper/80 text-sm leading-relaxed">
          <MessageCircle size={16} className="text-coral/70 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            {turno.mensaje && <TextoRico texto={turno.mensaje} />}
            <BloquesRespuesta bloques={turno.bloques} />
          </div>
        </div>
      ) : (
        <>
          <p className="text-paper text-sm leading-relaxed">{turno.resumen}</p>
          {/* Los bloques son ortogonales a las operaciones: la IA puede
              explicar con una tabla lo que además va a aplicar. */}
          <BloquesRespuesta bloques={turno.bloques} />
          <div className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {turno.operaciones.map((op, i) => (
                <motion.div key={op.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ ...TRANSICION_MENSAJE, delay: i * 0.06 }}>
                  {op.tipo === 'crear' ? (
                    <ResultTaskRow tarea={op} materias={materias} horario={horario} onChange={onChange} onRemove={onQuitar} />
                  ) : (
                    <OperacionRow operacion={op} onQuitar={onQuitar} onResolverAmbiguo={onResolverAmbiguo} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {accionables.length > 0 && !turno.aplicadoOk && !esUltimoAccionable ? (
              // Un turno más nuevo ya retomó/corrigió esta propuesta — se
              // deja de mostrar el botón para que aplicar-por-error no cree
              // duplicados (ver comentario de idxUltimoAccionable arriba).
              <p className="text-[11px] font-mono text-muted italic">Reemplazado por un mensaje más reciente</p>
            ) : (
              accionables.length > 0 && (
                <button
                  onClick={onAplicar}
                  disabled={turno.aplicando || turno.aplicadoOk || hayAmbiguosSinResolver}
                  title={hayAmbiguosSinResolver ? 'Resuelve o descarta las tareas ambiguas antes de aplicar' : undefined}
                  className="self-start flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full bg-coral text-ink hover:opacity-90 transition disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {turno.aplicando && <Loader2 size={15} className="animate-spin" />}
                  {turno.aplicadoOk && <Check size={15} />}
                  {turno.aplicadoOk ? '¡Listo!' : etiquetaAplicar}
                </button>
              )
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}
