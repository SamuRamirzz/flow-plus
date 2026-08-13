'use client'
import { useState } from 'react'
import { FileText, Download, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/toast'
import SegmentedToggle from '@/components/ui/SegmentedToggle'
import type { Periodo } from '@/lib/informes/tipos'

// Sprint 18a — Descarga de informes en PDF.
//
// Va en Ajustes y no en Home porque es una acción de cuenta ("llevarme mis
// datos"), con parámetros y latencia, no un dato vivo del día. Home es
// superficie de estado, no de operaciones.

const OPCIONES: { value: Periodo; label: string }[] = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
]

const DESCRIPCION: Record<Periodo, string> = {
  semanal: 'La semana en curso, día a día, comparada con la anterior.',
  mensual: 'El mes en curso, semana a semana, comparado con el mes pasado.',
  anual: 'El año en curso, mes a mes, con tus mejores y peores rachas.',
}

export default function CategoriaInformes() {
  const { notify } = useToast()
  const [periodo, setPeriodo] = useState<Periodo>('semanal')
  const [generando, setGenerando] = useState(false)

  // A diferencia de la descarga de Archivos (un <a href> puro, porque el
  // servidor responde al instante), acá el PDF tarda segundos: consulta +
  // Gemini + render. Sin fetch no habría forma de mostrar "Generando…" ni de
  // avisar de un fallo — el navegador se quedaría mudo.
  async function descargar() {
    if (generando) return
    setGenerando(true)
    try {
      const res = await fetch(`/api/informes/${periodo}`)
      if (!res.ok) {
        const detalle = await res.json().catch(() => null)
        notify(detalle?.error ?? 'No se pudo generar el informe', false)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = nombreDesdeCabecera(res.headers.get('content-disposition')) ?? `flowplus-informe-${periodo}.pdf`
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      // Sin esto el blob queda en memoria hasta que se recargue la página.
      URL.revokeObjectURL(url)
      notify('Informe descargado')
    } catch {
      notify('No se pudo generar el informe', false)
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-paper flex items-center gap-2">
          <FileText size={16} className="text-coral" />
          Informes
        </h2>
        <p className="text-muted text-xs mt-1">Descarga un resumen de tu rendimiento en PDF.</p>
      </div>

      <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
        <p className="text-sm text-paper font-medium">Periodo</p>
        <p className="text-muted text-xs mt-0.5 mb-3">{DESCRIPCION[periodo]}</p>
        <SegmentedToggle options={OPCIONES} value={periodo} onChange={(v) => setPeriodo(v as Periodo)} />
      </div>

      <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
        <p className="text-sm text-paper font-medium">Qué incluye</p>
        <ul className="text-muted text-xs mt-2 space-y-1 leading-relaxed">
          <li>· Tareas completadas, puntualidad y racha</li>
          <li>· Desglose por materia y gráfico de tendencia</li>
          <li>· Actividad en Archivos y Notas</li>
          <li>· Comparación con el periodo anterior</li>
        </ul>
        {/* Honestidad sobre la IA: es una sección del informe, no el informe. */}
        <p className="text-muted/70 text-[11px] mt-3 leading-relaxed">
          Los &quot;puntos clave&quot; los redacta la IA a partir de tus propios números. Si no está disponible, el informe se genera igual
          con un resumen automático.
        </p>
      </div>

      <button
        onClick={descargar}
        disabled={generando}
        className="flex items-center justify-center gap-2 text-xs font-semibold px-4 py-3 rounded-full bg-coral text-ink hover:opacity-90 transition disabled:opacity-70"
      >
        {generando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {generando ? 'Generando informe…' : 'Descargar informe'}
      </button>
    </div>
  )
}

/** Respeta el nombre que puso el servidor (RFC 5987) en vez de rearmarlo. */
function nombreDesdeCabecera(cabecera: string | null): string | null {
  if (!cabecera) return null
  const utf8 = cabecera.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8) return decodeURIComponent(utf8[1])
  const simple = cabecera.match(/filename="([^"]+)"/i)
  return simple ? simple[1] : null
}
