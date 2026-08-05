'use client'
import { usePathname } from 'next/navigation'
import { Sidebar, SidebarBody, SidebarLink, SidebarButton } from './ui/Sidebar'
import { useImmersive } from '@/lib/immersive'
import { useAjustesModal } from '@/lib/ajustesModal'
import { esRutaDeEntrada, RUTA_APP, RUTA_AGENDA } from '@/lib/rutas'
import { LayoutGrid, ListChecks, Sparkles, BookOpen, Settings } from 'lucide-react'

// Solo secciones REALES — cada entrada navega a una pantalla que existe.
//
// "Calendario" y "Pendientes" vivían acá como `href="#"` desde que se armó
// la navegación y nunca se construyeron: un ítem que no lleva a ningún lado
// es ruido, no una promesa. Las dos siguen listadas como funcionalidad en
// camino dentro de Ajustes → Próximamente (lib/ajustes/proximamente.ts),
// que es donde corresponde anunciarlas.
//
// "Inicio" y "Agenda" usan íconos deliberadamente distintos (LayoutGrid,
// dashboard vs ListChecks, lista de tareas) para que no compartan silueta —
// son dos secciones separadas desde la corrección de alcance del Sprint Home.
const LINKS = [
  { label: 'Inicio', href: RUTA_APP, icon: <LayoutGrid size={18} /> },
  { label: 'Agenda', href: RUTA_AGENDA, icon: <ListChecks size={18} /> },
  { label: 'IA', href: '/ai', icon: <Sparkles size={18} /> },
  { label: 'Horario', href: '/horario', icon: <BookOpen size={18} /> },
]

export default function AppSidebar() {
  const pathname = usePathname()
  const { activo } = useImmersive()
  const { abrir } = useAjustesModal()

  // Sprint Auth — en las pantallas de entrada no hay a dónde navegar: sin
  // sesión, cada link rebotaría al login por el proxy. Mostrar una barra de
  // navegación que solo devuelve al mismo sitio es ruido, no una ayuda.
  // (Sprint Onboarding: /bienvenida se sumó a esa lista, ver lib/rutas.ts.)
  if (esRutaDeEntrada(pathname)) return null

  return (
    <Sidebar>
      <SidebarBody oculto={activo}>
        {LINKS.map((link) => (
          <SidebarLink key={link.label} link={link} active={link.href === pathname} />
        ))}
        {/* Ajustes no navega: abre el modal encima de donde estés. Por eso
            es un SidebarButton y no un SidebarLink — se ve igual, pero no
            cambia de ruta ni marca estado "activo" (no hay ruta que
            corresponda). Ahí adentro está también quién tiene la sesión
            iniciada y el cerrar sesión, que antes ocupaban su propio
            espacio en esta barra. */}
        <SidebarButton icon={<Settings size={18} />} label="Ajustes" onClick={() => abrir()} />
      </SidebarBody>
    </Sidebar>
  )
}
