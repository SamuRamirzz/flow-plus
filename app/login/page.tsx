'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, Loader2, Mail, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/lib/toast'
import BorderGlow from '@/components/reactbits/BorderGlow'

// Sprint Auth / Fase 6 — pantalla única de entrada.
//
// Ajuste post-Fase-0: el teléfono se retiró del alcance de este sprint (costo
// real de SMS — Twilio y Firebase Phone Auth requieren tarjeta y plan de pago
// por igual, ninguno es gratis; ver docs/SPRINT-AUTH-telefono-pospuesto.md
// para la investigación completa, conservada como referencia). Los dos
// métodos de este sprint son **Google** (OAuth nativo de Supabase) y
// **email** (magic link, sin contraseña).
//
// Por qué magic link y no email+contraseña: cero fricción adicional sobre
// Google (ningún dato que recordar), sin flujo de "olvidé mi contraseña" que
// construir, sin UI de fuerza de contraseña, y Supabase ya gestiona el token
// de un solo uso. La única desventaja (hay que revisar el correo) es
// aceptable para un proyecto personal con pocos usuarios.
//
// No distingue "iniciar sesión" de "registrarse" — ni Google ni el magic link
// lo necesitan: Supabase crea la cuenta en el primer intento y reusa la
// existente después.

function IconoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A8.99 8.99 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a8.99 8.99 0 0 0 0 8.08l3.02-2.32Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 .96 4.96l3.02 2.32C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

