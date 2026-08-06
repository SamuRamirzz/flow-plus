import { etiquetaIA, tonoEtiquetaIA } from '@/lib/archivos/formato'
import type { Archivo } from '@/lib/archivos/tipos'

const CLASES: Record<'accion' | 'info' | 'error', string> = {
  accion: 'bg-coral/12 text-coral',
  info: 'bg-[#5B8DEF]/12 text-[#7FA9F5]',
  error: 'bg-danger/12 text-danger',
}

/**
 * El badge de la columna "IA". Deriva su texto de `etiquetaIA()`, que replica
 * exactamente la derivación del servidor en `GET /api/archivos/actividad` —
 * un archivo no puede decir una cosa en la tabla y otra en la franja de
 * actividad.
 *
 * Un archivo sin analizar muestra un guion, NO un badge vacío ni una etiqueta
 * optimista: "todavía no se analizó" es un estado real y visible.
 */
export default function EtiquetaIA({ archivo }: { archivo: Archivo }) {
  const etiqueta = etiquetaIA(archivo)
  const tono = tonoEtiquetaIA(etiqueta)

  if (!etiqueta || tono === 'ninguno') return <span className="text-muted/50">—</span>

  return <span className={`inline-block rounded-md px-2 py-1 text-[11px] font-medium leading-none whitespace-nowrap ${CLASES[tono]}`}>{etiqueta}</span>
}
