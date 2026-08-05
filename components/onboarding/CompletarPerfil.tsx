'use client'

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { apiPatch } from '@/lib/api/cliente'
import { ZONAS } from '@/lib/ajustes/zonas'
import { PAISES } from '@/lib/ajustes/paises'
import PremiumSelect from '@/components/ui/PremiumSelect'

type Props = {
  /** Del saludo/claims — precarga el campo si Google ya lo trajo. */
  nombreInicial: string | null
  /** Termina el paso (el padre, Bienvenida.tsx, decide qué sigue). */
  onTerminar: () => void
  guardando: boolean
}

const EASE_ASENTAR = [0.16, 1, 0.3, 1] as const

// Paso nuevo de /bienvenida — mismo lenguaje visual que CarruselOnboarding
// (tarjeta bg-panel-glass, wordmark arriba, fade+blur+stagger), pero es un
// formulario, no un carrusel: sin swipe, sin flechas de teclado, sin
// puntos de paginación — un solo panel con 4 campos.
//
// Por qué recoge también el nombre: para un usuario de magic link (A.4 de
// la auditoría de Auth) los claims no traen nombre — el campo llega vacío
// y es requerido acá. Para un usuario de Google, ya viene precargado y
// normalmente no hace falta tocarlo.
export default function CompletarPerfil({ nombreInicial, onTerminar, guardando }: Props) {
  const [nombre, setNombre] = useState(nombreInicial ?? '')
  const [apellido, setApellido] = useState('')
  const [pais, setPais] = useState('')
  const [zonaHoraria, setZonaHoraria] = useState(() => {
    try {
      const detectada = Intl.DateTimeFormat().resolvedOptions().timeZone
      return ZONAS.some((z) => z.id === detectada) ? detectada : ZONAS[0].id
    } catch {
      return ZONAS[0].id
    }
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valido = useMemo(() => nombre.trim().length > 0 && apellido.trim().length > 0 && pais.length > 0, [nombre, apellido, pais])

  async function confirmar() {
    if (!valido || enviando || guardando) return
    setEnviando(true)
    setError(null)

    const nombreLimpio = nombre.trim()

    // Solo si de verdad cambió/estaba vacío — evita una escritura y un
    // refresh de sesión innecesarios cuando el nombre de Google ya era
    // correcto y el usuario no lo tocó.
    if (nombreLimpio !== (nombreInicial ?? '')) {
      const { error: errorAuth } = await supabase.auth.updateUser({ data: { full_name: nombreLimpio } })
      if (errorAuth) {
        setEnviando(false)
        setError('No se pudo guardar el nombre — intenta de nuevo.')
        return
      }
      // Mismo fix ya verificado en components/ajustes/CategoriaPerfil.tsx:
      // updateUser() actualiza auth.users pero NO por sí solo el JWT ya
      // emitido de la sesión activa — sin este refresh, getClaims() (lo
      // que ya lee SesionSidebar/el saludo) sigue viendo el nombre viejo.
      await supabase.auth.refreshSession()
    }

    const resultado = await apiPatch('/api/perfil', {
      nombre: nombreLimpio,
      apellido: apellido.trim(),
      pais,
      zonaHoraria,
    })

    setEnviando(false)
    if (!resultado.ok) {
      setError('No se pudo guardar tu perfil — intenta de nuevo.')
      return
    }

    onTerminar()
  }

  return (
    <div className="w-full max-w-lg flex flex-col items-center">
      <div className="w-full flex items-center justify-center mb-7">
        <span className="inline-flex items-center gap-1.5 text-sm font-display font-semibold tracking-tight text-paper">
          <Sparkles size={14} className="text-coral" />
          <span>
            Flow<span className="text-coral">+</span>
          </span>
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: EASE_ASENTAR }}
        className="w-full rounded-[28px] bg-panel-glass backdrop-blur-xl shadow-2xl shadow-black/20 px-7 pt-8 pb-7"
      >
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-coral text-center">Un último paso</p>
        <h2 className="mt-2.5 font-display text-[25px] sm:text-[28px] font-semibold text-paper tracking-tight leading-[1.15] text-balance text-center">
          Completa tu perfil
        </h2>
        <p className="mt-3 text-muted text-sm leading-relaxed text-center max-w-[27rem] mx-auto">
          Unos datos básicos para terminar de configurar Flow+.
        </p>

        <div className="mt-7 flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              className="bg-panel-2/60 rounded-full px-4 py-2.5 text-sm text-paper outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
            />
            <input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Apellido"
              className="bg-panel-2/60 rounded-full px-4 py-2.5 text-sm text-paper outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs flex-shrink-0">País</span>
            <PremiumSelect id="pais-onboarding" options={PAISES} value={pais} onChange={setPais} placeholder="Elegir país" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs flex-shrink-0">Zona horaria</span>
            <PremiumSelect id="zona-onboarding" options={ZONAS} value={zonaHoraria} onChange={setZonaHoraria} />
          </div>
        </div>

        {error && <p className="mt-4 text-danger text-xs text-center">{error}</p>}

        <button
          onClick={confirmar}
          disabled={!valido || enviando || guardando}
          className="mt-6 w-full flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3 rounded-full bg-coral text-ink hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Continuar
        </button>
      </motion.div>
    </div>
  )
}
