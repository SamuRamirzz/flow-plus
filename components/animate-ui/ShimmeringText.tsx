'use client'

// Adaptado de Animate UI (https://animate-ui.com/docs/primitives/texts/shimmering)
// para el Sub-sprint 7.5. Única dependencia real (`motion`) ya estaba en el
// proyecto — no se sumó nada al instalar esta.
//
// Dos cambios sobre el original, documentados acá porque alteran el
// comportamiento, no solo el estilo:
//   1. `loop` (nuevo prop, default `true` = comportamiento original) — el
//      original siempre repite infinito (`repeat: Infinity`). Sprint 7.5
//      Parte B pide un brillo que corre UNA vez, así que `loop={false}`
//      pone `repeat: 0`.
//   2. Los colores por defecto (`--color-neutral-500`/`--color-neutral-300`)
//      no existen en los tokens de este proyecto (ver app/globals.css) — se
//      reemplazaron por `--color-muted` y `--color-coral`, que sí existen y
//      calzan con el resto de la paleta (coral es el acento del proyecto).
import * as React from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'

type ShimmeringTextProps = Omit<HTMLMotionProps<'span'>, 'children'> & {
  text: string
  duration?: number
  wave?: boolean
  color?: string
  shimmeringColor?: string
  /** `false` = el brillo corre una sola vez y se detiene. Default `true` (comportamiento original de la librería). */
  loop?: boolean
}

function ShimmeringText({
  text,
  duration = 1,
  transition,
  wave = false,
  color = 'var(--color-muted)',
  shimmeringColor = 'var(--color-coral)',
  loop = true,
  ...props
}: ShimmeringTextProps) {
  return (
    <motion.span
      style={
        {
          '--shimmering-color': shimmeringColor,
          '--color': color,
          color: 'var(--color)',
          position: 'relative',
          display: 'inline-block',
          perspective: '500px',
        } as React.CSSProperties
      }
      {...props}
    >
      {text?.split('')?.map((char, i) => (
        <motion.span
          key={i}
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            transformStyle: 'preserve-3d',
          }}
          initial={{
            ...(wave
              ? {
                  scale: 1,
                  rotateY: 0,
                }
              : {}),
            color: 'var(--color)',
          }}
          animate={{
            ...(wave
              ? {
                  x: [0, 5, 0],
                  y: [0, -5, 0],
                  scale: [1, 1.1, 1],
                  rotateY: [0, 15, 0],
                }
              : {}),
            color: ['var(--color)', 'var(--shimmering-color)', 'var(--color)'],
          }}
          transition={{
            duration,
            repeat: loop ? Infinity : 0,
            repeatType: 'loop',
            repeatDelay: text.length * 0.05,
            delay: (i * duration) / text.length,
            ease: 'easeInOut',
            ...transition,
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  )
}

export { ShimmeringText, type ShimmeringTextProps }
