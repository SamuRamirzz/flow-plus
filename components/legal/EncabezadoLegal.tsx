'use client'

import Link from 'next/link'
import { Sparkles, ArrowLeft } from 'lucide-react'

// Wordmark propio, no importado de components/landing/Landing.tsx: esa
// función no está exportada (es interna al archivo de la landing), y
// tocar ese archivo para exportarla está fuera del alcance de este sprint.
// Mismo aspecto exacto (ícono + "Flow" + "+" en coral).
function Wordmark() {
  return (
    <span className="inline-flex items-center gap-1.5 font-display font-semibold tracking-tight text-paper text-sm">
      <Sparkles size={14} className="text-coral" />
      <span>
        Flow<span className="text-coral">+</span>
      </span>
    </span>
  )
}

export default function EncabezadoLegal({ activo }: { activo: 'privacidad' | 'terminos' }) {
  return (
    <nav className="relative flex items-center justify-between gap-4 pr-14 mb-12 sm:mb-16">
      <Link href="/" className="flex items-center gap-3 group">
        <ArrowLeft size={16} className="text-muted transition group-hover:text-paper group-hover:-translate-x-0.5" />
        <Wordmark />
      </Link>
      <div className="flex items-center gap-1 rounded-full bg-panel-2/70 backdrop-blur-md p-1 text-xs font-medium">
        <Link
          href="/legal/privacidad"
          className={`rounded-full px-3 py-1.5 transition ${activo === 'privacidad' ? 'bg-coral text-ink' : 'text-muted hover:text-paper'}`}
        >
          Privacidad
        </Link>
        <Link
          href="/legal/terminos"
          className={`rounded-full px-3 py-1.5 transition ${activo === 'terminos' ? 'bg-coral text-ink' : 'text-muted hover:text-paper'}`}
        >
          Términos
        </Link>
      </div>
    </nav>
  )
}
