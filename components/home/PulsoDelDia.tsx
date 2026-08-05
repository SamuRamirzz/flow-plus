'use client'

import { motion, AnimatePresence } from 'motion/react'
import type { Encabezado } from '@/lib/estadisticas/pulso'

type Props = { encabezado: Encabezado }

const EASE_ASENTAR = [0.16, 1, 0.3, 1] as const

// El titular del pulso del día — fade+blur, mismo lenguaje visual que el
// resto de headers de la app (/ai, /bienvenida). Deliberadamente NO usa
// TextType (que tipea letra por letra): ese efecto tiene sentido para una
// frase fija que se revela una vez; acá el contenido cambia según datos
// reales cada vez que se recalcula, y "escribirlo" de nuevo en cada
// render/recarga se sentiría repetitivo en vez de vivo.
//
// `key={encabezado.titulo}` en el AnimatePresence: cuando el titular
// cambia de verdad (ej. se completó la última tarea de hoy y el mensaje
// pasa de "Tienes 1 tarea hoy" a "Nada pendiente hoy"), se anima la
// transición en vez de saltar en seco.
export default function PulsoDelDia({ encabezado }: Props) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: EASE_ASENTAR }}
      className="mb-6"
    >
      <AnimatePresence mode="wait">
        <motion.h1
          key={encabezado.titulo}
          initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
          transition={{ duration: 0.45, ease: EASE_ASENTAR }}
          className="font-display text-[26px] sm:text-[32px] font-semibold text-paper tracking-tight leading-[1.15]"
        >
          {encabezado.titulo}
        </motion.h1>
      </AnimatePresence>
      {encabezado.subtitulo && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-muted text-sm mt-1.5 truncate"
        >
          {encabezado.subtitulo}
        </motion.p>
      )}
    </motion.header>
  )
}
