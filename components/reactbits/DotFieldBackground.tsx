'use client'
import { ViewTransition } from 'react'
import { usePathname } from 'next/navigation'
import DotField from './DotField'
import { useTheme } from '@/lib/theme'

// Fondo propio de la sección IA (Sprint 3), ahora montado en el layout
// raíz junto a LightRaysBackground (Sprint 4) para que ambos vivan en la
// misma posición del árbol y la View Transitions API pueda emparejar su
// entrada/salida como un crossfade real al cambiar de ruta. El
// componente DotField solo trae la grilla de puntos + un glow que sigue
// al cursor — el resplandor ambiental estático (el que le da profundidad
// al fondo) es una capa aparte que se agrega aquí, con los mismos tokens
// de color que ya usa Flow+ (coral + el rosa de --color-danger) en
// vez del morado por defecto del componente. El glow tiene su propio
// <ViewTransition> con un fade más lento que el de los puntos — la idea
// del usuario de que "el resplandor se enciende lentamente" detrás del
// workspace en vez de aparecer de golpe con el resto del fondo.
export default function DotFieldBackground() {
  const { theme } = useTheme()
  const pathname = usePathname()
  if (theme === 'light' || pathname !== '/ai') return null // solo tiene sentido sobre fondo oscuro, y solo en /ai

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <ViewTransition name="bg-glow" enter="bg-glow-fade-in" exit="bg-glow-fade-out" default="none">
        <div
          aria-hidden
          className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full opacity-45 blur-[130px]"
          style={{
            background: 'radial-gradient(circle, rgba(255,107,77,0.6) 0%, rgba(255,84,112,0.3) 45%, transparent 72%)',
          }}
        />
      </ViewTransition>
      <ViewTransition name="bg-dots" enter="bg-fade-in" exit="bg-fade-out" default="none">
        <DotField
          dotRadius={1.3}
          dotSpacing={17}
          cursorRadius={420}
          bulgeStrength={48}
          glowRadius={210}
          gradientFrom="rgba(255, 107, 77, 0.38)"
          gradientTo="rgba(255, 84, 112, 0.2)"
          glowColor="#FF6B4D"
        />
      </ViewTransition>
    </div>
  )
}
