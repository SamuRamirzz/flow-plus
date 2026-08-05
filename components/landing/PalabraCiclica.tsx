'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

// Tipografía cinética del titular: una palabra del medio cambia y, como cada
// una mide distinto, las palabras vecinas se corren solas.
//
// El movimiento sale de `layout`, no de un fade: el encargo pedía
// explícitamente "palabras que se reordenan con layout de Framer Motion, no
// solo fade-in simple". Con un fade, la palabra nueva aparecería en el sitio
// de la anterior y el resto del renglón daría un salto seco al recalcularse;
// con `layout`, motion mide el antes y el después y anima la diferencia, que
// es lo que hace que el renglón entero se acomode en vez de saltar.
const MS_POR_PALABRA = 2600

export default function PalabraCiclica({ palabras, className = '' }: { palabras: string[]; className?: string }) {
  const [i, setI] = useState(0)
  const reducir = useReducedMotion()

  useEffect(() => {
    if (reducir || palabras.length < 2) return
    const id = setInterval(() => setI((n) => (n + 1) % palabras.length), MS_POR_PALABRA)
    return () => clearInterval(id)
  }, [palabras.length, reducir])

  const actual = palabras[i] ?? palabras[0] ?? ''

  return (
    <motion.span layout className={`relative inline-flex text-coral ${className}`} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={actual}
          layout
          initial={{ opacity: 0, y: '0.5em', filter: 'blur(7px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: '-0.5em', filter: 'blur(7px)', position: 'absolute' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block whitespace-nowrap"
        >
          {actual}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}
