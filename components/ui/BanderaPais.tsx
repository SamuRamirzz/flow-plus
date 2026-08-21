import type { CSSProperties } from 'react'

// Banderas como SVG inline, IDÉNTICAS en iOS, Android, Windows y macOS.
//
// ─────────────────────────────────────────────────────────────────────────
// Por qué no se usan los emojis de bandera
// ─────────────────────────────────────────────────────────────────────────
// El encargo pedía "los emojis de Apple en todos los clientes". Eso no se
// puede hacer con caracteres emoji, por dos motivos independientes:
//
//   1. Apple Color Emoji es una fuente PROPIETARIA. Empaquetarla y servirla
//      desde la web sería redistribuirla sin licencia.
//   2. Windows ni siquiera dibuja banderas: para 🇨🇴 muestra las letras
//      "CO". No es cuestión de estilo, es que el glifo no existe.
//
// Dibujarlas como SVG consigue el objetivo REAL —que se vean igual en todas
// partes— sin depender de la fuente del sistema, sin licencias ajenas y sin
// añadir ninguna dependencia. Cada bandera es una composición geométrica
// simple; las que llevan escudo (México, Ecuador, Brasil…) se representan
// con su forma reconocible, no con el escudo completo, porque a 20px de
// ancho el detalle no se distingue de una mancha.

type Props = { pais: string; size?: number; className?: string }

const R = 3 // radio de esquina, en unidades del viewBox 60x40

function Franjas({ colores, horizontal = true }: { colores: string[]; horizontal?: boolean }) {
  const n = colores.length
  return (
    <>
      {colores.map((c, i) =>
        horizontal ? (
          <rect key={i} x="0" y={(40 / n) * i} width="60" height={40 / n} fill={c} />
        ) : (
          <rect key={i} x={(60 / n) * i} y="0" width={60 / n} height="40" fill={c} />
        )
      )}
    </>
  )
}

/**
 * Franjas horizontales desiguales: [color, alturaRelativa][].
 *
 * El desplazamiento de cada franja se calcula sumando las anteriores con
 * `reduce`, no mutando un acumulador durante el render — eso último lo
 * rechaza `react-hooks/immutability` con razón: una variable reasignada
 * mientras se renderiza da resultados distintos si React reintenta el
 * render.
 */
function FranjasDesiguales({ tramos }: { tramos: [string, number][] }) {
  const desplazamientos = tramos.reduce<number[]>((acc, _tramo, i) => [...acc, (acc[i - 1] ?? 0) + (i === 0 ? 0 : tramos[i - 1][1] * 40)], [])
  return (
    <>
      {tramos.map(([c, h], i) => (
        <rect key={i} x="0" y={desplazamientos[i]} width="60" height={h * 40} fill={c} />
      ))}
    </>
  )
}

