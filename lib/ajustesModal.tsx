'use client'
import { createContext, useCallback, useContext, useState, ReactNode } from 'react'

export type CategoriaAjustesId =
  | 'perfil'
  | 'apariencia'
  | 'fecha-hora'
  | 'notificaciones'
  | 'proximamente'
  | 'cerrar-sesion'

type AjustesModalContextType = {
  abierto: boolean
  categoriaInicial: CategoriaAjustesId
  abrir: (categoria?: CategoriaAjustesId) => void
  cerrar: () => void
}

const AjustesModalContext = createContext<AjustesModalContextType | undefined>(undefined)

// Ajustes dejó de ser una ruta (`/ajustes`) para ser un modal flotante, y
// eso trae un problema de árbol: quien lo ABRE (AppSidebar en desktop,
// NavDock en móvil) y quien lo RENDERIZA (AjustesModal) son hermanos
// montados por separado en app/layout.tsx — ninguno contiene al otro, así
// que no hay props que pasar. Mismo patrón exacto que lib/immersive.tsx ya
// resolvía para AIImmersiveOverlay: un contexto liviano en lib/, provisto
// una sola vez en el layout raíz.
//
// `categoriaInicial` existe para poder abrir el modal directo en una
// categoría concreta (`abrir('cerrar-sesion')`) sin que el llamador tenga
// que conocer el estado interno del modal. Hoy nadie lo usa con argumento
// —todos abren en Perfil— pero es el tipo de costura que evita tener que
// levantar estado después.
export function AjustesModalProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const [categoriaInicial, setCategoriaInicial] = useState<CategoriaAjustesId>('perfil')

  const abrir = useCallback((categoria: CategoriaAjustesId = 'perfil') => {
    setCategoriaInicial(categoria)
    setAbierto(true)
  }, [])

  const cerrar = useCallback(() => setAbierto(false), [])

  return (
    <AjustesModalContext.Provider value={{ abierto, categoriaInicial, abrir, cerrar }}>
      {children}
    </AjustesModalContext.Provider>
  )
}

export function useAjustesModal() {
  const ctx = useContext(AjustesModalContext)
  if (!ctx) throw new Error('useAjustesModal debe usarse dentro de <AjustesModalProvider>')
  return ctx
}
