'use client'
import { motion } from 'motion/react'

// Sprint Rediseño /ai — Parte D. Destello de luz al entrar a /ai: sube desde
// fuera del viewport (abajo), ilumina la pantalla, y se apaga.
//
// Decisiones de diseño:
//  - Es LUZ, no un flash blanco: un gradiente radial coral con blur muy
//    generoso, en `screen` blend mode, para que se sume al fondo (el
//    DotField) en vez de taparlo. Un overlay blanco opaco se sentiría como
//    un parpadeo de error, que es justo lo que el encargo pedía evitar.
//  - `pointer-events-none` + `aria-hidden`: NUNCA bloquea la interacción.
//    El usuario puede escribir mientras el destello todavía se desvanece
//    (requisito D.3).
//  - Sin estado ni timers: es `initial` → `animate` de una sola pasada. Al
//    terminar queda con opacidad 0 y ahí se queda; no hay loop ni cleanup
//    que se pueda quedar colgado.

const DURACION = 1.6

export default function DestelloEntrada() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5] overflow-hidden"
      // Todo el contenedor se apaga al final: sin esto, el gradiente
      // quedaría a opacidad 0 pero seguiría creando una capa de composición.
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.4, delay: DURACION }}
    >
      <motion.div
        className="absolute left-1/2 h-[900px] w-[1400px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255,107,77,0.55) 0%, rgba(255,84,112,0.28) 40%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
        // Entra por debajo del viewport (120vh) y sube hasta encuadrar la
        // pantalla. La opacidad hace un pico a mitad de camino: es lo que da
        // la sensación de "barrido de luz" en vez de un elemento que aparece.
        initial={{ y: '120vh', opacity: 0 }}
        animate={{ y: ['120vh', '10vh', '-10vh'], opacity: [0, 0.9, 0] }}
        transition={{ duration: DURACION, ease: [0.16, 1, 0.3, 1], times: [0, 0.55, 1] }}
      />
    </motion.div>
  )
}
