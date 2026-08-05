'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Paperclip, Mic, ArrowUp, Undo2, Check } from 'lucide-react'
import { FRAGMENTOS, PALETA_MATERIAS } from './datosDemo'

// Recreación fiel de la pantalla /ai real: el composer con adjunto y voz
// (AdjuntoBoton / DictadoBoton), la burbuja del turno del usuario, y el panel
// de operaciones con Deshacer. No es una ilustración genérica — cada elemento
// existe de verdad en el producto, con los mismos datos que el hero.
//
// Se recrea en JSX en vez de pegar una captura por dos motivos: una imagen
// quedaría congelada en un tema (los tokens de globals.css cambian en claro) y
// se vería borrosa en pantallas densas.

const EASE = [0.16, 1, 0.3, 1] as const

export default function MockupAI() {
  const reducir = useReducedMotion()
  const escrito = FRAGMENTOS[0]!.crudo + ', y el lunes entrego el ensayo'

  return (
    <div className="w-full rounded-[24px] bg-panel-glass backdrop-blur-xl shadow-2xl shadow-black/25 p-4 sm:p-5">
      {/* Turno del usuario */}
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-panel-2/80 px-3.5 py-2.5">
          <p className="text-[12px] sm:text-[13px] text-paper leading-relaxed">{escrito}</p>
        </div>
      </div>

      {/* Lo que entendió */}
      <div className="mb-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-coral mb-2">Lo que entendí</p>
        <div className="flex flex-col gap-1.5">
          {FRAGMENTOS.slice(0, 2).map((f, i) => {
            const rgb = PALETA_MATERIAS[f.color]
            return (
              <motion.div
                key={f.id}
                initial={reducir ? false : { opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.12, ease: EASE }}
                className="flex items-center gap-2.5 rounded-xl bg-panel-2/50 px-3 py-2"
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: `rgb(${rgb})` }} />
                <span className="text-[11px] sm:text-[12px] text-paper truncate flex-1">{f.titulo}</span>
                <span className="text-[9px] font-mono uppercase tracking-wide text-muted flex-shrink-0">{f.materia}</span>
                <span className="text-[9px] font-mono text-muted flex-shrink-0 hidden sm:inline">{f.dia}</span>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Aplicado + Deshacer — es la función real del Sprint 7.2 */}
      <motion.div
        initial={reducir ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, delay: 0.55 }}
        className="flex items-center justify-between rounded-xl bg-success/8 px-3 py-2 mb-3.5"
      >
        <span className="flex items-center gap-1.5 text-[11px] text-success">
          <Check size={13} />2 tareas creadas
        </span>
        <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-muted">
          <Undo2 size={11} />
          Deshacer
        </span>
      </motion.div>

      {/* Composer: adjunto, voz, enviar — los tres botones reales */}
      <div className="flex items-center gap-2 rounded-full bg-panel-2/70 pl-3.5 pr-1.5 py-1.5">
        <span className="flex-1 text-[11px] sm:text-[12px] text-muted/60 truncate">Cuéntame qué tienes pendiente…</span>
        <Paperclip size={15} className="text-muted flex-shrink-0" />
        <Mic size={15} className="text-muted flex-shrink-0" />
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-coral flex-shrink-0">
          <ArrowUp size={14} className="text-white" />
        </span>
      </div>
    </div>
  )
}
