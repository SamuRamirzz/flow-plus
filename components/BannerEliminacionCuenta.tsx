'use client'

import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { AlertTriangle } from 'lucide-react'
import { useCuentaEliminacion } from '@/lib/cuentaEliminacion'
import { diasRestantes, fechaEjecucion } from '@/lib/cuenta/eliminacion'
import { esRutaDeEntrada } from '@/lib/rutas'
import { useToast } from '@/lib/toast'

// Sprint Soporte + Eliminación de cuenta — Parte B.4.
//
// Franja persistente, visible en TODA la app (no solo Home o Ajustes, que el
// encargo dejaba a criterio): una cuenta programada para borrarse en dos
// semanas es un estado que el usuario debería ver sin importar en qué
// pantalla esté trabajando, no solo si entra a Ajustes por otra razón.
//
// Mismo criterio de gating que AppSidebar/NavDock: se esconde en las rutas
// de entrada (login, bienvenida, legal) — ahí no hay sesión real o la
// pantalla ya tiene su propio propósito de pantalla completa.
export default function BannerEliminacionCuenta() {
  const pathname = usePathname()
  const { notify } = useToast()
  const { solicitada, solicitadaEn, cancelar } = useCuentaEliminacion()

  if (esRutaDeEntrada(pathname) || !solicitada || !solicitadaEn) return null

  const restantes = diasRestantes(solicitadaEn, new Date())
  const fecha = fechaEjecucion(solicitadaEn).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })

  async function alCancelar() {
    const r = await cancelar()
    notify(r.ok ? 'Se canceló la eliminación de tu cuenta' : r.error, r.ok)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="fixed top-0 inset-x-0 z-[80] flex justify-center px-4 pt-3 pointer-events-none"
      >
        <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-danger/90 backdrop-blur-md px-4 py-2 shadow-lg max-w-full">
          <AlertTriangle size={14} className="text-ink shrink-0" />
          <p className="text-ink text-xs font-medium truncate">
            Tu cuenta se eliminará el {fecha} ({restantes} {restantes === 1 ? 'día' : 'días'})
          </p>
          <button onClick={() => void alCancelar()} className="shrink-0 text-ink text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition">
            Cancelar
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
