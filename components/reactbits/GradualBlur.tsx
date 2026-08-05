'use client'

// Adaptado de React Bits (https://www.reactbits.dev/animations/gradual-blur).
//
// Único de los tres adaptados que NO traía dependencias nuevas: el original
// es React + CSS puro. Su técnica se conserva tal cual — apilar N capas, cada
// una con un `backdrop-filter: blur()` mayor y una `mask-image` de degradado
// que limita dónde aplica, de modo que el desenfoque sube de forma continua
// en vez de en un escalón visible.
//
// Qué se recortó del original y por qué: traía 13 presets, modo `responsive`,
// `target: 'page'`, animación de entrada y una curva configurable. Acá solo
// hacen falta el borde y la intensidad, así que se quedó la matemática (las
// curvas y el reparto exponencial) y se fue la configurabilidad que nadie iba
// a usar. Los colores nunca fueron un problema de adaptación: este componente
// no pinta color, solo desenfoca lo que haya detrás.
import { useMemo } from 'react'

type Props = {
  position?: 'top' | 'bottom'
  /** Alto de la zona desenfocada. */
  height?: string
  /** Cuánto desenfoque en el extremo. */
  strength?: number
  /** Cuántas capas. Más capas = rampa más suave y más coste de composición. */
  divCount?: number
  /** Reparto exponencial: casi nada al principio y mucho al final. */
  exponential?: boolean
  className?: string
}

const DIRECCION = { top: 'to top', bottom: 'to bottom' } as const

export default function GradualBlur({
  position = 'bottom',
  height = '7rem',
  strength = 2,
  divCount = 5,
  exponential = true,
  className = '',
}: Props) {
  const capas = useMemo(() => {
    const incremento = 100 / divCount
    const direccion = DIRECCION[position]

    return Array.from({ length: divCount }, (_, i) => {
      const n = i + 1
      const progreso = n / divCount

      // Del original: exponencial reparte el desenfoque hacia el extremo
      // (queda más natural sobre contenido), lineal lo reparte parejo.
      const desenfoque = exponential
        ? Math.pow(2, progreso * 4) * 0.0625 * strength
        : 0.0625 * (progreso * divCount + 1) * strength

      // Cada capa solo "existe" en su franja: la máscara la revela entre
      // p1..p2 y la esconde fuera. Es lo que evita el escalón.
      const p1 = incremento * (n - 1)
      const p2 = incremento * n
      const p3 = incremento * (n + 1)
      const p4 = incremento * (n + 2)
      const degradado = `transparent ${p1}%, black ${p2}%, black ${p3}%, transparent ${p4}%`

      return {
        clave: n,
        estilo: {
          maskImage: `linear-gradient(${direccion}, ${degradado})`,
          WebkitMaskImage: `linear-gradient(${direccion}, ${degradado})`,
          backdropFilter: `blur(${desenfoque.toFixed(3)}rem)`,
          WebkitBackdropFilter: `blur(${desenfoque.toFixed(3)}rem)`,
        } as React.CSSProperties,
      }
    })
  }, [position, strength, divCount, exponential])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute left-0 right-0 ${position === 'top' ? 'top-0' : 'bottom-0'} ${className}`}
      style={{ height }}
    >
      {capas.map((c) => (
        <div key={c.clave} className="absolute inset-0" style={c.estilo} />
      ))}
    </div>
  )
}
