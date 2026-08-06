'use client'

import { motion } from 'motion/react'
import { CloudUpload, AlertCircle } from 'lucide-react'
import type { EspacioDrive } from '@/lib/archivos/tipos'
import { formatearTamano, porcentajeUsado } from '@/lib/archivos/formato'

type Props = {
  espacio: EspacioDrive | null
  error: string | null
  cargando: boolean
  compacto?: boolean
}

// Indicador de almacenamiento de la referencia (esquina superior derecha).
// Las cifras son las REALES de la cuenta de Drive vinculada
// (`GET /api/archivos/espacio` → obtenerEspacioUsado), no una cuota
// inventada de Flow+: Flow+ no aloja nada, todo vive en el Drive del usuario.
//
// Por eso el estado de error importa tanto como el de éxito: si Drive no
// está vinculado (o la API está deshabilitada, que ya pasó una vez en este
// proyecto) hay que decirlo, no mostrar "0 MB / 0 MB" como si estuviera todo
// bien y vacío.
export default function IndicadorEspacio({ espacio, error, cargando, compacto = false }: Props) {
  if (cargando) {
    return (
      <div className={`rounded-2xl bg-panel-glass backdrop-blur-md ${compacto ? 'p-3' : 'px-4 py-3'} animate-pulse`}>
        <div className="h-3 w-28 rounded bg-panel-2" />
        <div className="mt-2 h-1.5 w-36 rounded-full bg-panel-2" />
      </div>
    )
  }

  if (error || !espacio) {
    return (
      <div className={`rounded-2xl bg-panel-glass backdrop-blur-md ${compacto ? 'p-3' : 'px-4 py-3'} flex items-start gap-2.5 max-w-[16rem]`}>
        <AlertCircle size={15} className="text-muted mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-paper">Almacenamiento no disponible</p>
          <p className="text-[10px] text-muted leading-snug mt-0.5 line-clamp-2">{error ?? 'Vincula tu cuenta de Google Drive desde Ajustes.'}</p>
        </div>
      </div>
    )
  }

  const pct = porcentajeUsado(espacio.usadoBytes, espacio.totalBytes)
  const casiLleno = pct >= 90

  return (
    <div className={`rounded-2xl bg-panel-glass backdrop-blur-md ${compacto ? 'p-3' : 'px-4 py-3'}`}>
      <div className="flex items-center gap-2.5">
        <CloudUpload size={compacto ? 15 : 17} className={casiLleno ? 'text-danger' : 'text-coral'} />
        <div className="min-w-0">
          <p className={`font-display font-semibold text-paper leading-none ${compacto ? 'text-xs' : 'text-sm'}`}>
            {formatearTamano(espacio.usadoBytes)} <span className="text-muted font-normal">/ {formatearTamano(espacio.totalBytes)}</span>
          </p>
          <p className="text-[10px] text-muted mt-1 leading-none">Almacenamiento usado</p>
        </div>
      </div>
      <div className={`${compacto ? 'mt-2.5' : 'mt-3'} h-1.5 rounded-full bg-panel-2 overflow-hidden`}>
        <motion.div
          className={`h-full rounded-full ${casiLleno ? 'bg-danger' : 'bg-coral'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}
