'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

type Props = {
  onConfirmar: () => void
  etiqueta: string
  etiquetaConfirmar: string
  icono?: React.ReactNode
  disabled?: boolean
  className?: string
}

// Ventana en la que el botón queda "armado" esperando el segundo clic. Si
// no se confirma a tiempo, vuelve solo a su estado normal.
const VENTANA_CONFIRMACION_MS = 4000

// Sub-sprint 8.2 — confirmación de dos toques para acciones destructivas
// (Limpiar horario, Reemplazar horario al importar): el primer clic "arma"
// el botón (cambia a rojo con la etiqueta de confirmación), el segundo clic
// mientras está armado ejecuta la acción. Se eligió sobre un modal/diálogo
// nativo porque es una decisión de un solo paso sin campos que llenar — un
// modal sería ceremonia de más — pero sigue exigiendo una segunda acción
// deliberada, nunca un borrado de un solo clic. Compartido por las dos
// acciones destructivas de este sprint para que el usuario aprenda un solo
// patrón, no dos.
export default function BotonConfirmacion({ onConfirmar, etiqueta, etiquetaConfirmar, icono, disabled, className }: Props) {
  const [armado, setArmado] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function alHacerClic() {
    if (!armado) {
      setArmado(true)
      timeoutRef.current = setTimeout(() => setArmado(false), VENTANA_CONFIRMACION_MS)
      return
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setArmado(false)
    onConfirmar()
  }

  return (
    <motion.button
      type="button"
      onClick={alHacerClic}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.015 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      animate={armado ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${
        armado ? 'bg-danger text-ink' : 'bg-panel-glass backdrop-blur-md text-paper hover:bg-panel-2'
      } ${className ?? ''}`}
    >
      {icono}
      {/* Un pequeño "pop" (el scale de arriba) + crossfade del texto al
          armarse — la idea es que se sienta como que el botón reacciona a
          propósito, no que el texto simplemente cambió de golpe. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={armado ? 'confirmar' : 'normal'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
        >
          {armado ? etiquetaConfirmar : etiqueta}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
