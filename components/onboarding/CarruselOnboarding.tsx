'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'motion/react'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { PASOS } from './pasos'
import { estadoInicial, siguiente, anterior, irA, esUltimo, esPrimero, pasoPorSwipe, type EstadoCarrusel } from '@/lib/onboarding/navegacion'

type Props = {
  /** Terminar o saltar: los dos marcan el onboarding como completado (ver
   *  el comentario junto al botón "Saltar"). El padre decide qué hacer. */
  onTerminar: () => void
  /** True mientras el PATCH está en vuelo — evita doble envío. */
  guardando: boolean
}

const EASE_ASENTAR = [0.16, 1, 0.3, 1] as const

// El paso entra desde el lado al que se dirige el movimiento y sale por el
// contrario. `custom` lleva la dirección (1 adelante, -1 atrás) para que
// retroceder no se sienta igual que avanzar.
const panelVariants: Variants = {
  entra: (dir: number) => ({ x: dir * 56, opacity: 0, filter: 'blur(10px)' }),
  centro: { x: 0, opacity: 1, filter: 'blur(0px)', transition: { duration: 0.5, ease: EASE_ASENTAR, staggerChildren: 0.09, delayChildren: 0.08 } },
  sale: (dir: number) => ({ x: dir * -56, opacity: 0, filter: 'blur(10px)', transition: { duration: 0.28, ease: 'easeIn' } }),
}

// Los hijos heredan el stagger del panel: ilustración primero, después
// etiqueta, título y descripción. Es lo que hace que cada pantalla se
// "arme" en vez de aparecer de golpe.
const hijoVariants: Variants = {
  entra: { opacity: 0, y: 14, filter: 'blur(6px)' },
  centro: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: EASE_ASENTAR } },
  sale: { opacity: 0, transition: { duration: 0.2 } },
}

