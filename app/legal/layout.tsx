'use client'

import { useEffect } from 'react'

// Envoltorio compartido de /legal/privacidad y /legal/terminos. `'use client'`
// solo por el useEffect de abajo — cada página sigue siendo Server Component
// y exporta su propio `metadata` (un layout cliente no puede hacerlo).
//
// `scroll-smooth` se activa en <html> SOLO mientras una página legal está
// montada (y se retira al salir) en vez de agregarlo a globals.css: el
// índice de esta página necesita scroll suave al hacer clic en un enlace de
// ancla, pero no hay motivo para cambiar el comportamiento de scroll del
// resto de la app, que nunca lo pidió.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('scroll-smooth')
    return () => document.documentElement.classList.remove('scroll-smooth')
  }, [])

  return (
    <main className="relative z-10 min-h-screen px-5 sm:px-8 lg:px-12 pt-6 pb-24">
      <div className="max-w-6xl mx-auto">{children}</div>
    </main>
  )
}
