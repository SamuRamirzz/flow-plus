'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { FolderOpen, UploadCloud } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { useDatosAgenda } from '@/lib/useDatosAgenda'
import type { Archivo, ActividadIA as Actividad, EspacioDrive, VistaArchivos } from '@/lib/archivos/tipos'
import type { ProgresoSubida } from '@/lib/archivos/api'
import { cargarArchivos, cargarEspacio, cargarActividad, eliminarArchivo, analizarArchivo, obtenerArchivo, subirArchivoCompleto } from '@/lib/archivos/api'
import { filtrarArchivos, type CarpetaId, type ChipFiltro } from '@/lib/archivos/formato'
import IndicadorEspacio from './IndicadorEspacio'
import BarraHerramientas from './BarraHerramientas'
import SidebarCarpetas from './SidebarCarpetas'
import ListaArchivos from './ListaArchivos'
import PanelDetalle from './PanelDetalle'
import ActividadIA from './ActividadIA'
import ModalSubida from './ModalSubida'
import VistaNotasUnificada from '@/components/notas/VistaNotasUnificada'
import { cargarTodasLasNotas } from '@/lib/notas/api'

export default function ArchivosSection() {
  const router = useRouter()
  const { notify } = useToast()
  // Materias, tareas y horario salen del hook que ya usan /home y /agenda —
  // el sidebar de carpetas, la fila "En tu horario" del panel, y ahora la
  // vista unificada de Notas (Parte C) necesitan estos tres datos para
  // resolver a qué está anclada cada nota. Duplicar su carga acá habría
  // significado un cuarto punto que mantener sincronizado.
  const { materias, tareas, horario } = useDatosAgenda()

  // Sprint Sistema de Notas Unificado / Parte C — "Notas" es una vista de
  // nivel superior, mutuamente excluyente con el grid de
  // carpetas/lista/detalle (ver el comentario en SidebarCarpetas.tsx sobre
  // por qué no es parte de CarpetaId). `totalNotas` solo alimenta el
  // contador del sidebar — se carga una vez al montar, sin bloquear el
  // resto de la pantalla si falla (el catch silencioso dentro de
  // cargarTodasLasNotas ya devuelve `ok:false`, acá solo se ignora).
  const [vistaNotas, setVistaNotas] = useState(false)
  const [totalNotas, setTotalNotas] = useState(0)

  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [espacio, setEspacio] = useState<EspacioDrive | null>(null)
  const [errorEspacio, setErrorEspacio] = useState<string | null>(null)
  const [actividad, setActividad] = useState<Actividad[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [carpeta, setCarpeta] = useState<CarpetaId>({ tipo: 'todos' })
  const [chip, setChip] = useState<ChipFiltro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState<VistaArchivos>('lista')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [analizandoId, setAnalizandoId] = useState<string | null>(null)

  const [archivoASubir, setArchivoASubir] = useState<File | null>(null)
  const [progreso, setProgreso] = useState<ProgresoSubida | null>(null)
  const [errorSubida, setErrorSubida] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [arrastrando, setArrastrando] = useState(false)
  // Vive en un ref, no en estado: nunca dispara un render por sí sola, solo
  // se lee/reasigna dentro de handlers. Una por subida — se crea al
  // confirmar y se descarta al terminar (con éxito, error, o cancelación).
  const controladorSubidaRef = useRef<AbortController | null>(null)

  const refrescar = useCallback(async () => {
    const [rArchivos, rActividad] = await Promise.all([cargarArchivos(), cargarActividad()])
    if (rArchivos.ok) {
      setArchivos(rArchivos.datos)
      setErrorCarga(null)
    } else {
      setErrorCarga(rArchivos.error)
    }
    if (rActividad.ok) setActividad(rActividad.datos)
  }, [])

  useEffect(() => {
    let activo = true
    ;(async () => {
      // El espacio va por separado y su fallo NO tumba la pantalla: si Drive
      // no está vinculado, la lista de archivos igual se puede mostrar (las
      // filas viven en Postgres), y el indicador explica el problema por su
      // cuenta. `rNotas` sigue el mismo criterio — solo alimenta un contador,
      // nunca bloquea nada si falla.
      const [rArchivos, rActividad, rEspacio, rNotas] = await Promise.all([
        cargarArchivos(),
        cargarActividad(),
        cargarEspacio(),
        cargarTodasLasNotas(),
      ])
      if (!activo) return
      if (rArchivos.ok) setArchivos(rArchivos.datos)
      else setErrorCarga(rArchivos.error)
      if (rActividad.ok) setActividad(rActividad.datos)
      if (rEspacio.ok) setEspacio(rEspacio.datos)
      else setErrorEspacio(rEspacio.error)
      if (rNotas.ok) setTotalNotas(rNotas.datos.length)
      setCargando(false)
    })()
    return () => {
      activo = false
    }
  }, [])

  const visibles = filtrarArchivos(archivos, carpeta, chip, busqueda)
  const seleccionado = archivos.find((a) => a.id === seleccionadoId) ?? null
  const hayFiltro = carpeta.tipo !== 'todos' || chip !== 'todos' || busqueda.trim().length > 0

  // ── Acciones ──────────────────────────────────────────────────────────

  async function alAnalizar(archivo: Archivo) {
    setAnalizandoId(archivo.id)
    const r = await analizarArchivo(archivo.id)
    if (!r.ok) {
      setAnalizandoId(null)
      // 422 = no reintentable (formato/tamaño); el mensaje del servidor ya
      // explica cuál de los dos, así que se muestra tal cual.
      notify(r.error, false)
      // Aun fallando, la fila cambió (`analisis_error`/`analisis_intentos`),
      // así que hay que releerla para que el panel muestre el estado real.
      const actualizado = await obtenerArchivo(archivo.id)
      if (actualizado.ok) setArchivos((prev) => prev.map((a) => (a.id === archivo.id ? actualizado.datos : a)))
      return
    }
    const actualizado = await obtenerArchivo(archivo.id)
    setAnalizandoId(null)
    if (actualizado.ok) setArchivos((prev) => prev.map((a) => (a.id === archivo.id ? actualizado.datos : a)))
    notify('Archivo analizado', true)
    const rActividad = await cargarActividad()
    if (rActividad.ok) setActividad(rActividad.datos)
  }

  async function alEliminar(archivo: Archivo) {
    const r = await eliminarArchivo(archivo.id)
    if (!r.ok) return notify(r.error, false)
    setArchivos((prev) => prev.filter((a) => a.id !== archivo.id))
    setActividad((prev) => prev.filter((a) => a.archivoId !== archivo.id))
    if (seleccionadoId === archivo.id) setSeleccionadoId(null)
    notify(`"${archivo.nombre}" se eliminó`, true)
    const rEspacio = await cargarEspacio()
    if (rEspacio.ok) setEspacio(rEspacio.datos)
  }

  async function alConfirmarSubida(materiaId: string | null, analizar: boolean) {
    if (!archivoASubir) return
    setErrorSubida(null)
    const controlador = new AbortController()
    controladorSubidaRef.current = controlador
    const r = await subirArchivoCompleto(archivoASubir, { materiaId, analizar }, setProgreso, controlador.signal)
    controladorSubidaRef.current = null
    setProgreso(null)
    if (!r.ok) {
      setErrorSubida(r.error)
      return
    }
    cerrarSubida()
    notify(`"${r.datos.nombre}" se subió a tu Drive`, true)
    await refrescar()
    const rEspacio = await cargarEspacio()
    if (rEspacio.ok) setEspacio(rEspacio.datos)
    setSeleccionadoId(r.datos.id)
  }

  // Corta tanto el XHR a Storage como el fetch a Drive (el que esté en
  // curso — `subirArchivoCompleto` internamente sabe cuál de las dos fases
  // está activa) y deja que `alConfirmarSubida` reciba el resultado de
  // error "Subida cancelada" por su camino normal, sin un estado aparte.
  function alCancelarSubida() {
    controladorSubidaRef.current?.abort()
  }

  function cerrarSubida() {
    setArchivoASubir(null)
    setProgreso(null)
    setErrorSubida(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function alSoltar(e: React.DragEvent) {
    e.preventDefault()
    setArrastrando(false)
    const archivo = e.dataTransfer.files?.[0]
    if (archivo) {
      setErrorSubida(null)
      setArchivoASubir(archivo)
    }
  }

  return (
    <main
      className="relative z-10 min-h-screen px-4 sm:px-6 lg:pl-24 lg:pr-8 pt-6 pb-28 lg:pb-8"
      onDragOver={(e) => {
        e.preventDefault()
        setArrastrando(true)
      }}
      onDragLeave={(e) => {
        // Solo se apaga cuando el puntero sale del contenedor de verdad —
        // sin esto, pasar por encima de cualquier hijo apagaría el estado.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setArrastrando(false)
      }}
      onDrop={alSoltar}
    >
      <div className="max-w-[110rem] mx-auto">
        {/* ── Encabezado ─────────────────────────────────────────────── */}
        <header className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-coral/12 shrink-0">
              <FolderOpen size={20} className="text-coral" />
            </span>
            <div>
              <h1 className="font-display text-[26px] sm:text-[32px] font-semibold text-paper tracking-tight leading-none">Archivos</h1>
              <p className="text-sm text-muted mt-2">Todos tus archivos, organizados e impulsados por IA.</p>
            </div>
          </div>
          <div className="lg:shrink-0">
            <IndicadorEspacio espacio={espacio} error={errorEspacio} cargando={cargando} />
          </div>
        </header>

        <BarraHerramientas
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          chip={chip}
          onChip={setChip}
          vista={vista}
          onVista={setVista}
          onSubir={() => inputRef.current?.click()}
          onPreguntarIA={() => router.push('/ai', { transitionTypes: ['to-ai'] })}
          subiendo={progreso !== null}
        />

        <input ref={inputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && setArchivoASubir(e.target.files[0])} />

        {errorCarga && <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-[13px] text-danger">{errorCarga}</p>}

        {/* ── Cuerpo: carpetas · (lista · detalle) o Notas ────────────── */}
        <div className={`mt-5 grid gap-4 ${seleccionado && !vistaNotas ? 'lg:grid-cols-[15rem_minmax(0,1fr)_21rem]' : 'lg:grid-cols-[15rem_minmax(0,1fr)]'}`}>
          <div className="hidden lg:block">
            <SidebarCarpetas
              materias={materias}
              archivos={archivos}
              seleccionada={carpeta}
              onSeleccionar={(c) => {
                setVistaNotas(false)
                setCarpeta(c)
              }}
              notasActiva={vistaNotas}
              onAbrirNotas={() => {
                setVistaNotas(true)
                setSeleccionadoId(null)
              }}
              totalNotas={totalNotas}
            />
          </div>

          {vistaNotas ? (
            <VistaNotasUnificada
              contexto={{ materias, tareas, horario, archivos }}
              onAbrirArchivo={(archivoId) => {
                setVistaNotas(false)
                setSeleccionadoId(archivoId)
              }}
            />
          ) : (
            <>
              <div className="min-w-0">
                <ListaArchivos
                  archivos={visibles}
                  materias={materias}
                  vista={vista}
                  seleccionadoId={seleccionadoId}
                  cargando={cargando}
                  hayFiltro={hayFiltro}
                  onSeleccionar={(a) => setSeleccionadoId((id) => (id === a.id ? null : a.id))}
                  onAnalizar={(a) => void alAnalizar(a)}
                  onEliminar={(a) => void alEliminar(a)}
                />

                {actividad.length > 0 && (
                  <div className="mt-4">
                    <ActividadIA actividad={actividad} onAbrir={setSeleccionadoId} />
                  </div>
                )}
              </div>

              <AnimatePresence>
                {seleccionado && (
                  <PanelDetalle
                    key={seleccionado.id}
                    archivo={seleccionado}
                    materias={materias}
                    horario={horario}
                    analizando={analizandoId === seleccionado.id}
                    onCerrar={() => setSeleccionadoId(null)}
                    onAnalizar={() => void alAnalizar(seleccionado)}
                  />
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      <ModalSubida
        abierto={archivoASubir !== null}
        archivo={archivoASubir}
        materias={materias}
        progreso={progreso}
        error={errorSubida}
        onCerrar={cerrarSubida}
        onConfirmar={(materiaId, analizar) => void alConfirmarSubida(materiaId, analizar)}
        onCancelar={alCancelarSubida}
      />

      {/* Capa de arrastrar y soltar sobre toda la sección */}
      <AnimatePresence>
        {arrastrando && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] pointer-events-none flex items-center justify-center bg-ink/70 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-panel-glass backdrop-blur-xl px-10 py-8">
              <UploadCloud size={30} className="text-coral" />
              <p className="font-display font-semibold text-paper">Suelta el archivo para subirlo</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
