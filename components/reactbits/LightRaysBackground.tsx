'use client'
import { ViewTransition } from 'react'
import LightRays from './LightRays'
import { useTheme } from '@/lib/theme'

export default function LightRaysBackground() {
  const { theme } = useTheme()
  // Sprint Correcciones /ai — antes esto excluía `/ai`, porque esa ruta
  // tenía su propio DotFieldBackground. El Dot Field se movió DENTRO del
  // overlay inmersivo (que es donde tiene sentido un fondo animado, ver
  // AIImmersiveOverlay), así que la pantalla de entrada de /ai vuelve a
  // heredar el fondo del resto de la app en vez de quedarse sin ninguno.
  if (theme === 'light') return null // los rayos de luz solo tienen sentido sobre fondo oscuro

  return (
    <ViewTransition name="bg-rays" enter="bg-fade-in" exit="bg-fade-out" default="none">
      <div className="fixed inset-0 -z-10">
        <LightRays
          raysOrigin="top-center"
          raysColor="#FF6B4D"
          raysSpeed={1}
          lightSpread={0.7}
          rayLength={1.3}
          followMouse={true}
          mouseInfluence={0.08}
          noiseAmount={0.06}
          distortion={0.03}
        />
      </div>
    </ViewTransition>
  )
}