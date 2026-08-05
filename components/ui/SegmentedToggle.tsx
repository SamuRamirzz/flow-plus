'use client'
import { motion } from 'motion/react'

type Option = { value: string; label: string }
type Props = { options: Option[]; value: string; onChange: (v: string) => void }

// Switch tipo iOS: la píldora activa se desliza entre opciones usando
// layoutId de Motion, así nunca "salta" — siempre anima desde su posición
// anterior hasta la nueva.
export default function SegmentedToggle({ options, value, onChange }: Props) {
  return (
    <div className="inline-flex bg-panel-2 border border-line rounded-full p-1 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="relative px-3.5 py-1.5 text-[11px] font-medium rounded-full transition-colors"
        >
          {value === o.value && (
            <motion.span
              layoutId="segmented-toggle-pill"
              className="absolute inset-0 bg-coral rounded-full"
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            />
          )}
          <span className={`relative font-display transition-colors ${value === o.value ? 'text-ink' : 'text-muted'}`}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  )
}
