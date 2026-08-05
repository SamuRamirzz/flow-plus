'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import CarruselOnboarding from './CarruselOnboarding'
import CompletarPerfil from './CompletarPerfil'
import { textoSaludo, subtituloSaludo, msSaludo } from '@/lib/onboarding/saludo'

type Props = {
  esPrimeraVez: boolean
  /** Independiente de esPrimeraVez — ver el comentario en app/bienvenida/page.tsx. */
  faltaPerfil: boolean
  /** Primer nombre, para el saludo — no usar para precargar formularios. */
  nombre: string | null
  /** Nombre completo, para precargar el campo de CompletarPerfil.tsx. */
  nombreCompleto: string | null
  /** Ruta interna ya validada en el servidor (ver destinoSeguro). */
  destino: string
}

type Fase = 'saludo' | 'carrusel' | 'perfil'

const EASE_ASENTAR = [0.16, 1, 0.3, 1] as const

// Sprint Onboarding — orquesta las dos partes del encargo: el saludo
// (Parte A) y, solo si es la primera vez, el carrusel (Parte B).
//
// ───────────────────────────────────────────────────────────────────────────
// POR QUÉ ES UNA RUTA PROPIA (/bienvenida) Y NO UN ESTADO DE /login
// ───────────────────────────────────────────────────────────────────────────
// El encargo decía "probablemente un breve estado intermedio en la propia
// pantalla de login, no una pantalla nueva separada". Se intentó por ahí y
// no es posible con la arquitectura de auth que ya existe — dos bloqueos
// reales, ninguno salvable sin deshacer algo del Sprint Auth:
//
//   1. Después de Google, el navegador NO vuelve a /login: vuelve a
//      /auth/callback, que es un Route Handler de SERVIDOR (tiene que serlo:
//      es donde se canjea el código por la sesión y se escriben las
//      cookies). Ahí no hay React ni forma de mostrar nada; solo redirige.
//   2. `proxy.ts` redirige a CUALQUIER usuario con sesión que pise /login,
//      mandándolo a `/`. O sea: en el instante exacto en que el saludo
//      tendría sentido —sesión recién confirmada— /login es justamente la
//      ruta que el proxy ya no deja ver. Habría que agujerearlo con una
//      excepción por query param, y un `?saludo=1` que apaga una regla del
//      proxy es exactamente el tipo de excepción frágil que ese archivo
//      documenta que hay que evitar.
//
// Una ruta propia resuelve las dos: /auth/callback y /auth/confirm ya
// redirigen a algún sitio, así que redirigen acá; y como es una página
// protegida normal, el proxy la cuida sin ninguna excepción.
//
// Visualmente sigue siendo continuo — misma composición centrada, mismo
// fondo, misma tipografía que /login — así que para el usuario ES la
// pantalla de entrada que sigue hablándole, no un salto a otro sitio.
export default function Bienvenida({ esPrimeraVez, faltaPerfil, nombre, nombreCompleto, destino }: Props) {
  const router = useRouter()
  const [fase, setFase] = useState<Fase>('saludo')
  const [guardando, setGuardando] = useState(false)
  // Una sola salida: el temporizador y el clic pueden dispararse casi a la
  // vez, y dos router.replace() encimados dejan la navegación en un estado
  // raro.
  const yaSalio = useRef(false)

  const salirA = useCallback(
    (ruta: string) => {
      if (yaSalio.current) return
      yaSalio.current = true
      // replace y no push: /bienvenida no debe quedar en el historial. Con
      // push, el botón "atrás" desde la app devolvería al saludo, que ya no
      // tiene sentido y (para quien lo completó) ni siquiera se volvería a
      // mostrar — se vería una pantalla vacía a medio camino.
      router.replace(ruta)
    },
    [router]
  )

  // Marca el onboarding como visto. Se llama tanto al terminar como al
  // saltar. Si el PATCH falla NO se atrapa al usuario: igual entra, y como
  // mucho vuelve a ver la bienvenida la próxima vez — que es el modo de
  // fallo correcto (mostrar de más una pantalla informativa es mucho menos
  // grave que dejar a alguien sin poder entrar a su agenda).
  const terminar = useCallback(async () => {
    if (guardando || yaSalio.current) return
    setGuardando(true)
    try {
      await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingCompletado: true }),
      })
    } catch (e) {
      console.error('No se pudo marcar el onboarding como completado:', e)
    }
    salirA(destino)
  }, [guardando, destino, salirA])

  // Fin del saludo: la primera vez encadena con el carrusel; si falta
  // completar el perfil (señal independiente, ver Props), encadena con ese
  // paso; el resto entra directo. Nada de esto marca el perfil — ver el
  // comentario de `terminar`.
  const cerrarSaludo = useCallback(() => {
    if (yaSalio.current) return
    if (esPrimeraVez) setFase('carrusel')
    else if (faltaPerfil) setFase('perfil')
    else salirA(destino)
  }, [esPrimeraVez, faltaPerfil, destino, salirA])

  // Fin del carrusel (terminado o saltado — CarruselOnboarding usa el mismo
  // callback para los dos, ver su propio comentario): si todavía falta
  // completar el perfil, encadena con ese paso ANTES de salir. Saltar el
  // tour informativo no salta los datos que la app necesita para funcionar
  // bien (misma razón por la que el nombre ya se autorellena en otros
  // lados) — son cosas distintas aunque las dos vivan en /bienvenida.
  const avanzarDesdeCarrusel = useCallback(() => {
    if (yaSalio.current) return
    if (faltaPerfil) setFase('perfil')
    else terminar()
  }, [faltaPerfil, terminar])

  useEffect(() => {
    if (fase !== 'saludo') return
    const id = setTimeout(cerrarSaludo, msSaludo(esPrimeraVez))
    return () => clearTimeout(id)
  }, [fase, esPrimeraVez, cerrarSaludo])

  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center px-6 py-14">
      <AnimatePresence mode="wait">
        {fase === 'saludo' ? (
          <motion.div
            key="saludo"
            // Todo el bloque es clicable para saltarlo: el encargo pedía que
            // un clic o tap lo adelante, y quien ya conoce la app no debería
            // tener que apuntarle a un botón chico para ahorrarse 1.6s.
            onClick={cerrarSaludo}
            initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, filter: 'blur(10px)' }}
            transition={{ duration: 0.55, ease: EASE_ASENTAR }}
            className="max-w-lg text-center cursor-pointer select-none"
          >
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: EASE_ASENTAR }}
              className="font-display text-[30px] sm:text-[40px] font-semibold text-paper tracking-tight leading-[1.12] text-balance"
            >
              {textoSaludo(esPrimeraVez, nombre)}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.28, ease: EASE_ASENTAR }}
              className="text-muted text-sm mt-4"
            >
              {subtituloSaludo(esPrimeraVez)}
            </motion.p>
          </motion.div>
        ) : fase === 'carrusel' ? (
          <motion.div
            key="carrusel"
            initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease: EASE_ASENTAR }}
            className="w-full flex justify-center"
          >
            <CarruselOnboarding onTerminar={avanzarDesdeCarrusel} guardando={guardando} />
          </motion.div>
        ) : (
          <motion.div
            key="perfil"
            initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease: EASE_ASENTAR }}
            className="w-full flex justify-center"
          >
            <CompletarPerfil nombreInicial={nombreCompleto} onTerminar={terminar} guardando={guardando} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