function ContenidoLogin() {
  const params = useSearchParams()
  const volverA = params.get('volverA')
  const errorUrl = params.get('error')
  const { notify } = useToast()

  // Sprint Home / Parte 4 — toast pasivo, no invasivo, para el único caso que
  // vale la pena avisar: `proxy.ts` marca `motivo=sesion_perdida` SOLO cuando
  // había una cookie de sesión real que dejó de validar (no en la primera
  // visita de alguien anónimo) — ver el comentario extendido en proxy.ts
  // sobre el bug de persistencia que esto ayuda a detectar en uso real.
  //
  // Deliberadamente NO hay un toast de "bienvenido de nuevo" al iniciar
  // sesión con éxito: `/bienvenida` (Sprint Onboarding) ya saluda a pantalla
  // completa en cada login real ("Qué bueno tenerte de vuelta") — un toast
  // acá sería literalmente el mismo mensaje dos veces.
  useEffect(() => {
    if (params.get('motivo') === 'sesion_perdida') {
      notify('Tu sesión anterior se cerró — vuelve a entrar', false)
    }
    // Deliberadamente sin `params`/`notify` en las dependencias: es un aviso
    // de UNA sola vez al montar la pantalla, no algo que deba repetirse si el
    // usuario navega el formulario y el query string cambia por otro motivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [cargandoGoogle, setCargandoGoogle] = useState(false)
  const [email, setEmail] = useState('')
  const [cargandoEmail, setCargandoEmail] = useState(false)
  const [enlaceEnviado, setEnlaceEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function entrarConGoogle() {
    setCargandoGoogle(true)
    setError(null)

    const destino = new URL('/auth/callback', window.location.origin)
    if (volverA) destino.searchParams.set('volverA', volverA)

    const { error: errorOAuth } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: destino.toString(),
        // drive.file (no `drive` completo): scope NO sensible, solo pide
        // verificación básica de marca — deja listo el sprint de Archivos sin
        // volver a pedir permiso.
        scopes: 'https://www.googleapis.com/auth/drive.file',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })

    if (errorOAuth) {
      setError(errorOAuth.message)
      setCargandoGoogle(false)
    }
  }

  async function enviarEnlace() {
    const correo = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      setError('Escribe un correo válido.')
      return
    }
    setCargandoEmail(true)
    setError(null)

    const destino = new URL('/auth/confirm', window.location.origin)
    if (volverA) destino.searchParams.set('volverA', volverA)

    const { error: errorOtp } = await supabase.auth.signInWithOtp({
      email: correo,
      options: { emailRedirectTo: destino.toString() },
    })

    setCargandoEmail(false)
    if (errorOtp) {
      setError(errorOtp.message)
      return
    }
    setEnlaceEnviado(true)
  }

  const mensaje = error ?? errorUrl

  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          {/* El wordmark envuelto en su propio <span>: este contenedor es
              flex con `gap`, y dejar "Flow" como texto suelto lo convertía en
              un hijo flex aparte del <span> del "+", metiendo el gap entre
              los dos ("Flow +"). Mismo arreglo que en el carrusel de
              bienvenida. */}
          <span className="inline-flex items-center gap-1.5 text-sm font-display font-semibold tracking-tight text-paper mb-4">
            <Sparkles size={14} className="text-coral" />
            <span>
              Flow<span className="text-coral">+</span>
            </span>
          </span>
          <h1 className="font-display text-[32px] sm:text-[38px] font-semibold text-paper tracking-tight leading-[1.1] mb-3">
            Tu agenda, con IA
          </h1>
          <p className="text-muted text-sm max-w-sm mx-auto">
            Entra para ver tus tareas, tu horario y todo lo que la IA ya organizó por ti.
          </p>
        </div>

        <BorderGlow
          backgroundColor="var(--color-panel-glass)"
          borderRadius={24}
          glowRadius={32}
          glowIntensity={0.6}
          fillOpacity={0.35}
          edgeSensitivity={35}
          coneSpread={28}
          glowColor="14 100 65"
        >
          <div className="p-6 flex flex-col gap-4">
            <motion.button
              onClick={entrarConGoogle}
              disabled={cargandoGoogle}
              whileHover={{ scale: cargandoGoogle ? 1 : 1.015 }}
              whileTap={{ scale: cargandoGoogle ? 1 : 0.985 }}
              className={`flex items-center justify-center gap-2.5 w-full rounded-full px-5 py-3.5 text-sm font-semibold bg-paper text-ink transition disabled:opacity-60 ${
                cargandoGoogle ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {cargandoGoogle ? <Loader2 size={16} className="animate-spin" /> : <IconoGoogle />}
              {cargandoGoogle ? 'Abriendo Google…' : 'Continuar con Google'}
            </motion.button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[10px] font-mono uppercase tracking-wide text-muted/70">o con tu email</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <AnimatePresence mode="wait">
              {enlaceEnviado ? (
                <motion.div
                  key="enviado"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 rounded-2xl bg-panel-2/60 px-4 py-3.5"
                >
                  <CheckCircle2 size={16} className="text-success mt-0.5 flex-shrink-0" />
                  <p className="text-paper text-xs leading-relaxed">
                    Te enviamos un enlace a <span className="font-medium">{email}</span>. Ábrelo desde este mismo navegador.
                  </p>
                </motion.div>
              ) : (
                <motion.div key="formulario" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2.5">
                  <div className="relative">
                    <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && enviarEnlace()}
                      placeholder="tu@correo.com"
                      className="w-full bg-panel-2/60 rounded-full pl-11 pr-4 py-3 text-paper text-sm placeholder:text-muted/50 outline-none focus:ring-1 focus:ring-coral/60 transition"
                    />
                  </div>
                  <motion.button
                    onClick={enviarEnlace}
                    disabled={cargandoEmail}
                    whileHover={{ scale: cargandoEmail ? 1 : 1.015 }}
                    whileTap={{ scale: cargandoEmail ? 1 : 0.985 }}
                    className="flex items-center justify-center gap-2 w-full rounded-full px-5 py-3 text-sm font-semibold bg-panel-2 text-paper hover:bg-panel-2/70 transition disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {cargandoEmail && <Loader2 size={15} className="animate-spin" />}
                    {cargandoEmail ? 'Enviando…' : 'Enviarme un enlace de acceso'}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {mensaje && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-danger text-xs text-center leading-relaxed"
              >
                {mensaje}
              </motion.p>
            )}
          </div>
        </BorderGlow>

        <p className="text-muted/70 text-[11px] text-center mt-6 leading-relaxed">
          Al entrar, se crea tu cuenta si es la primera vez.
        </p>
      </motion.div>
    </main>
  )
}

// `useSearchParams` exige un límite de Suspense en el App Router — sin él, la
// página entera se vuelve dinámica y Next avisa en el build.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <ContenidoLogin />
    </Suspense>
  )
}
