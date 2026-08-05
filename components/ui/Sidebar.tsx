'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { RUTA_APP } from '@/lib/rutas'

export type SidebarLinkData = { label: string; href: string; icon: ReactNode }

type SidebarContextProps = { open: boolean; setOpen: (o: boolean) => void }
const SidebarContext = createContext<SidebarContextProps | undefined>(undefined)

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar debe usarse dentro de <Sidebar>')
  return ctx
}

// Adaptado del componente "Sidebar" de Aceternity UI (patrón libre:
// SidebarProvider/Sidebar/SidebarBody/SidebarLink, expande en hover).
// Diferencia a propósito: en vez de pegarse al borde de la pantalla a toda
// altura, aquí flota como una isla vertical centrada, redondeada por todos
// los costados.
export function Sidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>
}

export function SidebarBody({ children, oculto = false }: { children: ReactNode; oculto?: boolean }) {
  const { open, setOpen } = useSidebar()
  return (
    <motion.div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      animate={{ width: open ? 208 : 64, opacity: oculto ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{ pointerEvents: oculto ? 'none' : 'auto' }}
      className="hidden lg:flex flex-col gap-1 fixed left-4 top-1/2 -translate-y-1/2 z-40 bg-panel-glass backdrop-blur-xl border border-line rounded-[28px] p-3 shadow-2xl overflow-hidden"
    >
      {children}
    </motion.div>
  )
}

// Etiqueta que se pliega/despliega con el hover del sidebar. La comparten
// SidebarLink y SidebarButton para que un ítem que navega y uno que abre
// algo se vean y se animen exactamente igual.
function EtiquetaSidebar({ children }: { children: ReactNode }) {
  const { open } = useSidebar()
  return (
    <AnimatePresence>
      {open && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.15 }}
          className="text-xs font-medium whitespace-nowrap overflow-hidden"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

const CLASES_ITEM = 'flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition'
const CLASES_ITEM_INACTIVO = 'text-muted hover:text-paper hover:bg-panel-2'

// Hermano de SidebarLink para ítems que NO navegan: mismo aspecto y misma
// animación, pero un <button> con onClick. Existe desde que Ajustes pasó a
// ser un modal — antes SesionSidebar tenía que reimplementar estas mismas
// clases a mano para su botón de salir.
export function SidebarButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`${CLASES_ITEM} w-full cursor-pointer ${active ? 'bg-coral text-ink' : CLASES_ITEM_INACTIVO}`}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>
      <EtiquetaSidebar>{label}</EtiquetaSidebar>
    </button>
  )
}

export function SidebarLink({ link, active }: { link: SidebarLinkData; active?: boolean }) {
  // Etiqueta la navegación Agenda ⇄ IA para que ModeTransition
  // (app/layout.tsx) sepa qué animación de <ViewTransition> le toca a
  // cada dirección — ver .to-ai/.to-agenda en globals.css.
  const transitionTypes = link.href === '/ai' ? ['to-ai'] : link.href === RUTA_APP ? ['to-agenda'] : undefined
  return (
    <Link
      href={link.href}
      transitionTypes={transitionTypes}
      className={`${CLASES_ITEM} ${active ? 'bg-coral text-ink' : CLASES_ITEM_INACTIVO}`}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{link.icon}</span>
      <EtiquetaSidebar>{link.label}</EtiquetaSidebar>
    </Link>
  )
}
