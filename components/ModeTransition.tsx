'use client'
import { ViewTransition, type ReactNode } from 'react'

// Envuelve {children} del layout raíz en un único <ViewTransition> con
// nombre estable ("app-mode") — como es el MISMO nodo en el árbol para
// cualquier ruta, React puede emparejar el estado viejo/nuevo entre
// Agenda y /ai como una sola transición de "modo", no como un fade
// genérico de página. Las animaciones reales (mode-agenda-recede,
// mode-ai-arrive, etc.) viven en globals.css como keyframes de
// ::view-transition-old()/::view-transition-new(); aquí solo se decide
// qué clase le corresponde a cada dirección de navegación.
export default function ModeTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      name="app-mode"
      enter={{ 'to-ai': 'to-ai', 'to-agenda': 'to-agenda', default: 'none' }}
      exit={{ 'to-ai': 'to-ai', 'to-agenda': 'to-agenda', default: 'none' }}
      default="none"
    >
      {children}
    </ViewTransition>
  )
}
