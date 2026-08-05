'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { PALETA_MATERIAS } from './datosDemo'

// Mini-demo de la inferencia de fecha real (lib/horario/inferirFecha.ts):
// "Cálculo II es los lunes → la tarea sin fecha cae en el próximo lunes".
//
// Se anima en tres tiempos al entrar en pantalla, en vez de describirse:
//   1. Aparece la semana con la clase de Cálculo II marcada en el lunes.
//   2. Entra una tarea SIN fecha.
//   3. Sale un trazo desde la clase hasta la tarea y la fecha se rellena.

const EASE = [0.16, 1, 0.3, 1] as const
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const CORAL = PALETA_MATERIAS[0]

export default function MockupHorario() {
  const ref = useRef<HTMLDivElement>(null)
  const enPantalla = useInView(ref, { once: true, amount: 0.5 })
  const reducir = useReducedMotion()
  const [paso, setPaso] = useState(0)

  useEffect(() => {
    if (!enPantalla || reducir) return
    const t1 = setTimeout(() => setPaso(1), 500)
    const t2 = setTimeout(() => setPaso(2), 1400)
    const t3 = setTimeout(() => setPaso(3), 2300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [enPantalla, reducir])

  // Igual que en el hero: con movimiento reducido se salta al estado final
  // derivándolo en el render, no con un setState dentro del efecto (que es lo
  // que marca `react-hooks/set-state-in-effect`).
  const pasoActual = reducir ? 3 : paso

  return (
    <div ref={ref} className="w-full rounded-[24px] bg-panel-glass backdrop-blur-xl shadow-2xl shadow-black/25 p-4 sm:p-6">
      {/* La semana */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-5">
        {DIAS.map((d, i) => {
          const esLunes = i === 0
          return (
            <div key={d} className="flex flex-col gap-1.5">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted/70 text-center">{d}</span>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={enPantalla ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
                className="h-11 sm:h-14 rounded-xl flex items-center justify-center px-1"
                style={{
                  background: esLunes ? `rgba(${CORAL}, 0.16)` : 'var(--color-panel-2)',
                  opacity: esLunes ? 1 : 0.45,
                }}
              >
                {esLunes && (
                  <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-wide text-center leading-tight" style={{ color: `rgb(${CORAL})` }}>
                    Cálculo II
                  </span>
                )}
              </motion.div>
            </div>
          )
        })}
      </div>

      {/* La tarea, primero sin fecha y después con la fecha inferida */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={pasoActual >= 1 ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: EASE }}
        className="rounded-xl bg-panel-2/60 px-3.5 py-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: `rgb(${CORAL})` }} />
          <span className="text-[12px] sm:text-[13px] text-paper font-medium">Ejercicios de derivadas</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wide text-muted">Entrega:</span>

          {pasoActual < 3 ? (
            <motion.span
              key="sin-fecha"
              animate={pasoActual === 2 ? { opacity: [1, 0.35, 1] } : {}}
              transition={{ duration: 0.9, repeat: pasoActual === 2 ? Infinity : 0 }}
              className="text-[10px] font-mono text-muted/60"
            >
              — sin fecha —
            </motion.span>
          ) : (
            <motion.span
              key="con-fecha"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              className="rounded-full px-2.5 py-1 text-[10px] font-mono"
              style={{ background: `rgba(${CORAL}, 0.16)`, color: `rgb(${CORAL})` }}
            >
              Lunes 4
            </motion.span>
          )}
        </div>

        {/* El motivo real que devuelve inferirFechaEntrega() y que la app
            muestra bajo el campo de fecha. */}
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={pasoActual >= 3 ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.25, ease: EASE }}
          className="mt-2 text-[9px] sm:text-[10px] font-mono text-coral/80"
        >
          Cálculo II se dicta los lunes
        </motion.p>
      </motion.div>
    </div>
  )
}
