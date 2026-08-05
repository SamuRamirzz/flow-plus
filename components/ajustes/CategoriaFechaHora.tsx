'use client'
import { useEffect, useState } from 'react'
import { Clock, MapPin, X } from 'lucide-react'
import { usePreferencias } from '@/lib/preferencias'
import { ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import { ZONAS } from '@/lib/ajustes/zonas'
import PremiumSelect from '@/components/ui/PremiumSelect'
import SegmentedToggle from '@/components/ui/SegmentedToggle'

export default function CategoriaFechaHora() {
  const { zonaHoraria, formatoReloj, actualizar } = usePreferencias()

  // Se lee UNA VEZ, en el primer render — es una lectura síncrona de una
  // API del navegador, no una suscripción a un sistema externo que cambie
  // con el tiempo, así que no hace falta un efecto para leerla (mismo
  // criterio que ya resolvió esta clase de problema en este proyecto:
  // lib/theme.tsx, PremiumSelect.abrir()). Un `useState` con inicializador
  // perezoso corre una sola vez de verdad, sin el setState-dentro-de-efecto
  // que dispara react-hooks/set-state-in-effect.
  const [deteccionInicial] = useState(() => {
    try {
      const detectada = Intl.DateTimeFormat().resolvedOptions().timeZone
      return detectada && detectada !== zonaHoraria ? detectada : null
    } catch {
      return null
    }
  })

  // Si la zona guardada YA es distinta del default (el usuario la cambió
  // alguna vez, aunque coincida por casualidad con Bogotá), nunca se
  // sobreescribe en silencio — el estado inicial de la sugerencia ya sale
  // calculado del mismo inicializador de arriba, sin un segundo efecto.
  const [sugerencia, setSugerencia] = useState<string | null>(
    deteccionInicial && zonaHoraria !== ZONA_HORARIA_POR_DEFECTO ? deteccionInicial : null
  )

  // El auto-guardado SÍ es un efecto real (side effect legítimo: la
  // llamada de red vía `actualizar()`, que gestiona su propio estado
  // dentro de PreferenciasProvider — esto nunca llama a un setState LOCAL
  // de este componente, así que no dispara el lint de efectos). Solo
  // corre si había algo que detectar Y el perfil seguía en el default sin
  // tocar (caso común: perfil recién creado, nadie lo configuró nunca).
  useEffect(() => {
    if (deteccionInicial && zonaHoraria === ZONA_HORARIA_POR_DEFECTO) {
      actualizar({ zonaHoraria: deteccionInicial })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-paper flex items-center gap-2">
          <Clock size={16} className="text-coral" />
          Fecha y hora
        </h2>
        <p className="text-muted text-xs mt-1">Cómo se calculan y se muestran tus fechas y horas.</p>
      </div>

      {sugerencia && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-coral/10 text-xs">
          <MapPin size={14} className="text-coral flex-shrink-0" />
          <p className="text-paper/90 flex-1">
            Detectamos que tu zona horaria podría ser <span className="font-medium text-paper">{sugerencia}</span>.
          </p>
          <button
            onClick={() => {
              actualizar({ zonaHoraria: sugerencia })
              setSugerencia(null)
            }}
            className="flex-shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full bg-coral text-ink hover:opacity-90 transition"
          >
            Usar zona detectada
          </button>
          <button onClick={() => setSugerencia(null)} title="Descartar" className="flex-shrink-0 text-muted hover:text-paper transition">
            <X size={13} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5 gap-4">
        <div className="min-w-0">
          <p className="text-sm text-paper font-medium">Zona horaria</p>
          <p className="text-muted text-xs mt-0.5">Se usa para calcular &quot;hoy&quot; y tus recordatorios.</p>
        </div>
        <PremiumSelect
          id="zona-horaria"
          options={ZONAS}
          value={zonaHoraria}
          onChange={(id) => actualizar({ zonaHoraria: id })}
        />
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
        <div>
          <p className="text-sm text-paper font-medium">Formato de reloj</p>
          <p className="text-muted text-xs mt-0.5">Se aplica en horario, foto de horario y recordatorios.</p>
        </div>
        <SegmentedToggle
          options={[
            { value: '24h', label: '24h' },
            { value: '12h', label: '12h' },
          ]}
          value={formatoReloj}
          onChange={(v) => actualizar({ formatoReloj: v as '12h' | '24h' })}
        />
      </div>
    </div>
  )
}
