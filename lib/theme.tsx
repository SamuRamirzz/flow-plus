'use client'
import { createContext, useContext, useEffect, useSyncExternalStore, ReactNode } from 'react'

type Theme = 'light' | 'dark'
type ThemeContextType = { theme: Theme; toggleTheme: () => void }

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const CLAVE = 'agenda-theme'
const POR_DEFECTO: Theme = 'dark'
// Evento propio: `storage` (nativo) solo se dispara en OTRAS pestañas, nunca
// en la que escribió. Sin este, el toggle no re-renderizaría su propia
// pestaña.
const EVENTO_CAMBIO = 'agenda-theme-cambio'

// Cierre de fase — antes esto era `useState` + un `useEffect` que leía
// localStorage y llamaba a setTheme: el último de los errores de
// react-hooks/set-state-in-effect que el proyecto arrastraba desde antes de
// los sprints de IA (`npm run lint` nunca había pasado limpio).
//
// localStorage ES un store externo, así que useSyncExternalStore es la
// herramienta correcta — mismo patrón que ya usa lib/ai/useDictado.ts para
// leer una capacidad del navegador sin desincronizar el render del servidor.
// Tres cosas se arreglan de una:
//   1. desaparece el setState-dentro-de-efecto (el error de lint);
//   2. no hay desajuste de hidratación: React usa getServerSnapshot para el
//      render que hidrata y recién después compara con getSnapshot, que es
//      exactamente el mecanismo para el que existe este hook;
//   3. el tema se sincroniza entre pestañas gratis (el listener de `storage`),
//      que la versión con useState no hacía.
function suscribir(alCambiar: () => void) {
  window.addEventListener(EVENTO_CAMBIO, alCambiar)
  window.addEventListener('storage', alCambiar)
  return () => {
    window.removeEventListener(EVENTO_CAMBIO, alCambiar)
    window.removeEventListener('storage', alCambiar)
  }
}

function leerTema(): Theme {
  const guardado = localStorage.getItem(CLAVE)
  return guardado === 'light' || guardado === 'dark' ? guardado : POR_DEFECTO
}

function leerTemaServidor(): Theme {
  return POR_DEFECTO
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(suscribir, leerTema, leerTemaServidor)

  // Sincronizar el DOM con el estado de React SÍ es para lo que existen los
  // efectos (actualizar un sistema externo), así que este se queda tal cual.
  // A diferencia de la versión anterior, ya no escribe en localStorage en
  // cada montaje: escribir es responsabilidad exclusiva de toggleTheme, así
  // que abrir la app sin haber elegido tema nunca persiste el default.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
  }, [theme])

  function toggleTheme() {
    localStorage.setItem(CLAVE, theme === 'dark' ? 'light' : 'dark')
    window.dispatchEvent(new Event(EVENTO_CAMBIO))
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return ctx
}
