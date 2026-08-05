'use client'
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Bell } from 'lucide-react'
import type { Materia } from '@/lib/types'
import { useMontado } from '@/lib/useMontado'

type Notificacion = {
  tareaId: string
  titulo: string
  materiaId: string
  prioridad: string
  fechaEntrega: string | null
  diasRestantes: number | null
  urgencia: 'baja' | 'media' | 'alta'
  agrupada: boolean
}

type Props = { materias: Materia[] }

// Sprint 11 — ya no calcula nada: lee lo que el cron de recordatorios
// (app/api/cron/recordatorios) ya decidió y guardó hoy en
// notificaciones_enviadas, vía GET /api/notificaciones. Las ventanas fijas
// por prioridad (alta=3/media=2/baja=1) y el cálculo con `new Date()` en
// cada render se movieron a lib/ai/agents/reminder/ventanas.ts, corriendo
// una vez al día en el servidor — ver ese archivo para las reglas
// (incluye una ventana más ancha para exámenes, que esta versión cliente
// nunca tuvo).
//
// Trade-off real, documentado a propósito: si el usuario abre la app ANTES
// de que el cron corra ese día (08:00 UTC por defecto, ver vercel.json),
// la campana está vacía aunque haya tareas genuinamente urgentes — el
// cálculo en vivo de antes no tenía esta ventana muerta. Es el costo de
// mover el cálculo al servidor (determinístico, testeable, sin recalcular
// en cada render) en vez de mantenerlo recalculado en el cliente.
function textoRelativo(dias: number) {
  if (dias < 0) return `Venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `Vence en ${dias} días`
}

export default function NotificationBell({ materias }: Props) {
  const montado = useMontado()
  const [open, setOpen] = useState(false)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Mismo patrón "fetch en un Effect" que app/page.tsx (cargarDatos): la
  // bandera `activo` condiciona el setState al resultado async en vez de
  // llamarlo síncrono en el cuerpo del efecto — evita tanto actualizar un
  // componente ya desmontado como disparar react-hooks/set-state-in-effect.
  useEffect(() => {
    let activo = true
    ;(async () => {
      try {
        const res = await fetch('/api/notificaciones')
        if (!res.ok) return
        const data = await res.json()
        if (!activo) return
        setNotificaciones(data.notificaciones ?? [])
      } catch {
        // Silencioso a propósito: sin recordatorios del servidor, la
        // campana simplemente se ve vacía — no es un error que el usuario
        // deba ver, mismo criterio que cargarMaterias/cargarTareas en
        // lib/tasks.ts (un fallo de red no es un banner de error).
      }
    })()
    return () => {
      activo = false
    }
  }, [])

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

  const materiaDe = (id: string) => materias.find((m) => m.id === id)
  // El agrupado lo decide el propio tamaño de la respuesta de hoy, no la
  // columna `agrupada` de cada fila (que ya viene consistente entre todas
  // las filas de una misma corrida, pero derivarlo acá evita depender de
  // que ningún futuro cambio la desincronice).
  const agrupado = notificaciones.length > 1

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-full bg-panel-glass backdrop-blur-md flex items-center justify-center ml-auto text-paper"
      >
        <Bell size={15} />
        {notificaciones.length > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger" />}
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
              style={{ position: 'fixed', top: pos.top, right: pos.right }}
              className="w-72 max-h-96 overflow-auto bg-panel-glass backdrop-blur-2xl rounded-2xl p-2 shadow-2xl z-[100] origin-top-right"
            >
              <p className="text-[10px] font-mono uppercase tracking-wide text-muted px-2.5 py-1.5">
                {agrupado ? `${notificaciones.length} tareas próximas` : 'Recordatorios'}
              </p>
              {notificaciones.length === 0 ? (
                <p className="text-muted text-xs text-center py-6">Nada urgente por ahora ✨</p>
              ) : (
                notificaciones.map((n) => {
                  const m = materiaDe(n.materiaId)
                  return (
                    <div key={n.tareaId} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-panel-2 transition">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: m?.color ?? '#5C7FA6' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-paper truncate">{n.titulo}</p>
                        <p className={`text-[10px] font-mono ${n.urgencia === 'alta' ? 'text-danger' : 'text-muted'}`}>
                          {n.diasRestantes !== null ? textoRelativo(n.diasRestantes) : '—'} · {n.prioridad}
                        </p>
                      </div>
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
