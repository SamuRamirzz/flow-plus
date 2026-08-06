'use client'

import { motion, useReducedMotion } from 'motion/react'

// Mismo requisito de underline-reveal en cada título de sección de las
// páginas legales — se dispara al entrar en el viewport durante el scroll,
// igual que AnimatedContent (components/reactbits/AnimatedContent.tsx), y
// reusa la misma curva de "asentarse" que ya usan TextType/landing/onboarding.
const EASE_ASENTAR = [0.16, 1, 0.3, 1] as const

type Props = {
  numero: string
  children: React.ReactNode
  id: string
}

// El `<span>` que envuelve numero+texto es `inline-block`: así su ancho se
// achica al ancho REAL del contenido (no al 100% del contenedor), y la barra
// — posicionada `absolute` dentro de ese mismo span — anima su `width` de 0%
// a 100% relativo a ESE ancho, no al de la página. Es lo que pide el encargo
// explícitamente: la barra cubre el texto del título, no el ancho completo.
export default function TituloSeccion({ numero, children, id }: Props) {
  const reducirMovimiento = useReducedMotion()

  return (
    <h2 id={id} className="scroll-mt-24 font-display text-2xl sm:text-3xl font-semibold text-paper tracking-tight mb-8">
      <span className="relative inline-block pb-2">
        <span className="text-coral mr-2 font-mono text-lg sm:text-xl align-baseline">{numero}</span>
        {children}
        <motion.span
          aria-hidden="true"
          className="absolute left-0 bottom-0 h-[2px] bg-coral rounded-full"
          initial={{ width: reducirMovimiento ? '100%' : '0%' }}
          whileInView={{ width: '100%' }}
          viewport={{ once: true, amount: 0.9 }}
          transition={{ duration: 0.7, ease: EASE_ASENTAR }}
        />
      </span>
    </h2>
  )
}
