'use client'

// Adaptado de React Bits (https://www.reactbits.dev/animations/animated-content).
//
// La fuente original depende de `gsap` + el plugin `ScrollTrigger` para
// disparar la animación cuando el elemento entra en el viewport. Igual que se
// hizo con TextType en el Sub-sprint 7.5, en vez de sumar gsap como
// dependencia nueva se reimplementa con `motion/react` (ya instalado): su
// `whileInView` + `viewport` hacen exactamente el mismo trabajo que
// ScrollTrigger, nativamente y con IntersectionObserver en lugar de un
// listener de scroll.
//
// Se conserva la API de props del original (distance, direction, reverse,
// duration, delay, threshold, initialOpacity, animateOpacity, scale) para que
// el componente sea reconocible, y se le suma `blur` — el proyecto ya usa
// fade+blur como su gesto de entrada en /ai y en el onboarding, y el encargo
// de esta landing lo pide explícitamente para el scroll-reveal.
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

type Props = {
  children: ReactNode
  distance?: number
  direction?: 'vertical' | 'horizontal'
  reverse?: boolean
  duration?: number
  initialOpacity?: number
  animateOpacity?: boolean
  scale?: number
  /** Fracción del elemento que debe verse para disparar (como el original). */
  threshold?: number
  delay?: number
  blur?: number
  className?: string
}

// Misma curva de "asentarse" que ya usan el overlay de /ai, el login y el
// onboarding. El original usa 'power3.out' de gsap, que es su equivalente.
const EASE_ASENTAR = [0.16, 1, 0.3, 1] as const

export default function AnimatedContent({
  children,
  distance = 60,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.15,
  delay = 0,
  blur = 8,
  className = '',
}: Props) {
  const reducirMovimiento = useReducedMotion()

  if (reducirMovimiento) return <div className={className}>{children}</div>

  const eje = direction === 'horizontal' ? 'x' : 'y'
  const desplazamiento = reverse ? -distance : distance

  return (
    <motion.div
      className={className}
      initial={{
        [eje]: desplazamiento,
        scale,
        opacity: animateOpacity ? initialOpacity : 1,
        filter: `blur(${blur}px)`,
      }}
      whileInView={{ [eje]: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }}
      // `once` es deliberado: una landing que re-anima cada vez que se sube y
      // se baja se siente inquieta, no viva.
      viewport={{ once: true, amount: threshold }}
      transition={{ duration, delay, ease: EASE_ASENTAR }}
    >
      {children}
    </motion.div>
  )
}
