'use client'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import Dock from './reactbits/Dock'
import { useImmersive } from '@/lib/immersive'
import { useAjustesModal } from '@/lib/ajustesModal'
import { esRutaDeEntrada, RUTA_APP, RUTA_AGENDA, RUTA_ARCHIVOS } from '@/lib/rutas'
import { LayoutGrid, ListChecks, Sparkles, BookOpen, FolderOpen, Settings } from 'lucide-react'

// El Dock ahora es solo para móvil (lg:hidden) — en pantallas grandes,
// la navegación la cubre el AppSidebar flotante de la izquierda.
export default function NavDock() {
  const pathname = usePathname()
  const router = useRouter()
  const { activo } = useImmersive()
  const { abrir } = useAjustesModal()

  // Sprint Auth — mismo criterio que AppSidebar: en las pantallas de entrada
  // no hay a dónde navegar. Es el equivalente móvil de esa misma decisión.
  const enEntrada = esRutaDeEntrada(pathname)

  const items = [
    {
      icon: <LayoutGrid size={18} />,
      label: 'Inicio',
      // Si ya estás en Agenda, sube al inicio de la página; si estás en
      // otra ruta (ej. /ai), navega — "Inicio" debe llevarte a casa de
      // verdad, no solo desplazar la página en la que ya estás.
      // "Casa" es RUTA_APP desde la reorganización: `/` pasó a ser la landing
      // pública, así que mandar ahí al usuario con sesión lo sacaría de la app.
      onClick: () =>
        pathname === RUTA_APP
          ? window.scrollTo({ top: 0, behavior: 'smooth' })
          : router.push(RUTA_APP, { transitionTypes: ['to-agenda'] }),
    },
    {
      icon: <ListChecks size={18} />,
      label: 'Agenda',
      onClick: () => router.push(RUTA_AGENDA),
    },
    {
      icon: <Sparkles size={18} />,
      label: 'IA',
      onClick: () => router.push('/ai', { transitionTypes: ['to-ai'] }),
    },
    {
      icon: <BookOpen size={18} />,
      label: 'Horario',
      onClick: () => router.push('/horario'),
    },
    {
      // Sprint Archivos — el dock y el sidebar se mantienen con las MISMAS
      // entradas (ahora 6): una sección que solo existe en desktop sería
      // invisible para quien use la app desde el teléfono, que es el caso
      // más común de "subir una foto de un enunciado".
      icon: <FolderOpen size={18} />,
      label: 'Archivos',
      onClick: () => router.push(RUTA_ARCHIVOS),
    },
    {
      // Mismo ícono que en AppSidebar — antes este ítem usaba `User`
      // mientras el sidebar usaba `Settings` para exactamente lo mismo.
      // Y ya no navega: abre el modal, igual que en desktop.
      icon: <Settings size={18} />,
      label: 'Ajustes',
      onClick: () => abrir(),
    },
  ]

  if (enEntrada) return null

  return (
    <motion.div
      animate={{ opacity: activo ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
    >
      <div className={activo ? 'pointer-events-none' : 'pointer-events-auto'}>
        <Dock items={items} panelHeight={64} baseItemSize={46} magnification={64} className="dock-glass" />
      </div>
    </motion.div>
  )
}
