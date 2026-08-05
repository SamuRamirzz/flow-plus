'use client'
import { Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import SegmentedToggle from '@/components/ui/SegmentedToggle'

// Expone el useTheme() ya existente (lib/theme.tsx) — ya sano, sin el bug
// de persistir el default en cada montaje que se mencionaba como posible;
// esta categoría no le agrega ni le corrige nada, solo le da una interfaz.
export default function CategoriaApariencia() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-paper flex items-center gap-2">
          <Sun size={16} className="text-coral" />
          Apariencia
        </h2>
        <p className="text-muted text-xs mt-1">Cómo se ve Flow+ en este dispositivo.</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
        <div>
          <p className="text-sm text-paper font-medium">Tema</p>
          <p className="text-muted text-xs mt-0.5">Oscuro es el más cuidado visualmente.</p>
        </div>
        <SegmentedToggle
          options={[
            { value: 'dark', label: 'Oscuro' },
            { value: 'light', label: 'Claro' },
          ]}
          value={theme}
          onChange={(v) => {
            if (v !== theme) toggleTheme()
          }}
        />
      </div>
    </div>
  )
}
