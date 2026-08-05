'use client'
import { useEffect, useMemo } from 'react'
import { FileText, X } from 'lucide-react'
import type { AdjuntoPendiente } from '@/lib/ai/useAdjuntosPendientes'

type Props = {
  adjuntos: AdjuntoPendiente[]
  onQuitar: (id: string) => void
}

// Sub-sprint 7.3.1 — la lista de archivos ya elegidos para el próximo
// mensaje, cada uno con su chip (miniatura si es imagen, ícono si no) y su
// propio "quitar". Separado de AdjuntoBoton (que solo dispara el picker)
// porque ahora son varios adjuntos, no uno.
export default function AdjuntosPendientesChips({ adjuntos, onQuitar }: Props) {
  if (adjuntos.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {adjuntos.map(({ id, archivo }) => (
        <Chip key={id} archivo={archivo} onQuitar={() => onQuitar(id)} />
      ))}
    </div>
  )
}

function Chip({ archivo, onQuitar }: { archivo: File; onQuitar: () => void }) {
  const esImagen = archivo.type.startsWith('image/')
  const previewUrl = useMemo(() => (esImagen ? URL.createObjectURL(archivo) : null), [archivo, esImagen])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <div className="flex items-center gap-1.5 bg-panel-2/70 rounded-full pl-1 pr-2 py-1 flex-shrink-0">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
      ) : (
        <span className="w-6 h-6 rounded-full bg-panel flex items-center justify-center flex-shrink-0">
          <FileText size={12} className="text-muted" />
        </span>
      )}
      <span className="text-[11px] text-muted max-w-[110px] truncate">{archivo.name}</span>
      <button onClick={onQuitar} title="Quitar adjunto" className="text-muted hover:text-danger transition flex-shrink-0">
        <X size={12} />
      </button>
    </div>
  )
}
