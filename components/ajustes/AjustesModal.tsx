'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronLeft, ChevronRight, Search, X, User, Sun, Clock, Bell, FileText, LifeBuoy, Sparkles, LogOut, Settings, type LucideIcon } from 'lucide-react'
import { useMontado } from '@/lib/useMontado'
import { useAjustesModal, type CategoriaAjustesId } from '@/lib/ajustesModal'
import { buscarCategorias } from '@/lib/ajustes/busqueda'
import CategoriaPerfil from './CategoriaPerfil'
import CategoriaApariencia from './CategoriaApariencia'
import CategoriaFechaHora from './CategoriaFechaHora'
import CategoriaNotificaciones from './CategoriaNotificaciones'
import CategoriaInformes from './CategoriaInformes'
import CategoriaSoporte from './CategoriaSoporte'
import CategoriaProximamente from './CategoriaProximamente'
import CategoriaCerrarSesion from './CategoriaCerrarSesion'

const CATEGORIAS: { id: CategoriaAjustesId; label: string; icono: LucideIcon; Componente: () => React.ReactNode }[] = [
  { id: 'perfil', label: 'Perfil', icono: User, Componente: CategoriaPerfil },
  { id: 'apariencia', label: 'Apariencia', icono: Sun, Componente: CategoriaApariencia },
  { id: 'fecha-hora', label: 'Fecha y hora', icono: Clock, Componente: CategoriaFechaHora },
  { id: 'notificaciones', label: 'Notificaciones', icono: Bell, Componente: CategoriaNotificaciones },
  { id: 'informes', label: 'Informes', icono: FileText, Componente: CategoriaInformes },
  { id: 'soporte', label: 'Soporte', icono: LifeBuoy, Componente: CategoriaSoporte },
  { id: 'proximamente', label: 'Próximamente', icono: Sparkles, Componente: CategoriaProximamente },
  { id: 'cerrar-sesion', label: 'Cerrar sesión', icono: LogOut, Componente: CategoriaCerrarSesion },
]

const EASE_ASENTAR = [0.16, 1, 0.3, 1] as const

// El contenido vive en su propio componente y solo se monta mientras el
// modal está abierto. Eso es lo que permite que su estado (categoría
// elegida, búsqueda escrita) nazca ya correcto en cada apertura, con un
// `useState` inicializado desde la prop — en vez de un efecto que lo
// "resetee" al abrir, que además de ser un setState dentro de un efecto
// (el error de lint react-hooks/set-state-in-effect que este proyecto ya
// tiene en cero) provoca un render de más con el estado viejo visible.
function ContenidoAjustes({ categoriaInicial, cerrar }: { categoriaInicial: CategoriaAjustesId; cerrar: () => void }) {
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaAjustesId>(categoriaInicial)
  // Solo aplica por debajo de lg: en desktop las dos columnas se ven
  // siempre, así que este estado se ignora (ver las clases del grid).
  const [verDetalleEnMovil, setVerDetalleEnMovil] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const categoriasVisibles = buscarCategorias(busqueda, CATEGORIAS)
  const activa = CATEGORIAS.find((c) => c.id === categoriaActiva) ?? CATEGORIAS[0]
  const Panel = activa.Componente

  function elegir(id: CategoriaAjustesId) {
    setCategoriaActiva(id)
    setVerDetalleEnMovil(true)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 py-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Settings size={17} className="text-coral" />
          <h2 className="font-display text-base font-semibold text-paper tracking-tight">Ajustes</h2>
        </div>
        <button
          onClick={cerrar}
          aria-label="Cerrar ajustes"
          className="text-muted hover:text-paper transition p-1 rounded-full hover:bg-panel-2/60"
        >
          <X size={17} />
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[232px_1fr]">
        {/* Panel izquierdo — buscador + lista de categorías. En móvil
            desaparece cuando se abre un detalle. */}
        <nav className={`flex-col gap-1 px-3 pb-4 overflow-y-auto ${verDetalleEnMovil ? 'hidden lg:flex' : 'flex'}`}>
          <div className="relative mb-2 px-0.5">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar ajustes"
              className="w-full bg-panel-2/60 rounded-full pl-9 pr-3 py-2 text-sm text-paper placeholder:text-muted outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
            />
          </div>

          {categoriasVisibles.length === 0 ? (
            <p className="text-muted text-xs text-center py-6 px-2">Nada coincide con «{busqueda}»</p>
          ) : (
            categoriasVisibles.map((cat) => {
              const seleccionada = activa.id === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => elegir(cat.id)}
                  className={`flex items-center justify-between gap-2.5 px-2.5 py-2.5 rounded-2xl text-sm text-left transition ${
                    seleccionada ? 'bg-panel-2/70 text-paper' : 'text-muted hover:text-paper hover:bg-panel-2/40'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {/* Cuadrado de ícono al estilo de la referencia de macOS,
                        pero monocromo: el proyecto tiene un único color de
                        acento (coral) y un color por categoría rompería esa
                        paleta deliberadamente corta. */}
                    <span
                      className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition ${
                        seleccionada ? 'bg-coral text-ink' : 'bg-panel-2/70 text-muted'
                      }`}
                    >
                      <cat.icono size={15} />
                    </span>
                    <span className="truncate">{cat.label}</span>
                  </span>
                  <ChevronRight size={14} className="text-muted lg:hidden flex-shrink-0" />
                </button>
              )
            })
          )}
        </nav>

        {/* Panel derecho — detalle. En móvil solo cuando se eligió una
            categoría. */}
        <div className={`min-h-0 overflow-y-auto px-5 pb-6 lg:pl-2 ${verDetalleEnMovil ? 'block' : 'hidden lg:block'}`}>
          <button
            onClick={() => setVerDetalleEnMovil(false)}
            className="lg:hidden flex items-center gap-1.5 text-muted text-xs font-mono uppercase tracking-wide mb-5 hover:text-paper transition"
          >
            <ChevronLeft size={13} />
            Ajustes
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={activa.id}
              initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: EASE_ASENTAR }}
            >
              <Panel />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}

// Ajustes, estilo macOS System Settings: sidebar de categorías con buscador
// + panel de detalle. Es un MODAL, no una ruta — reemplaza a la página
// /ajustes que existía antes.
//
// Por qué modal y no ruta: Ajustes no es un destino, es algo que abres
// encima de lo que estabas haciendo y cierras para volver exactamente ahí.
// Como ruta, además, ocupaba un lugar en la navegación principal compitiendo
// con las secciones reales (Inicio/Agenda/IA/Horario) y obligaba a un
// "volver" manual. Como modal, el estado de la categoría es local — no hace
// falta deep-link ni el límite de Suspense que la versión de página
// necesitaba por su `useSearchParams`.
//
// El shell (portal + backdrop + spring) sigue a DayDetailModal; el cierre por
// Escape y el bloqueo de scroll del body vienen de AIImmersiveOverlay, que
// era el único componente del proyecto que ya los tenía.
export default function AjustesModal() {
  const montado = useMontado()
  const { abierto, categoriaInicial, cerrar } = useAjustesModal()

  useEffect(() => {
    if (!abierto) return
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = overflowPrevio
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [abierto, cerrar])

  if (!montado) return null

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cerrar}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.97, y: 8, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-label="Ajustes"
            className="fixed z-[100] inset-0 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[70vw] lg:max-w-4xl lg:h-[80vh] lg:max-h-[680px] bg-panel-glass backdrop-blur-2xl lg:rounded-[28px] shadow-2xl overflow-hidden flex flex-col"
          >
            <ContenidoAjustes categoriaInicial={categoriaInicial} cerrar={cerrar} />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
