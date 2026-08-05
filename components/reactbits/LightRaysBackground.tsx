'use client'
import { ViewTransition } from 'react'
import { usePathname } from 'next/navigation'
import LightRays from './LightRays'
import { useTheme } from '@/lib/theme'

export default function LightRaysBackground() {
  const { theme } = useTheme()
  const pathname = usePathname()
  // La sección IA tiene su propio fondo (DotFieldBackground) para darle
  // identidad propia en vez de heredar el de Agenda — Sprint 3.
  if (theme === 'light' || pathname === '/ai') return null // los rayos de luz solo tienen sentido sobre fondo oscuro

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