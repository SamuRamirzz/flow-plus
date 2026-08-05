'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { FRAGMENTOS, PALETA_MATERIAS } from './datosDemo'

// El corazón de la landing: los mismos cuatro apuntes sueltos que flotan
// desordenados se acomodan solos en una semana ordenada, sin que nadie toque
// nada. Es literalmente lo que hace el producto, así que se muestra en vez de
// describirse.
//
// ───────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTA ANIMACIÓN NO SALE DE UN COMPONENTE DEL CATÁLOGO
// ───────────────────────────────────────────────────────────────────────────
// Se revisaron en vivo los candidatos obvios y ninguno servía para ESTO:
//   · Falling Text hace lo contrario (una frase ordenada se desarma con
//     física) y arrastra matter-js.
//   · Antigravity flota bonito pero necesita @react-three/fiber + three —
//     demasiado peso para la página que recibe el tráfico frío.
// El movimiento de caos→orden es una transición de LAYOUT, no un efecto: cada
// nota tiene que ser el MISMO nodo antes y después para que el ojo siga el
// recorrido. Eso es exactamente lo que resuelve `layout` de motion (que el
// proyecto ya usa en el overlay de /ai y en los puntos del onboarding), y
// ningún efecto de partículas puede hacerlo, porque en un sistema de
// partículas las notas serían nodos distintos y el usuario vería desaparecer
// unas y aparecer otras.

type Fase = 'caos' | 'orden'

const MS_ANTES_DE_ORDENAR = 2400
const EASE_ASENTAR = [0.16, 1, 0.3, 1] as const
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']

export default function HeroCaosOrden() {
  const [fase, setFase] = useState<Fase>('caos')
  const reducirMovimiento = useReducedMotion()

  useEffect(() => {
    if (reducirMovimiento) return
    const id = setTimeout(() => setFase('orden'), MS_ANTES_DE_ORDENAR)
    return () => clearTimeout(id)
  }, [reducirMovimiento])

  // Con movimiento reducido se muestra el estado final directamente. Se
  // DERIVA en el render en vez de hacer `setFase('orden')` dentro del efecto:
  // esa segunda forma es la que dispara `react-hooks/set-state-in-effect`
  // (renders en cascada), y además dejaría un primer frame con el caos que es
  // justo lo que alguien con esa preferencia activada pidió no ver.
  const ordenado = fase === 'orden' || reducirMovimiento === true

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] lg:aspect-[7/5] select-none">
      {/* La rejilla de la semana aparece por debajo justo cuando las notas se
          acomodan — el "sitio" al que llegan. */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: ordenado ? 1 : 0 }}
        transition={{ duration: 0.7, ease: EASE_ASENTAR }}
        className="absolute inset-0 grid grid-cols-5 gap-1.5 sm:gap-2"
      >
        {DIAS.map((d) => (
          <div key={d} className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted/70 mb-1.5 text-center">{d}</span>
            <div className="flex-1 rounded-2xl bg-panel-2/25" />
          </div>
        ))}
      </motion.div>

      {/* Las notas. `layout` hace todo el trabajo: el mismo nodo pasa de estar
          posicionado en absoluto y torcido, a ocupar su celda de la rejilla. */}
      <div className={ordenado ? 'absolute inset-0 grid grid-cols-5 gap-1.5 sm:gap-2 pt-6' : 'absolute inset-0'}>
        {ordenado
          ? DIAS.map((dia) => (
              <div key={dia} className="flex flex-col gap-1.5 px-0.5 pt-1">
                {FRAGMENTOS.filter((f) => f.dia === dia).map((f) => (
                  <NotaOrdenada key={f.id} fragmento={f} />
                ))}
              </div>
            ))
          : FRAGMENTOS.map((f) => <NotaCaotica key={f.id} fragmento={f} />)}
      </div>

      {/* El "+" de la marca como punto donde converge el orden. Entra cuando
          la rejilla ya está armada, no antes: es el remate, no el comienzo. */}
      <AnimatePresence>
        {ordenado && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.45, ease: EASE_ASENTAR }}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20">
              <motion.div
                className="absolute inset-0 rounded-full bg-coral"
                style={{ opacity: 0.14 }}
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <Sparkles className="text-coral" size={26} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Un apunte suelto: torcido, flotando, con el texto tal como se escribiría. */
function NotaCaotica({ fragmento }: { fragmento: (typeof FRAGMENTOS)[number] }) {
  return (
    <motion.div
      layoutId={fragmento.id}
      className="absolute max-w-[45%] sm:max-w-[42%] rounded-2xl bg-panel-glass backdrop-blur-md shadow-lg shadow-black/25 px-3 py-2.5"
      style={{ left: `${fragmento.x}%`, top: `${fragmento.y}%` }}
      initial={{ opacity: 0, scale: 0.85, rotate: fragmento.rot }}
      animate={{
        opacity: 1,
        scale: 1,
        rotate: fragmento.rot,
        // Deriva suave: las notas no están quietas, están sueltas.
        y: [0, -7, 0],
        x: [0, 4, 0],
      }}
      transition={{
        opacity: { duration: 0.5 },
        scale: { duration: 0.5, ease: EASE_ASENTAR },
        y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
        x: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      <motion.span layout="position" className="block font-mono text-[10px] sm:text-[11px] leading-snug text-muted">
        {fragmento.crudo}
      </motion.span>
    </motion.div>
  )
}

/** El mismo apunte, ya entendido: título limpio, chip de materia y prioridad. */
function NotaOrdenada({ fragmento }: { fragmento: (typeof FRAGMENTOS)[number] }) {
  const rgb = PALETA_MATERIAS[fragmento.color]

  return (
    <motion.div
      layoutId={fragmento.id}
      className="rounded-xl bg-panel-glass backdrop-blur-md shadow-lg shadow-black/20 px-2 py-2 overflow-hidden"
      style={{ rotate: 0 }}
      transition={{ type: 'spring', stiffness: 140, damping: 20 }}
    >
      <div className="flex items-center gap-1 mb-1">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: `rgb(${rgb})` }} />
        <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-wide truncate" style={{ color: `rgb(${rgb})` }}>
          {fragmento.materia}
        </span>
      </div>
      <motion.span
        layout="position"
        className="block text-[10px] sm:text-[11px] leading-snug text-paper font-medium"
      >
        {fragmento.titulo}
      </motion.span>
      {fragmento.prioridad === 'alta' && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-1.5 inline-block text-[8px] font-mono uppercase tracking-wide text-coral"
        >
          Prioridad alta
        </motion.span>
      )}
    </motion.div>
  )
}
