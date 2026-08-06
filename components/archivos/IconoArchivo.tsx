import { FileText, Image as ImageIcon, FileType2, FileCode2, CalendarDays, File } from 'lucide-react'
import { familiaDeArchivo, type FamiliaArchivo } from '@/lib/archivos/formato'

// Un ícono por familia de archivo, con su propio color. La referencia usa
// los íconos de marca de Adobe/Microsoft (el cuadrito rojo de PDF, el azul
// de Word); acá se usan los de lucide con el color aplicado por token,
// porque el proyecto ya depende de lucide en todas partes y meter logos de
// terceros implicaría empaquetar assets de marca ajenos solo para decorar
// una tabla.
const ESTILO: Record<FamiliaArchivo, { Icono: typeof FileText; color: string; fondo: string }> = {
  pdf: { Icono: FileType2, color: 'text-[#FF6B6B]', fondo: 'bg-[#FF6B6B]/10' },
  imagen: { Icono: ImageIcon, color: 'text-[#4DA3FF]', fondo: 'bg-[#4DA3FF]/10' },
  documento: { Icono: FileText, color: 'text-[#5B8DEF]', fondo: 'bg-[#5B8DEF]/10' },
  texto: { Icono: FileCode2, color: 'text-[#9B8DFF]', fondo: 'bg-[#9B8DFF]/10' },
  calendario: { Icono: CalendarDays, color: 'text-[#FFB84D]', fondo: 'bg-[#FFB84D]/10' },
  otro: { Icono: File, color: 'text-muted', fondo: 'bg-panel-2' },
}

type Props = { mimeType: string | null; nombre: string; tam?: number }

export default function IconoArchivo({ mimeType, nombre, tam = 34 }: Props) {
  const { Icono, color, fondo } = ESTILO[familiaDeArchivo(mimeType, nombre)]
  return (
    <span className={`inline-flex items-center justify-center rounded-lg shrink-0 ${fondo}`} style={{ width: tam, height: tam }}>
      <Icono size={Math.round(tam * 0.5)} className={color} />
    </span>
  )
}