const BANDERAS: Record<string, React.ReactNode> = {
  CO: <FranjasDesiguales tramos={[['#FCD116', 0.5], ['#003893', 0.25], ['#CE1126', 0.25]]} />,
  MX: (
    <>
      <Franjas colores={['#006847', '#FFFFFF', '#CE1126']} horizontal={false} />
      <circle cx="30" cy="20" r="5.5" fill="#8B5A2B" opacity="0.9" />
    </>
  ),
  AR: (
    <>
      <Franjas colores={['#74ACDF', '#FFFFFF', '#74ACDF']} />
      <circle cx="30" cy="20" r="4.5" fill="#F6B40E" />
    </>
  ),
  PE: <Franjas colores={['#D91023', '#FFFFFF', '#D91023']} horizontal={false} />,
  CL: (
    <>
      <rect x="0" y="0" width="60" height="20" fill="#FFFFFF" />
      <rect x="0" y="20" width="60" height="20" fill="#D52B1E" />
      <rect x="0" y="0" width="20" height="20" fill="#0039A6" />
      <path d="M10 5.5l1.5 4.4h4.6l-3.7 2.7 1.4 4.4-3.8-2.7-3.8 2.7 1.4-4.4-3.7-2.7h4.6z" fill="#FFFFFF" />
    </>
  ),
  EC: (
    <>
      <FranjasDesiguales tramos={[['#FFDD00', 0.5], ['#0072CE', 0.25], ['#EF3340', 0.25]]} />
      <circle cx="30" cy="20" r="5" fill="#FFDD00" stroke="#0072CE" strokeWidth="1.2" />
    </>
  ),
  VE: (
    <>
      <Franjas colores={['#FFCC00', '#00247D', '#CF142B']} />
      <circle cx="30" cy="20" r="1" fill="#FFFFFF" />
      <circle cx="24" cy="21" r="1" fill="#FFFFFF" />
      <circle cx="36" cy="21" r="1" fill="#FFFFFF" />
    </>
  ),
  BO: <Franjas colores={['#D52B1E', '#F9E300', '#007A33']} />,
  UY: (
    <>
      <rect x="0" y="0" width="60" height="40" fill="#FFFFFF" />
      {[1, 3, 5, 7].map((i) => (
        <rect key={i} x="0" y={(40 / 9) * i} width="60" height={40 / 9} fill="#0038A8" />
      ))}
      <rect x="0" y="0" width="24" height={(40 / 9) * 4} fill="#FFFFFF" />
      <circle cx="12" cy="9" r="5" fill="#FCD116" />
    </>
  ),
  PY: <Franjas colores={['#D52B1E', '#FFFFFF', '#0038A8']} />,
  CR: <FranjasDesiguales tramos={[['#002B7F', 0.2], ['#FFFFFF', 0.2], ['#CE1126', 0.2], ['#FFFFFF', 0.2], ['#002B7F', 0.2]]} />,
  PA: (
    <>
      <rect x="0" y="0" width="60" height="40" fill="#FFFFFF" />
      <rect x="30" y="0" width="30" height="20" fill="#DA121A" />
      <rect x="0" y="20" width="30" height="20" fill="#072357" />
    </>
  ),
  GT: (
    <>
      <Franjas colores={['#4997D0', '#FFFFFF', '#4997D0']} horizontal={false} />
      <circle cx="30" cy="20" r="4" fill="none" stroke="#3E8B43" strokeWidth="1.4" />
    </>
  ),
  HN: (
    <>
      <Franjas colores={['#0073CF', '#FFFFFF', '#0073CF']} />
      <circle cx="30" cy="20" r="1.3" fill="#0073CF" />
      <circle cx="24" cy="17" r="1.3" fill="#0073CF" />
      <circle cx="36" cy="17" r="1.3" fill="#0073CF" />
      <circle cx="24" cy="23" r="1.3" fill="#0073CF" />
      <circle cx="36" cy="23" r="1.3" fill="#0073CF" />
    </>
  ),
  SV: (
    <>
      <Franjas colores={['#0F47AF', '#FFFFFF', '#0F47AF']} />
      <circle cx="30" cy="20" r="4" fill="none" stroke="#0F47AF" strokeWidth="1.2" />
    </>
  ),
  NI: (
    <>
      <Franjas colores={['#0067C6', '#FFFFFF', '#0067C6']} />
      <circle cx="30" cy="20" r="4" fill="none" stroke="#0067C6" strokeWidth="1.2" />
    </>
  ),
  DO: (
    <>
      <rect x="0" y="0" width="60" height="40" fill="#CE1126" />
      <rect x="0" y="0" width="30" height="20" fill="#002D62" />
      <rect x="30" y="20" width="30" height="20" fill="#002D62" />
      <rect x="0" y="16" width="60" height="8" fill="#FFFFFF" />
      <rect x="26" y="0" width="8" height="40" fill="#FFFFFF" />
    </>
  ),
  CU: (
    <>
      {[0, 2, 4].map((i) => (
        <rect key={i} x="0" y={(40 / 5) * i} width="60" height={40 / 5} fill="#002A8F" />
      ))}
      {[1, 3].map((i) => (
        <rect key={i} x="0" y={(40 / 5) * i} width="60" height={40 / 5} fill="#FFFFFF" />
      ))}
      <path d="M0 0L26 20L0 40z" fill="#CF142B" />
      <path d="M8 15.5l1.4 4.2h4.4l-3.6 2.6 1.4 4.2-3.6-2.6-3.6 2.6 1.4-4.2-3.6-2.6h4.4z" fill="#FFFFFF" />
    </>
  ),
  PR: (
    <>
      {[0, 2, 4].map((i) => (
        <rect key={i} x="0" y={(40 / 5) * i} width="60" height={40 / 5} fill="#ED0000" />
      ))}
      {[1, 3].map((i) => (
        <rect key={i} x="0" y={(40 / 5) * i} width="60" height={40 / 5} fill="#FFFFFF" />
      ))}
      <path d="M0 0L26 20L0 40z" fill="#0050F0" />
      <path d="M8 15.5l1.4 4.2h4.4l-3.6 2.6 1.4 4.2-3.6-2.6-3.6 2.6 1.4-4.2-3.6-2.6h4.4z" fill="#FFFFFF" />
    </>
  ),
  ES: <FranjasDesiguales tramos={[['#AA151B', 0.25], ['#F1BF00', 0.5], ['#AA151B', 0.25]]} />,
  US: (
    <>
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x="0" y={(40 / 13) * i} width="60" height={40 / 13} fill={i % 2 === 0 ? '#B22234' : '#FFFFFF'} />
      ))}
      <rect x="0" y="0" width="26" height={(40 / 13) * 7} fill="#3C3B6E" />
    </>
  ),
  BR: (
    <>
      <rect x="0" y="0" width="60" height="40" fill="#009B3A" />
      <path d="M30 4L56 20L30 36L4 20z" fill="#FEDF00" />
      <circle cx="30" cy="20" r="7" fill="#002776" />
    </>
  ),
  CA: (
    <>
      <rect x="0" y="0" width="60" height="40" fill="#FFFFFF" />
      <rect x="0" y="0" width="15" height="40" fill="#FF0000" />
      <rect x="45" y="0" width="15" height="40" fill="#FF0000" />
      <path d="M30 11l2 5 4-2-1.5 5.5H38l-3 3 1 2-5-1v4h-2v-4l-5 1 1-2-3-3h3.5L23 14l4 2z" fill="#FF0000" />
    </>
  ),
}

