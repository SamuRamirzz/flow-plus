'use client'
import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { apiPatch } from '@/lib/api/cliente'
import { useToast } from '@/lib/toast'
import PremiumTimePicker from '@/components/ui/PremiumTimePicker'

type PrefsNotificacion = { maxNotifPorDia: number; noMolestarDesde: string | null; noMolestarHasta: string | null }

// A diferencia de zonaHoraria/formatoReloj (lib/preferencias.tsx, usadas en
// TODA la app y por eso viven en un contexto global cargado server-side),
// estas preferencias solo se leen acá y en el cron de recordatorios — no
// hace falta un contexto global para ellas, un fetch propio de esta
// categoría alcanza. Mismo patrón "fetch en un Effect" que
// NotificationBell.tsx (bandera `activo`, silencioso si falla).
export default function CategoriaNotificaciones() {
  const { notify } = useToast()
  const [cargando, setCargando] = useState(true)
  const [prefs, setPrefs] = useState<PrefsNotificacion>({ maxNotifPorDia: 3, noMolestarDesde: null, noMolestarHasta: null })

  useEffect(() => {
    let activo = true
    ;(async () => {
      try {
        const res = await fetch('/api/perfil')
        if (!res.ok) return
        const data = await res.json()
        if (!activo) return
        setPrefs({ maxNotifPorDia: data.maxNotifPorDia, noMolestarDesde: data.noMolestarDesde, noMolestarHasta: data.noMolestarHasta })
      } catch {
        // Silencioso — sin datos, se ven los defaults locales, mismo
        // criterio que cargarMaterias/cargarTareas/NotificationBell.
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => {
      activo = false
    }
  }, [])

  async function guardar(cambios: Partial<PrefsNotificacion>) {
    const anteriores = prefs
    setPrefs((actuales) => ({ ...actuales, ...cambios }))
    const resultado = await apiPatch('/api/perfil', cambios)
    if (!resultado.ok) {
      setPrefs(anteriores)
      notify('No se pudo guardar el cambio — se deshizo', false)
    }
  }

  if (cargando) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-paper flex items-center gap-2">
          <Bell size={16} className="text-coral" />
          Notificaciones
        </h2>
        <p className="text-muted text-xs mt-1">Cuántas notificaciones recibes y cuándo no molestarte.</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
        <div>
          <p className="text-sm text-paper font-medium">Tope diario</p>
          <p className="text-muted text-xs mt-0.5">Máximo de notificaciones nuevas por día.</p>
        </div>
        <input
          type="number"
          min={0}
          max={20}
          value={prefs.maxNotifPorDia}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isInteger(n) && n >= 0) guardar({ maxNotifPorDia: n })
          }}
          className="w-16 text-center bg-panel-glass backdrop-blur-md rounded-full px-3 py-2 text-xs text-paper outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
        />
      </div>

      <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
        <p className="text-sm text-paper font-medium">No molestar</p>
        <p className="text-muted text-xs mt-0.5 mb-3">Sin notificaciones nuevas en esta ventana. Deja vacío para no restringir.</p>
        <div className="flex items-center gap-2">
          <PremiumTimePicker value={prefs.noMolestarDesde ?? ''} onChange={(v) => guardar({ noMolestarDesde: v || null })} label="Desde" />
          <span className="text-muted text-xs">–</span>
          <PremiumTimePicker value={prefs.noMolestarHasta ?? ''} onChange={(v) => guardar({ noMolestarHasta: v || null })} label="Hasta" />
          {(prefs.noMolestarDesde || prefs.noMolestarHasta) && (
            <button
              onClick={() => guardar({ noMolestarDesde: null, noMolestarHasta: null })}
              title="Quitar restricción"
              className="flex-shrink-0 text-muted hover:text-paper transition p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
