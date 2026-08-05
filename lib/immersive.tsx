'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

type ImmersiveContextType = { activo: boolean; setActivo: (v: boolean) => void }
const ImmersiveContext = createContext<ImmersiveContextType | undefined>(undefined)

// Contexto mínimo para que AIImmersiveOverlay (montado dentro de /ai)
// pueda avisarle a AppSidebar/NavDock (montados en app/layout.tsx, fuera
// de su árbol) que se oculten mientras el overlay está activo — mismo
// patrón que ThemeProvider/ToastProvider: un contexto liviano en lib/,
// provisto una sola vez en el layout raíz.
export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [activo, setActivo] = useState(false)
  return <ImmersiveContext.Provider value={{ activo, setActivo }}>{children}</ImmersiveContext.Provider>
}

export function useImmersive() {
  const ctx = useContext(ImmersiveContext)
  if (!ctx) throw new Error('useImmersive debe usarse dentro de <ImmersiveProvider>')
  return ctx
}
