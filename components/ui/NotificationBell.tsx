'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { Bell, AlertTriangle, Clock, BookOpen, StickyNote, Sparkles, Trash2, Check, CheckCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMontado } from '@/lib/useMontado'
import { useToast } from '@/lib/toast'
import { useRealtimeSync } from '@/lib/useRealtimeSync'
import { formatearRelativo } from '@/lib/archivos/formato'
import { RUTA_AGENDA, RUTA_ARCHIVOS } from '@/lib/rutas'
import type { FilaNotificacion, TipoNotificacion, EntidadTipoNotificacion } from '@/lib/notificaciones/tipos'

// Sprint 1/3 — reemplaza por completo la versión Sprint 11, que solo leía
// `notificaciones_enviadas` (recordatorios de tareas, sin estado leída/no
// leída ni acción posible más allá de mirar). Esta versión consume el
// modelo de producto general (tabla `notificaciones`): cualquier tipo de
// evento, con leer/borrar/navegar. Se mueve de estar montada solo dentro de
// AgendaHome a la navegación global (app/layout.tsx) — una notificación de
// horario o de una nota no tiene por qué estar escondida detrás de la
// pantalla de Agenda.

const ICONO_POR_TIPO: Record<TipoNotificacion, LucideIcon> = {
  tarea_vencida: AlertTriangle,
  tarea_proxima: Clock,
  recordatorio_horario: BookOpen,
  nota_agregada: StickyNote,
  mensaje_ia: Sparkles,
  sistema: Bell,
}

// A dónde navega un clic en la notificación, según su ancla. Ninguna de las
// 3 rutas ofrece hoy un deep-link a un id puntual (ni /agenda a una tarea,
// ni /horario a un bloque, ni /archivos a un archivo) — se navega a la
// sección correcta, no al elemento exacto, mismo límite ya documentado para
// otras partes de la app que tampoco tienen deep-link.
function rutaDeEntidad(entidadTipo: EntidadTipoNotificacion | null): string | null {
  if (entidadTipo === 'tarea') return RUTA_AGENDA
  if (entidadTipo === 'bloque_horario') return '/horario'
  if (entidadTipo === 'archivo' || entidadTipo === 'nota') return RUTA_ARCHIVOS
  return null
}

const LIMITE_PANEL = 20

