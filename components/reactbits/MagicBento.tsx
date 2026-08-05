'use client'

// Adaptado de React Bits (https://www.reactbits.dev/components/magic-bento).
//
// Del original se conserva su técnica central, que es lo que le da el efecto:
// el puntero escribe cuatro custom properties en la tarjeta
// (`--glow-x`, `--glow-y`, `--glow-intensity`, `--glow-radius`) y un
// `radial-gradient` posicionado con esas variables dibuja el resplandor. Así
// el brillo sigue al cursor sin re-renderizar React en cada píxel.
//
// Tres adaptaciones deliberadas:
//
//  1. **Sin gsap.** El original lo usa para las partículas y la inclinación
//     de la tarjeta. Mismo criterio que TextType (Sub-sprint 7.5): se
//     reimplementa con lo que ya hay. Acá ni siquiera hizo falta `motion` —
//     escribir custom properties desde un `mousemove` con rAF es exactamente
//     lo que ya hace `reactbits/BorderGlow.jsx` en este repo, así que se
//     sigue ese patrón y el coste es cero dependencias y cero re-renders.
//  2. **Morado → coral.** El original trae `--glow-color: 132, 0, 255`
//     hardcodeado. Acá el color entra por prop en formato "R, G, B" y por
//     defecto es el coral del proyecto, para poder interpolarlo dentro de
//     `rgba()` con la intensidad variable.
//  3. **Sin `border`.** El original define `border: 1px solid #2F293A` en su
//     CSS. La directiva global de globals.css (`border-width: 0 !important`)
//     lo anularía igual, así que en vez de dejar una regla muerta la tarjeta
//     se separa del fondo como el resto del proyecto: `panel-glass` +
//     `backdrop-blur` + sombra.
//
// El `::after` del original se sustituye por un `<div>` de superposición.
// Es visualmente idéntico y evita arrastrar un archivo .css aparte solo para
// un pseudo-elemento — en React el nodo real es más fácil de mantener.
import { useCallback, useRef, type ReactNode } from 'react'

const CORAL_RGB = '255, 107, 77'

type Props = {
  children: ReactNode
  className?: string
  /** Color del resplandor en formato "R, G, B" (va dentro de rgba()). */
  glowColor?: string
  /** Radio del foco, en px. */
  glowRadius?: number
}

export default function MagicBentoCard({ children, className = '', glowColor = CORAL_RGB, glowRadius = 320 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef<number | null>(null)

  const alMover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!el) return
      const { clientX, clientY } = e

      // rAF para no escribir estilo más de una vez por frame: un mousemove
      // dispara muchas veces entre repintados y escribir en cada uno es
      // trabajo tirado.
      if (frame.current !== null) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        const r = el.getBoundingClientRect()
        el.style.setProperty('--glow-x', `${((clientX - r.left) / r.width) * 100}%`)
        el.style.setProperty('--glow-y', `${((clientY - r.top) / r.height) * 100}%`)
        el.style.setProperty('--glow-intensity', '1')
      })
    },
    []
  )

  const alSalir = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    ref.current?.style.setProperty('--glow-intensity', '0')
  }, [])

  return (
    <div
      ref={ref}
      onMouseMove={alMover}
      onMouseLeave={alSalir}
      style={
        {
          '--glow-x': '50%',
          '--glow-y': '50%',
          '--glow-intensity': '0',
          '--glow-radius': `${glowRadius}px`,
        } as React.CSSProperties
      }
      className={`group relative overflow-hidden rounded-[26px] bg-panel-glass backdrop-blur-xl shadow-xl shadow-black/20 transition-transform duration-500 hover:-translate-y-0.5 ${className}`}
    >
      {/* El resplandor. `opacity` interpola solo por la transición CSS, así
          que entra y sale suave sin que React se entere. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: 'var(--glow-intensity)',
          background: `radial-gradient(var(--glow-radius) circle at var(--glow-x) var(--glow-y), rgba(${glowColor}, 0.16) 0%, rgba(${glowColor}, 0.07) 35%, transparent 70%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  )
}
