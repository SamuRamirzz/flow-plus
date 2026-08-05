'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserRound, ListChecks, BookOpen } from 'lucide-react'
import { esInvitado } from '@/lib/invitado/estado'
import { RUTA_AGENDA } from '@/lib/rutas'

// AppSidebar/NavDock no se montan sin sesión (gate server-side en
// app/layout.tsx, sin tocar) — un invitado no tiene forma de navegar entre
// Agenda y Horario ni de saber que sus datos son locales. Este banner
// cubre las dos cosas: mini-navegación + aviso + CTA de registro. Se monta
// DENTRO de AgendaHome.tsx y app/horario/page.tsx (no en layout.tsx), así
// no toca el gate de navegación que depende de la sesión server-side.
//
// `esInvitado()` es async (ver lib/invitado/estado.ts) — se resuelve una
// vez al montar, mismo patrón `activo` que ya usa el resto del proyecto
// para no disparar el lint de setState-en-efecto con un resultado obsoleto.
export default function BannerInvitado() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let activo = true
    esInvitado().then((esInv) => {
      if (activo) setVisible(esInv)
    })
    return () => {
      activo = false
    }
  }, [])

  if (!visible) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-coral/10 px-4 py-3 mb-6 text-xs">
      <span className="flex items-center gap-2 text-paper">
        <UserRound size={14} className="text-coral flex-shrink-0" />
        Modo invitado — tus datos quedan en este dispositivo
      </span>
      <div className="flex items-center gap-1.5">
        <Link
          href={RUTA_AGENDA}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${
            pathname === RUTA_AGENDA ? 'bg-panel-glass text-paper' : 'text-muted hover:text-paper'
          }`}
        >
          <ListChecks size={13} />
          Agenda
        </Link>
        <Link
          href="/horario"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${
            pathname === '/horario' ? 'bg-panel-glass text-paper' : 'text-muted hover:text-paper'
          }`}
        >
          <BookOpen size={13} />
          Horario
        </Link>
        <Link href="/login" className="px-3 py-1.5 rounded-full bg-coral text-ink font-semibold hover:opacity-90 transition">
          Regístrate para guardar tus datos
        </Link>
      </div>
    </div>
  )
}