export default function NotificationBell() {
  const montado = useMontado()
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [noLeidas, setNoLeidas] = useState(0)
  const [notificaciones, setNotificaciones] = useState<FilaNotificacion[]>([])
  const [cargandoLista, setCargandoLista] = useState(false)
  const [pulso, setPulso] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const refrescarContador = useCallback(async () => {
    try {
      const res = await fetch('/api/notificaciones/contador')
      if (!res.ok) return
      const data = await res.json()
      setNoLeidas(data.noLeidas ?? 0)
    } catch {
      // Silencioso — mismo criterio que el resto de fetches pasivos del
      // proyecto (cargarMaterias/cargarTareas): sin red, la campana se ve
      // vacía, no es un error que interrumpa nada.
    }
  }, [])

  const refrescarLista = useCallback(async () => {
    setCargandoLista(true)
    try {
      const res = await fetch(`/api/notificaciones?limit=${LIMITE_PANEL}`)
      if (!res.ok) return
      const data = await res.json()
      setNotificaciones(data.notificaciones ?? [])
    } catch {
      // Igual de silencioso — el panel simplemente queda vacío/desactualizado.
    } finally {
      setCargandoLista(false)
    }
  }, [])

  // Contador al montar — es lo único que se ve sin abrir el panel. IIFE
  // async + bandera `activo` (mismo patrón que `cargarDatos`/la versión
  // anterior de este componente): el setState real ocurre después del
  // primer `await`, nunca sincrónico dentro del cuerpo del efecto —
  // llamar directo a `refrescarContador()` acá dispara
  // react-hooks/set-state-in-effect porque el linter sí resuelve el
  // setState dentro de un useCallback referenciado, aunque sea async.
  useEffect(() => {
    let activo = true
    ;(async () => {
      try {
        const res = await fetch('/api/notificaciones/contador')
        if (!res.ok) return
        const data = await res.json()
        if (!activo) return
        setNoLeidas(data.noLeidas ?? 0)
      } catch {
        // Silencioso — mismo criterio que el resto de fetches pasivos.
      }
    })()
    return () => {
      activo = false
    }
  }, [])

  // La lista completa se pide solo al abrir (perezoso: no tiene sentido
  // pagar esa consulta en cada carga de página si el usuario nunca abre
  // la campana), y se recarga cada vez que se abre para no mostrar datos
  // viejos de la última vez. Mismo patrón IIFE que el efecto de arriba.
  useEffect(() => {
    if (!open) return
    let activo = true
    ;(async () => {
      setCargandoLista(true)
      try {
        const res = await fetch(`/api/notificaciones?limit=${LIMITE_PANEL}`)
        if (!res.ok) return
        const data = await res.json()
        if (!activo) return
        setNotificaciones(data.notificaciones ?? [])
      } catch {
        // Igual de silencioso — el panel simplemente queda vacío/desactualizado.
      } finally {
        if (activo) setCargandoLista(false)
      }
    })()
    return () => {
      activo = false
    }
  }, [open])

  // Tiempo real — cualquier evento en `notificaciones` (nueva del cron/IA
  // mientras la app está abierta, o un cambio hecho desde otro
  // dispositivo) resincroniza el contador; si el panel está abierto,
  // también la lista. Un INSERT dispara además el pulso del badge.
  useRealtimeSync<FilaNotificacion>('notificaciones', true, (evento) => {
    refrescarContador()
    setOpen((abiertoActual) => {
      if (abiertoActual) refrescarLista()
      return abiertoActual
    })
    if (evento.tipo === 'INSERT') {
      setPulso(true)
      setTimeout(() => setPulso(false), 900)
    }
  })

  useEffect(() => {
    function place() {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    if (open) {
      place()
      window.addEventListener('scroll', place, true)
      window.addEventListener('resize', place)
      return () => {
        window.removeEventListener('scroll', place, true)
        window.removeEventListener('resize', place)
      }
    }
  }, [open])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function marcarLeida(id: string) {
    const previas = notificaciones
    const eraNoLeida = previas.find((n) => n.id === id)?.leida === false
    setNotificaciones((ns) => ns.map((n) => (n.id === id ? { ...n, leida: true } : n)))
    if (eraNoLeida) setNoLeidas((n) => Math.max(0, n - 1))
    try {
      const res = await fetch(`/api/notificaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leida: true }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setNotificaciones(previas)
      if (eraNoLeida) setNoLeidas((n) => n + 1)
      notify('No se pudo marcar como leída', false)
    }
  }

  async function marcarTodasLeidas() {
    const previas = notificaciones
    const previasNoLeidas = noLeidas
    setNotificaciones((ns) => ns.map((n) => ({ ...n, leida: true })))
    setNoLeidas(0)
    try {
      const res = await fetch('/api/notificaciones/leer-todas', { method: 'PATCH' })
      if (!res.ok) throw new Error()
    } catch {
      setNotificaciones(previas)
      setNoLeidas(previasNoLeidas)
      notify('No se pudieron marcar todas como leídas', false)
    }
  }

  async function borrar(id: string) {
    const previas = notificaciones
    const eraNoLeida = previas.find((n) => n.id === id)?.leida === false
    setNotificaciones((ns) => ns.filter((n) => n.id !== id))
    if (eraNoLeida) setNoLeidas((n) => Math.max(0, n - 1))
    try {
      const res = await fetch(`/api/notificaciones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setNotificaciones(previas)
      if (eraNoLeida) setNoLeidas((n) => n + 1)
      notify('No se pudo borrar la notificación', false)
    }
  }

  function onClickNotificacion(n: FilaNotificacion) {
    if (!n.leida) marcarLeida(n.id)
    const ruta = rutaDeEntidad(n.entidad_tipo)
    setOpen(false)
    if (ruta) router.push(ruta)
  }

  const hayNoLeidas = noLeidas > 0

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificaciones"
        className="fixed top-5 right-[4.75rem] z-50 w-10 h-10 rounded-full bg-panel-glass backdrop-blur-xl border border-line flex items-center justify-center text-paper hover:border-coral transition"
      >
        <Bell size={15} />
        {hayNoLeidas && (
          <motion.span
            key={pulso ? 'pulso' : 'quieto'}
            initial={pulso ? { scale: 0.6 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-danger flex items-center justify-center text-[9px] font-mono text-paper leading-none"
          >
            {noLeidas > 9 ? '9+' : noLeidas}
          </motion.span>
        )}
      </button>

      {montado && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.97, y: 6, filter: 'blur(6px)' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
              style={{ position: 'fixed', top: pos.top, right: pos.right, maxWidth: `calc(100vw - ${pos.right}px - 1rem)` }}
              className="w-[22rem] max-h-[28rem] overflow-auto bg-panel-glass backdrop-blur-2xl rounded-2xl p-2 shadow-2xl z-[100] origin-top-right"
            >
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <p className="text-[10px] font-mono uppercase tracking-wide text-muted">Notificaciones</p>
                {hayNoLeidas && (
                  <button
                    onClick={marcarTodasLeidas}
                    className="flex items-center gap-1 text-[10px] text-coral hover:text-paper transition"
                  >
                    <CheckCheck size={12} />
                    Marcar todas
                  </button>
                )}
              </div>

              {cargandoLista && notificaciones.length === 0 ? (
                <p className="text-muted text-xs text-center py-6">Cargando…</p>
              ) : notificaciones.length === 0 ? (
                <p className="text-muted text-xs text-center py-6">Todo al día ✨</p>
              ) : (
                notificaciones.map((n) => {
                  const Icono = ICONO_POR_TIPO[n.tipo] ?? Bell
                  return (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onClickNotificacion(n)}
                      onKeyDown={(e) => e.key === 'Enter' && onClickNotificacion(n)}
                      className={`group flex items-start gap-2.5 px-2.5 py-2 rounded-xl hover:bg-panel-2 transition cursor-pointer ${n.leida ? '' : 'bg-panel-2/40'}`}
                    >
                      <span className={`mt-0.5 flex-shrink-0 ${n.leida ? 'text-muted' : 'text-coral'}`}>
                        <Icono size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs truncate ${n.leida ? 'text-muted' : 'text-paper'}`}>{n.titulo}</p>
                        {n.cuerpo && <p className="text-[10px] text-muted truncate">{n.cuerpo}</p>}
                        <p className="text-[10px] font-mono text-muted mt-0.5">{formatearRelativo(n.creada_en, new Date())}</p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        {!n.leida && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              marcarLeida(n.id)
                            }}
                            aria-label="Marcar como leída"
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted hover:text-paper hover:bg-panel transition"
                          >
                            <Check size={12} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            borrar(n.id)
                          }}
                          aria-label="Borrar notificación"
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-panel transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {!n.leida && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-coral flex-shrink-0" />}
                    </div>
                  )
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
