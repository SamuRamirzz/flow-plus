'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Sparkles, ArrowRight, BellRing, Undo2, Layers, GraduationCap, Camera, Mic } from 'lucide-react'
import AnimatedContent from '@/components/reactbits/AnimatedContent'
import GradualBlur from '@/components/reactbits/GradualBlur'
import MagicBentoCard from '@/components/reactbits/MagicBento'
import HeroCaosOrden from './HeroCaosOrden'
import RastroCursor from './RastroCursor'
import MockupAI from './MockupAI'
import MockupHorario from './MockupHorario'
import PalabraCiclica from './PalabraCiclica'
import { FRAGMENTOS } from './datosDemo'
import { RUTA_APP } from '@/lib/rutas'

// Landing pública de Flow+. Es lo que sirve `/` SIEMPRE — con sesión y sin
// ella. La app vive en `/agenda`; ver lib/rutas.ts para el porqué del cambio.

const EASE = [0.16, 1, 0.3, 1] as const

function Wordmark({ grande = false }: { grande?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-display font-semibold tracking-tight text-paper ${grande ? 'text-base' : 'text-sm'}`}>
      <Sparkles size={grande ? 16 : 14} className="text-coral" />
      <span>
        Flow<span className="text-coral">+</span>
      </span>
    </span>
  )
}

/** Continuidad visual: los mismos apuntes crudos del hero siguen apareciendo,
 *  muy tenues, detrás del resto de la página. El encargo pedía que el caos no
 *  desapareciera sin dejar rastro — así el recorrido se lee como una sola
 *  historia y no como secciones sueltas. */
function RastroDeNotas({ indices }: { indices: number[] }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden hidden lg:block">
      {indices.map((idx, n) => {
        const f = FRAGMENTOS[idx % FRAGMENTOS.length]!
        return (
          <motion.span
            key={f.id + n}
            className="absolute font-mono text-[11px] text-muted/12 whitespace-nowrap"
            style={{ left: `${n % 2 === 0 ? 3 : 78}%`, top: `${18 + n * 34}%`, rotate: `${f.rot}deg` }}
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 9 + n * 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            {f.crudo}
          </motion.span>
        )
      })}
    </div>
  )
}

function Titulo({ children, etiqueta }: { children: React.ReactNode; etiqueta: string }) {
  return (
    <>
      <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-coral mb-3">{etiqueta}</span>
      <h2 className="font-display text-[28px] sm:text-[38px] lg:text-[44px] font-semibold text-paper tracking-tight leading-[1.1] text-balance">
        {children}
      </h2>
    </>
  )
}

// `haySesion` NO decide qué se muestra — la landing es la misma para todos, y
// esa es justamente la corrección de esta reorganización: antes desaparecía
// para quien tuviera cuenta. Solo decide A DÓNDE llevan los botones, para no
// mandar al login a alguien que ya entró.
export default function Landing({ haySesion = false }: { haySesion?: boolean }) {
  const destinoCta = haySesion ? RUTA_APP : '/login'
  const textoCta = haySesion ? 'Ir a mi agenda' : 'Empezar gratis'

  return (
    <main className="relative z-10 overflow-x-hidden">
      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative min-h-screen flex flex-col px-5 sm:px-8 lg:px-12 pt-6 pb-16">
        <RastroCursor />

        {/* `pr-14` deja libre la esquina donde el layout monta el ThemeToggle
            (`fixed top-5 right-5 w-10 h-10`). Sin esto el botón "Entrar" le
            quedaba debajo y en móvil se leía cortado como "Er" — se vio en la
            captura a 390px, no en el código. */}
        <nav className="relative flex items-center justify-between gap-4 pr-14 mb-10 lg:mb-14">
          <Wordmark grande />
          <Link
            href={destinoCta}
            className="flex-shrink-0 rounded-full bg-panel-2/70 backdrop-blur-md px-4 py-2 text-xs font-semibold text-paper transition hover:bg-panel-2"
          >
            {haySesion ? 'Mi agenda' : 'Entrar'}
          </Link>
        </nav>

        <div className="relative flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-10 lg:gap-14 items-center max-w-7xl mx-auto w-full">
          <div className="relative z-10 max-w-xl">
            <motion.h1
              initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, ease: EASE }}
              className="font-display text-[38px] sm:text-[54px] lg:text-[64px] font-semibold text-paper tracking-tight leading-[1.04] text-balance"
            >
              Tu semana,{' '}
              <PalabraCiclica palabras={['ordenada', 'entendida', 'resuelta', 'lista']} /> sola.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
              className="mt-5 text-muted text-[15px] sm:text-base leading-relaxed max-w-lg"
            >
              Escríbele como le escribirías a un compañero — desordenado, a las corridas, con una foto del tablero.
              Flow+ lo entiende y te devuelve tus entregas con materia, fecha y prioridad.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                href={destinoCta}
                className="group inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                {textoCta}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              {!haySesion && (
                <Link href="/login" className="text-[13px] font-medium text-muted transition hover:text-paper">
                  Ya tengo cuenta
                </Link>
              )}
            </motion.div>
          </div>

          {/* El lienzo caos→orden: la demostración, no la descripción. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.25, ease: EASE }}
            className="relative z-10 w-full"
          >
            <HeroCaosOrden />
          </motion.div>
        </div>

        {/* Difuminado del borde inferior: encadena el hero con lo que sigue en
            vez de cortarlo con una línea. */}
        <GradualBlur position="bottom" height="8rem" strength={2} divCount={6} />
      </section>

      {/* ══════════════════ 2 — /ai ══════════════════ */}
      <section className="relative px-5 sm:px-8 lg:px-12 py-20 lg:py-28">
        <RastroDeNotas indices={[0, 2]} />
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <AnimatedContent distance={40}>
            <Titulo etiqueta="01">Háblale como a un compañero</Titulo>
            <p className="mt-5 text-muted text-[15px] leading-relaxed max-w-md">
              Texto suelto, una foto del tablero, un PDF o directamente tu voz. Flow+ saca de ahí qué hay que hacer,
              de qué materia y para cuándo — y si te equivocaste, se lo dices con palabras y lo cambia.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {[
                { icono: <Camera size={13} />, t: 'Foto o PDF' },
                { icono: <Mic size={13} />, t: 'Dictado por voz' },
                { icono: <Undo2 size={13} />, t: 'Deshacer real' },
              ].map((c) => (
                <li
                  key={c.t}
                  className="inline-flex items-center gap-1.5 rounded-full bg-panel-2/60 px-3 py-1.5 text-[11px] text-muted"
                >
                  <span className="text-coral">{c.icono}</span>
                  {c.t}
                </li>
              ))}
            </ul>
          </AnimatedContent>

          <AnimatedContent distance={60} delay={0.1}>
            <MockupAI />
          </AnimatedContent>
        </div>
      </section>

      {/* ══════════════════ 3 — horario ══════════════════ */}
      <section className="relative px-5 sm:px-8 lg:px-12 py-20 lg:py-28">
        <RastroDeNotas indices={[1, 3]} />
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <AnimatedContent distance={60} className="lg:order-2">
            <Titulo etiqueta="02">Tu semana, sin que la calcules tú</Titulo>
            <p className="mt-5 text-muted text-[15px] leading-relaxed max-w-md">
              Carga tu horario a mano o mándale una foto y lo llena solo. Desde ahí, cuando anotes algo sin fecha,
              Flow+ ya sabe cuándo toca esa materia y la pone en la próxima clase.
            </p>
          </AnimatedContent>

          <AnimatedContent distance={40} delay={0.1} className="lg:order-1">
            <MockupHorario />
          </AnimatedContent>
        </div>
      </section>

      {/* ══════════════════ 4 — bento ══════════════════ */}
      <section className="relative px-5 sm:px-8 lg:px-12 py-20 lg:py-28">
        <div className="max-w-6xl mx-auto">
          <AnimatedContent distance={30}>
            <Titulo etiqueta="03">Y todo lo demás, sin que lo pidas</Titulo>
          </AnimatedContent>

          {/* Asimétrico a propósito: la primera caja pesa el doble porque
              recordar a tiempo es la promesa central del producto. */}
          <div className="mt-10 grid gap-3 sm:gap-4 md:grid-cols-3 auto-rows-[minmax(160px,auto)]">
            <AnimatedContent distance={40} delay={0.05} className="md:col-span-2 md:row-span-2 h-full">
              <MagicBentoCard className="h-full p-6 sm:p-8">
                <BellRing size={22} className="text-coral mb-4" />
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-paper tracking-tight mb-2.5">
                  Recordatorios que entienden qué es urgente
                </h3>
                <p className="text-muted text-[13px] sm:text-sm leading-relaxed max-w-md">
                  Un examen se avisa con más días de antelación que una lectura. Y si tienes tres cosas el mismo día,
                  llega un solo aviso agrupado en vez de tres — nunca más de los que pediste, nunca en la madrugada.
                </p>
              </MagicBentoCard>
            </AnimatedContent>

            <AnimatedContent distance={40} delay={0.12} className="h-full">
              <MagicBentoCard className="h-full p-5 sm:p-6">
                <GraduationCap size={20} className="text-coral mb-3" />
                <h3 className="font-display text-base font-semibold text-paper tracking-tight mb-2">Exámenes completos</h3>
                <p className="text-muted text-[12.5px] leading-relaxed">
                  Dices &ldquo;entra el capítulo 5 y vale 40%&rdquo; y queda guardado como temario, peso y formato.
                </p>
              </MagicBentoCard>
            </AnimatedContent>

            <AnimatedContent distance={40} delay={0.18} className="h-full">
              <MagicBentoCard className="h-full p-5 sm:p-6">
                <Layers size={20} className="text-coral mb-3" />
                <h3 className="font-display text-base font-semibold text-paper tracking-tight mb-2">Sin materias repetidas</h3>
                <p className="text-muted text-[12.5px] leading-relaxed">
                  Escribes &ldquo;Calculo 2&rdquo; y te avisa que ya tienes &ldquo;Cálculo II&rdquo;. Fusionas con un clic.
                </p>
              </MagicBentoCard>
            </AnimatedContent>

            <AnimatedContent distance={40} delay={0.24} className="md:col-span-3 h-full">
              <MagicBentoCard className="h-full">
                {/* El layout va en un hijo, no en el `className` de la
                    tarjeta: ese className aterriza en el contenedor externo
                    (el que lleva el fondo y el resplandor), así que un `flex`
                    ahí ordenaría la capa de glow y el contenido, no el icono
                    y el texto. Se vio en la prueba real: el icono quedaba
                    encima del título en vez de al lado. */}
                <div className="h-full p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                  <Undo2 size={20} className="text-coral flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-display text-base font-semibold text-paper tracking-tight mb-1.5">
                      Nada es irreversible
                    </h3>
                    <p className="text-muted text-[12.5px] leading-relaxed max-w-2xl">
                      Cada cosa que la IA crea, cambia o borra queda con su botón de deshacer. Puedes dejarla trabajar
                      tranquilo, porque cualquier error se revierte con un clic.
                    </p>
                  </div>
                </div>
              </MagicBentoCard>
            </AnimatedContent>
          </div>
        </div>
      </section>

      {/* ══════════════════ CTA ══════════════════ */}
      <section className="relative px-5 sm:px-8 lg:px-12 py-24 lg:py-36">
        <RastroDeNotas indices={[2, 0]} />
        <AnimatedContent distance={40} className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-display text-[34px] sm:text-[50px] lg:text-[60px] font-semibold text-paper tracking-tight leading-[1.05] text-balance">
            Deja que fluya
          </h2>
          <p className="mt-5 text-muted text-[15px] leading-relaxed max-w-md mx-auto">
            Tú cuéntale. Del orden se encarga Flow+.
          </p>
          <Link
            href={destinoCta}
            className="group mt-9 inline-flex items-center gap-2.5 rounded-full bg-coral px-8 py-4 text-base font-semibold text-white transition hover:brightness-110"
          >
            {textoCta}
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </AnimatedContent>

        <footer className="relative mt-24 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-6xl mx-auto">
          <Wordmark />
          <span className="text-[11px] font-mono uppercase tracking-wide text-muted/50">Agenda académica con IA</span>
        </footer>
      </section>
    </main>
  )
}