/**
 * Bandera de un país por su código ISO alpha-2. Si no está en el catálogo,
 * cae a un rectángulo neutro con las iniciales — nunca a un hueco vacío ni a
 * un emoji que se vería distinto en cada sistema.
 */
export default function BanderaPais({ pais, size = 20, className }: Props) {
  const contenido = BANDERAS[pais]
  const estilo: CSSProperties = { width: size, height: (size * 2) / 3, flexShrink: 0 }

  return (
    <svg
      viewBox="0 0 60 40"
      style={estilo}
      className={className}
      role="img"
      aria-label={`Bandera de ${pais}`}
      // Se recorta con un clip redondeado en vez de `border-radius`: la
      // directiva global de cero bordes de este proyecto no afecta a SVG,
      // pero el redondeo por CSS sí se pierde al exportar o imprimir.
    >
      <defs>
        <clipPath id={`bandera-${pais}`}>
          <rect x="0" y="0" width="60" height="40" rx={R} ry={R} />
        </clipPath>
      </defs>
      <g clipPath={`url(#bandera-${pais})`}>
        {contenido ?? (
          <>
            <rect x="0" y="0" width="60" height="40" fill="var(--color-panel-2)" />
            <text x="30" y="26" textAnchor="middle" fontSize="18" fill="var(--color-muted)">
              {pais}
            </text>
          </>
        )}
      </g>
      {/* Contorno sutil para que una bandera con blanco al borde (Perú,
          Canadá) no se funda con el fondo del panel. */}
      <rect x="0.5" y="0.5" width="59" height="39" rx={R} ry={R} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
    </svg>
  )
}
