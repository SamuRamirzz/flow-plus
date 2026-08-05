import type { LucideIcon } from 'lucide-react'
import {
  Calculator,
  FlaskConical,
  Atom,
  Dumbbell,
  BookOpen,
  Globe,
  Palette,
  Music,
  Church,
  Landmark,
  Map,
  Leaf,
  Laptop,
  Code,
  Database,
  Network,
  Brain,
  Scale,
  Coins,
  BarChart3,
  HeartPulse,
  Stethoscope,
  GraduationCap,
} from 'lucide-react'
import type { NombreIcono } from '@/lib/materias/asignarIcono'

// Un solo lugar que traduce el string guardado en `materias.icono` (ver
// lib/materias/asignarIcono.ts, mismo enum) al componente real de
// lucide-react — la base y el mapeo determinístico nunca importan React.
export const ICONOS_MATERIA: Record<NombreIcono, LucideIcon> = {
  Calculator,
  FlaskConical,
  Atom,
  Dumbbell,
  BookOpen,
  Globe,
  Palette,
  Music,
  Church,
  Landmark,
  Map,
  Leaf,
  Laptop,
  Code,
  Database,
  Network,
  Brain,
  Scale,
  Coins,
  BarChart3,
  HeartPulse,
  Stethoscope,
  GraduationCap,
}

type IconoMateriaProps = {
  icono: string | undefined | null
  size?: number
  className?: string
  style?: React.CSSProperties
}

// Componente dedicado para resolver+renderizar en un solo paso — evita que
// cada lugar que muestra una materia tenga que hacer
// `const Icono = iconoDeMateria(x); <Icono/>` (ese patrón dispara
// react-hooks/static-components: el linter no puede saber que
// ICONOS_MATERIA son referencias estables, no componentes nuevos por
// render). Este componente sí resuelve internamente, pero como única
// responsabilidad propia — no hay una variable con nombre de componente
// creada a mitad del render de OTRO componente.
export function IconoMateria({ icono, size, className, style }: IconoMateriaProps) {
  const Resuelto = (icono && ICONOS_MATERIA[icono as NombreIcono]) || GraduationCap
  return <Resuelto size={size} className={className} style={style} />
}
