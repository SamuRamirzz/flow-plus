'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react'

// Resplandor coral que sigue al cursor dentro del hero.
//
// El catálogo tiene tres candidatos para esto (Ghost Cursor, Splash Cursor,
// Pixel Trail) y los tres se revisaron en vivo. Se descartaron los tres por la
// misma razón, que es de producto y no de gusto: Ghost Cursor arrastra `three`
// + cuatro pasadas de postprocesado (EffectComposer, RenderPass, ShaderPass,
// UnrealBloomPass) y los otros dos son igual de pesados. Meter un motor 3D en
// la página que recibe el tráfico frío, para un adorno, es exactamente el tipo
// de coste que no se paga: el primer render es lo único que decide si alguien
// se queda.
//
// La versión de acá es un `radial-gradient` con muelle, con lo que el proyecto
// ya tiene. El encargo pedía "discreto, no gimmick invasivo", así que:
// `pointer-events-none`, se apaga al salir del hero, y no existe en táctil
// (no hay cursor que seguir) ni con movimiento reducido.
export default function RastroCursor() {
  const contenedor = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const reducirMovimiento = useReducedMotion()

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  // El muelle es lo que lo convierte en un rastro que persigue, en vez de un
  // punto pegado al puntero.
  const sx = useSpring(x, { stiffness: 120, damping: 22, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 120, damping: 22, mass: 0.6 })

  useEffect(() => {
    if (reducirMovimiento) return
    const el = contenedor.current?.parentElement
    if (!el) return

    function alMover(e: MouseEvent) {
      const r = el!.getBoundingClientRect()
      x.set(e.clientX - r.left)
      y.set(e.clientY - r.top)
      setVisible(true)
    }
    function alSalir() {
      setVisible(false)
    }

    el.addEventListener('mousemove', alMover)
    el.addEventListener('mouseleave', alSalir)
    return () => {
      el.removeEventListener('mousemove', alMover)
      el.removeEventListener('mouseleave', alSalir)
    }
  }, [x, y, reducirMovimiento])

  if (reducirMovimiento) return null

  return (
    <div ref={contenedor} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden hidden md:block">
      <motion.div
        className="absolute rounded-full"
        style={{
          x: sx,
          y: sy,
          width: 380,
          height: 380,
          marginLeft: -190,
          marginTop: -190,
          background: 'radial-gradient(circle, rgba(255,107,77,0.10) 0%, rgba(255,107,77,0.04) 40%, transparent 70%)',
        }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.45 }}
      />
    </div>
  )
}
