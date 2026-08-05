'use client'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { apiPatch } from '@/lib/api/cliente'
import { useToast } from '@/lib/toast'
import { ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import type { FormatoReloj } from '@/lib/hora'

export type Preferencias = { zonaHoraria: string; formatoReloj: FormatoReloj }

type PreferenciasContextType = Preferencias & {
  actualizar: (cambios: Partial<Preferencias>) => void
}

const PreferenciasContext = createContext<PreferenciasContextType | undefined>(undefined)

const POR_DEFECTO: Preferencias = { zonaHoraria: ZONA_HORARIA_POR_DEFECTO, formatoReloj: '24h' }

// Sección Ajustes — mismo espíritu que ThemeProvider (lib/theme.tsx), pero
// respaldado por perfil_academico (la base) en vez de localStorage: esto es
// una preferencia que debe seguir al usuario entre dispositivos, no al
// navegador.
//
// A diferencia del tema (100% local, instantáneo), `actualizar()` implica
// un roundtrip HTTP — así que el estado se mueve OPTIMISTA (de inmediato,
// antes de que el PATCH confirme) y se revierte + avisa por toast solo si
// el servidor rechaza el cambio. Sin esto, el SegmentedToggle de
// Apariencia/Fecha y hora se sentiría con lag notorio comparado con el
// toggle de tema, que sí es instantáneo de verdad.
//
// `inicial` se carga SERVER-SIDE en app/layout.tsx (mismo momento y mismo
// criterio que ya usa `haySesion` para AppSidebar/NavDock) — evita un
// fetch de cliente extra y el parpadeo de "24h"/zona por defecto mientras
// carga. Sin sesión, `inicial` es `null` y se usan los defaults: inofensivo,
// ninguna página pública muestra una hora con preferencia de usuario.
export function PreferenciasProvider({ inicial, children }: { inicial: Preferencias | null; children: ReactNode }) {
  const [preferencias, setPreferencias] = useState<Preferencias>(inicial ?? POR_DEFECTO)
  const { notify } = useToast()

  function actualizar(cambios: Partial<Preferencias>) {
    const anteriores = preferencias
    setPreferencias((actuales) => ({ ...actuales, ...cambios }))

    void apiPatch<{ zonaHoraria: string; formatoReloj: FormatoReloj }>('/api/perfil', cambios).then((resultado) => {
      if (!resultado.ok) {
        setPreferencias(anteriores)
        notify('No se pudo guardar el cambio — se deshizo', false)
      }
    })
  }

  return <PreferenciasContext.Provider value={{ ...preferencias, actualizar }}>{children}</PreferenciasContext.Provider>
}

export function usePreferencias() {
  const ctx = useContext(PreferenciasContext)
  if (!ctx) throw new Error('usePreferencias debe usarse dentro de PreferenciasProvider')
  return ctx
}
