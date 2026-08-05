'use client'

import { Mic, MicOff } from 'lucide-react'
import { motion } from 'motion/react'
import { useDictado } from '@/lib/ai/useDictado'

type Props = {
  /** Texto actual del textarea — se usa como base al empezar a dictar,
   *  para no reemplazar lo que el usuario ya había escrito a mano. */
  textoActual: string
  onTranscripcion: (textoCompleto: string) => void
  deshabilitado?: boolean
}

// Sub-sprint 7.4 — botón de dictado por voz, mismo lenguaje visual y
// tamaño que AdjuntoBoton (w-8 h-8, círculo, mismos colores) para que
// convivan en la misma fila del composer sin desentonar.
export default function DictadoBoton({ textoActual, onTranscripcion, deshabilitado }: Props) {
  const { soportado, estado, alternar } = useDictado(onTranscripcion)

  // Degradación con gracia: sin soporte (Firefox, Safari en varias
  // versiones), el botón ni se monta — nada de ícono deshabilitado ni
  // mensaje de error confuso ocupando espacio para algo que nunca va a
  // funcionar ahí.
  if (!soportado) return null

  const escuchando = estado === 'escuchando'
  const error = estado === 'error'

  return (
    <button
      type="button"
      onClick={() => alternar(textoActual)}
      disabled={deshabilitado}
      title={error ? 'No se pudo escuchar — probá de nuevo' : escuchando ? 'Detener dictado' : 'Dictar por voz'}
      className={`relative w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed ${
        error ? 'text-danger' : escuchando ? 'text-coral' : 'text-muted hover:text-paper hover:bg-panel-2/70'
      }`}
    >
      {/* Pulso sutil mientras escucha — única señal de "sí te estoy
          oyendo" además del texto llenándose solo, útil en el instante
          antes de que llegue el primer resultado interino. */}
      {escuchando && (
        <motion.span
          className="absolute inset-0 rounded-full bg-coral/20"
          animate={{ scale: [1, 1.4, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {error ? <MicOff size={15} className="relative" /> : <Mic size={15} className="relative" />}
    </button>
  )
}