export default function CarruselOnboarding({ onTerminar, guardando }: Props) {
  const [estado, setEstado] = useState<EstadoCarrusel>(estadoInicial)
  const total = PASOS.length
  const paso = PASOS[estado.paso]!
  const ultimo = esUltimo(estado, total)
  const reducirMovimiento = useReducedMotion()

  const avanzar = useCallback(() => {
    setEstado((e) => (esUltimo(e, total) ? e : siguiente(e, total)))
  }, [total])

  const retroceder = useCallback(() => {
    setEstado((e) => anterior(e, total))
  }, [total])

  // Teclado: gratis para quien navega sin ratón, y de paso hace el carrusel
  // usable en desktop sin tener que apuntarle a un botón chico.
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') avanzar()
      else if (e.key === 'ArrowLeft') retroceder()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [avanzar, retroceder])

  const Ilustracion = paso.Ilustracion

  return (
    <div className="w-full max-w-lg flex flex-col items-center">
      {/* Marca + salir. "Saltar" está desde el primer paso, nunca escondido:
          el encargo lo pedía explícito, y es la diferencia entre un
          onboarding y un peaje. Saltar CUENTA COMO COMPLETADO a propósito —
          volver a mostrarlo a quien ya dijo que no quiere verlo sería
          insistir, y el usuario que lo saltó ya sabe dónde está todo. */}
      <div className="w-full flex items-center justify-between mb-7">
        {/* El wordmark va DENTRO de un solo <span>, no suelto junto al icono:
            el contenedor es flex con `gap`, y un texto suelto más un <span>
            son dos hijos flex, así que el gap se metía entre "Flow" y "+" y
            se leía "Flow +". Encontrado midiendo el DOM real, no a ojo. */}
        <span className="inline-flex items-center gap-1.5 text-sm font-display font-semibold tracking-tight text-paper">
          <Sparkles size={14} className="text-coral" />
          <span>
            Flow<span className="text-coral">+</span>
          </span>
        </span>
        <button
          onClick={onTerminar}
          disabled={guardando}
          className="text-muted hover:text-paper transition-colors text-xs font-mono uppercase tracking-wide cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Saltar
        </button>
      </div>

      <div className="w-full rounded-[28px] bg-panel-glass backdrop-blur-xl shadow-2xl shadow-black/20 px-7 pt-8 pb-7 overflow-hidden">
        <motion.div
          drag={reducirMovimiento ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.16}
          onDragEnd={(_, info) => {
            const delta = pasoPorSwipe(info.offset.x, info.velocity.x)
            if (delta === 1) avanzar()
            else if (delta === -1) retroceder()
          }}
          className="cursor-grab active:cursor-grabbing"
        >
          <AnimatePresence mode="wait" custom={estado.direccion} initial={false}>
            <motion.div
              key={paso.id}
              custom={estado.direccion}
              variants={panelVariants}
              initial="entra"
              animate="centro"
              exit="sale"
              className="flex flex-col items-center text-center"
            >
              {/* Altura fija: sin esto, la fila de puntos y los botones
                  saltarían de sitio entre un paso y otro según lo alto que
                  quede el texto. */}
              <motion.div variants={hijoVariants} className="w-full flex justify-center">
                {/* `key` propia por paso: fuerza a la ilustración a
                    remontarse, que es lo que dispara su animación de
                    dibujado cada vez que se llega al paso. */}
                <Ilustracion key={paso.id} className="w-[230px] h-[160px] pointer-events-none select-none" />
              </motion.div>

              <motion.span variants={hijoVariants} className="mt-5 text-[10px] font-mono uppercase tracking-[0.18em] text-coral">
                {paso.etiqueta}
              </motion.span>

              <motion.h2
                variants={hijoVariants}
                className="mt-2.5 font-display text-[25px] sm:text-[28px] font-semibold text-paper tracking-tight leading-[1.15] text-balance"
              >
                {paso.titulo}
              </motion.h2>

              <motion.p variants={hijoVariants} className="mt-3 text-muted text-sm leading-relaxed max-w-[27rem] min-h-[5.5rem]">
                {paso.descripcion}
              </motion.p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            onClick={retroceder}
            disabled={esPrimero(estado)}
            aria-label="Paso anterior"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-panel-2/70 text-paper transition hover:bg-panel-2 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
          >
            <ArrowLeft size={17} />
          </button>

          <div className="flex items-center gap-2" role="tablist" aria-label="Pasos de la bienvenida">
            {PASOS.map((p, i) => {
              const activo = i === estado.paso
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={activo}
                  aria-label={`Paso ${i + 1} de ${total}: ${p.titulo}`}
                  onClick={() => setEstado((e) => irA(e, i, total))}
                  className="py-2 cursor-pointer group"
                >
                  {/* El punto activo se estira en cápsula en vez de solo
                      cambiar de color — se lee de un vistazo dónde estás,
                      incluso de reojo. `layout` hace que el cambio de ancho
                      se anime solo. */}
                  <motion.span
                    layout
                    transition={{ duration: 0.4, ease: EASE_ASENTAR }}
                    className={`block h-1.5 rounded-full transition-colors ${
                      activo ? 'w-6 bg-coral' : 'w-1.5 bg-paper/25 group-hover:bg-paper/45'
                    }`}
                  />
                </button>
              )
            })}
          </div>

          {ultimo ? (
            <motion.button
              onClick={onTerminar}
              disabled={guardando}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: EASE_ASENTAR }}
              whileHover={{ scale: guardando ? 1 : 1.03 }}
              whileTap={{ scale: guardando ? 1 : 0.97 }}
              className="flex items-center gap-1.5 rounded-full bg-coral text-white px-5 h-10 text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {guardando ? 'Entrando…' : 'Comenzar'}
              {!guardando && <ArrowRight size={16} />}
            </motion.button>
          ) : (
            <button
              onClick={avanzar}
              aria-label="Siguiente paso"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-panel-2/70 text-paper transition hover:bg-panel-2 cursor-pointer"
            >
              <ArrowRight size={17} />
            </button>
          )}
        </div>
      </div>

      <p className="text-muted/60 text-[11px] text-center mt-5 leading-relaxed">
        Puedes deslizar o usar las flechas del teclado.
      </p>
    </div>
  )
}
