'use client'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { MessageCircle, Check, Loader2, Unlink, Sparkles, LayoutList, Terminal, Send, Copy, ChevronDown } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { apiPatch } from '@/lib/api/cliente'
import { usePreferencias } from '@/lib/preferencias'
import { PAISES, paisDeZonaHoraria, type Pais } from '@/lib/ajustes/paises'
import BanderaPais from '@/components/ui/BanderaPais'
import BotonConfirmacion from '@/components/ui/BotonConfirmacion'

// Sprint 2/3 — vinculación de WhatsApp, preferencias y guía de uso.
//
// ─────────────────────────────────────────────────────────────────────────
// El flujo tiene UN solo camino, y es a propósito
// ─────────────────────────────────────────────────────────────────────────
// La versión anterior mandaba un código por WhatsApp y lo confirmaba EN LA
// APP. Ese segundo paso no puede funcionar: la app nunca ve un mensaje de
// WhatsApp, así que jamás aprende el `chat_id` con el que esa persona
// escribe — y sin él, alguien que llega como `@lid` (WhatsApp oculta su
// número) queda verificado en la base pero irreconocible para el webhook.
// Pasó de verdad: el usuario verificaba bien y el bot le seguía diciendo
// "no estás vinculado".
//
// Ahora: la app MUESTRA el código, y la vinculación ocurre cuando la persona
// responde `/vincular <código>` desde el WhatsApp que quiere vincular. Ese
// mensaje es lo único que revela su identificador real.

const FORMAS_DE_USO = [
  {
    icono: Sparkles,
    titulo: 'Escríbele normal',
    descripcion: 'La misma IA de Flow+ organiza tus tareas, notas y horario.',
    ejemplo: '"ensayo de historia para el viernes"',
  },
  {
    icono: LayoutList,
    titulo: 'Usa el menú',
    descripcion: 'Escribe "menú" y elige con botones.',
    ejemplo: 'menú',
  },
  {
    icono: Terminal,
    titulo: 'Comandos exactos',
    descripcion: 'Más rápidos y sin coste de IA.',
    ejemplo: '/tareas · /horario · /proximo',
  },
]

type Estado = { numero: string | null; verificado: boolean; notificaciones: boolean }
type Fase = 'numero' | 'codigo' | 'exito'

const ENTRADA = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }

export default function CategoriaWhatsApp() {
  const { notify } = useToast()
  const { zonaHoraria } = usePreferencias()
  const [cargando, setCargando] = useState(true)
  const [estado, setEstado] = useState<Estado>({ numero: null, verificado: false, notificaciones: false })
  const [fase, setFase] = useState<Fase>('numero')
  const [pais, setPais] = useState<Pais>(PAISES[0])
  const [listaPaises, setListaPaises] = useState(false)
  const [telefono, setTelefono] = useState('')
  const [codigo, setCodigo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [probando, setProbando] = useState(false)
  const sondeo = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let activo = true
    ;(async () => {
      try {
        const res = await fetch('/api/perfil')
        if (!res.ok) return
        const data = await res.json()
        if (!activo) return
        setEstado({
          numero: data.whatsappNumero ?? null,
          verificado: Boolean(data.whatsappVerificado),
          notificaciones: Boolean(data.whatsappNotificaciones),
        })
        // País por defecto = el del usuario, deducido de su zona horaria.
        // Sin permisos de ubicación ni servicios externos: el navegador ya
        // da la zona, y es el mismo dato que usa Fecha y hora.
        const detectado = paisDeZonaHoraria(data.zonaHoraria ?? zonaHoraria)
        if (detectado) setPais(detectado)
      } catch {
        // Silencioso — mismo criterio que el resto de categorías.
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => {
      activo = false
    }
  }, [zonaHoraria])

  // Mientras hay un código en pantalla, se sondea si ya se vinculó desde
  // WhatsApp. Es lo que permite mostrar la animación de éxito sin que el
  // usuario tenga que volver a la app y refrescar.
  useEffect(() => {
    if (fase !== 'codigo') return
    sondeo.current = setInterval(async () => {
      try {
        const res = await fetch('/api/perfil')
        if (!res.ok) return
        const data = await res.json()
        if (data.whatsappVerificado) {
          setEstado({
            numero: data.whatsappNumero ?? null,
            verificado: true,
            notificaciones: Boolean(data.whatsappNotificaciones),
          })
          setFase('exito')
        }
      } catch {
        // Silencioso: el sondeo se reintenta solo.
      }
    }, 3000)
    return () => {
      if (sondeo.current) clearInterval(sondeo.current)
    }
  }, [fase])

  async function pedirCodigo() {
    const numero = `+${pais.prefijo}${telefono.replace(/\D/g, '')}`
    setEnviando(true)
    try {
      const res = await fetch('/api/whatsapp/vincular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero }),
      })
      const data = await res.json()
      if (!res.ok) {
        notify(data.error ?? 'No se pudo generar el código', false)
        return
      }
      setCodigo(data.codigo)
      setFase('codigo')
    } catch {
      notify('No se pudo generar el código', false)
    } finally {
      setEnviando(false)
    }
  }

  async function enviarPrueba() {
    setProbando(true)
    try {
      const res = await fetch('/api/whatsapp/probar', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        notify(data.error ?? 'No se pudo enviar', false)
        return
      }
      notify('Te mandamos el menú por WhatsApp')
    } catch {
      notify('No se pudo enviar', false)
    } finally {
      setProbando(false)
    }
  }

  async function desvincular() {
    const res = await fetch('/api/whatsapp/vincular', { method: 'DELETE' })
    if (!res.ok) {
      notify('No se pudo desvincular', false)
      return
    }
    setEstado({ numero: null, verificado: false, notificaciones: false })
    setFase('numero')
    setCodigo(null)
    setTelefono('')
    notify('WhatsApp desvinculado')
  }

  async function alternarNotificaciones(valor: boolean) {
    const anterior = estado.notificaciones
    setEstado((e) => ({ ...e, notificaciones: valor }))
    const resultado = await apiPatch('/api/perfil', { whatsappNotificaciones: valor })
    if (!resultado.ok) {
      setEstado((e) => ({ ...e, notificaciones: anterior }))
      notify('No se pudo guardar el cambio — se deshizo', false)
    }
  }

  if (cargando) return null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-paper flex items-center gap-2">
          <MessageCircle size={16} className="text-coral" />
          WhatsApp
        </h2>
        <p className="text-muted text-xs mt-1">Gestiona tu agenda por mensajes y recibe recordatorios ahí.</p>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Vinculado ─────────────────────────────────────────────── */}
        {estado.verificado && fase !== 'exito' ? (
          <motion.div key="vinculado" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={ENTRADA} className="flex flex-col gap-4">
            <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                    <Check size={15} className="text-success" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-paper font-medium truncate">{estado.numero}</p>
                    <p className="text-muted text-xs">Vinculado y verificado</p>
                  </div>
                </div>
                <BotonConfirmacion onConfirmar={desvincular} etiqueta="Desvincular" etiquetaConfirmar="¿Seguro?" icono={<Unlink size={13} />} />
              </div>

              <button
                onClick={enviarPrueba}
                disabled={probando}
                className="mt-3.5 w-full rounded-xl bg-panel-2/60 hover:bg-panel-2 transition py-2.5 flex items-center justify-center gap-1.5 text-xs text-paper disabled:opacity-40"
              >
                {probando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Enviarme el menú de prueba
              </button>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5 gap-3">
              <div className="min-w-0">
                <p className="text-sm text-paper font-medium">Recordatorios por WhatsApp</p>
                <p className="text-muted text-xs mt-0.5">Las mismas notificaciones de la campana.</p>
              </div>
              <button
                role="switch"
                aria-checked={estado.notificaciones}
                aria-label="Recordatorios por WhatsApp"
                onClick={() => alternarNotificaciones(!estado.notificaciones)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${estado.notificaciones ? 'bg-coral' : 'bg-panel-2'}`}
              >
                <motion.span
                  layout
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-paper"
                  style={{ left: estado.notificaciones ? 24 : 4 }}
                />
              </button>
            </div>

            <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-4">
              <p className="text-sm text-paper font-medium text-center">Tres formas de usarlo</p>
              <p className="text-muted text-xs mt-0.5 mb-3.5 text-center">Todas hacen lo mismo — usa la que prefieras.</p>
              <div className="flex flex-col gap-2">
                {FORMAS_DE_USO.map((f, i) => (
                  <motion.div
                    key={f.titulo}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...ENTRADA, delay: 0.06 + i * 0.05 }}
                    className="rounded-xl bg-panel-2/50 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <f.icono size={13} className="text-coral flex-shrink-0" />
                      <p className="text-xs text-paper font-medium">{f.titulo}</p>
                    </div>
                    <p className="text-muted text-[11px] mt-1">{f.descripcion}</p>
                    <p className="text-muted/80 text-[11px] mt-1 font-mono break-words">{f.ejemplo}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : fase === 'exito' ? (
          /* ── Éxito ──────────────────────────────────────────────── */
          <motion.div key="exito" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center text-center py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center"
            >
              <motion.svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                <motion.path
                  d="M20 6L9 17l-5-5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.45, delay: 0.15, ease: 'easeOut' }}
                />
              </motion.svg>
            </motion.div>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ...ENTRADA }} className="font-display text-base font-semibold text-paper mt-4">
              ¡WhatsApp vinculado!
            </motion.p>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, ...ENTRADA }} className="text-muted text-xs mt-1 max-w-[16rem]">
              Ya puedes escribirle a Flow+ desde {estado.numero}.
            </motion.p>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => setFase('numero')}
              className="mt-5 rounded-full bg-coral text-ink px-5 py-2 text-xs font-medium"
            >
              Listo
            </motion.button>
          </motion.div>
        ) : fase === 'codigo' && codigo ? (
          /* ── Código en pantalla ─────────────────────────────────── */
          <motion.div key="codigo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={ENTRADA} className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-5">
            <p className="text-sm text-paper font-medium text-center">Casi listo</p>
            <p className="text-muted text-xs mt-1 mb-4 text-center">
              Manda este mensaje desde el WhatsApp que quieres vincular.
            </p>

            <div className="rounded-xl bg-panel-2/60 px-4 py-3.5 text-center">
              <p className="text-muted text-[10px] uppercase tracking-wide font-mono">Escribe esto</p>
              <p className="font-mono text-base text-paper mt-1.5 select-all">/vincular {codigo}</p>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(`/vincular ${codigo}`)
                  notify('Copiado')
                }}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-coral hover:text-paper transition"
              >
                <Copy size={12} />
                Copiar
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-1.5 text-[11px] text-muted">
              <p>1. Abre WhatsApp en el teléfono que quieres vincular.</p>
              <p>2. Escríbele a Flow+ el mensaje de arriba.</p>
              <p>3. Vuelve aquí — se confirmará solo.</p>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted">
              <Loader2 size={12} className="animate-spin" />
              Esperando tu mensaje…
            </div>

            <button onClick={() => setFase('numero')} className="mt-3 w-full text-[11px] text-muted hover:text-paper transition">
              Cambiar número
            </button>
          </motion.div>
        ) : (
          /* ── Pedir número ───────────────────────────────────────── */
          <motion.div key="numero" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={ENTRADA} className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-5">
            <p className="text-sm text-paper font-medium text-center">Vincula tu WhatsApp</p>
            <p className="text-muted text-xs mt-1 mb-4 text-center">Para recibir recordatorios en este número.</p>

            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setListaPaises((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full bg-panel-2/60 hover:bg-panel-2 transition px-3 py-2.5"
                >
                  <BanderaPais pais={pais.id} size={20} />
                  <span className="text-xs text-paper font-mono">+{pais.prefijo}</span>
                  <ChevronDown size={12} className={`text-muted transition-transform ${listaPaises ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {listaPaises && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute z-20 mt-2 w-60 max-h-64 overflow-auto rounded-2xl bg-panel-glass backdrop-blur-2xl shadow-2xl p-1.5 origin-top"
                    >
                      {PAISES.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setPais(p)
                            setListaPaises(false)
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition text-left ${p.id === pais.id ? 'bg-coral/15' : 'hover:bg-panel-2'}`}
                        >
                          <BanderaPais pais={p.id} size={20} />
                          <span className="text-xs text-paper flex-1 truncate">{p.label}</span>
                          <span className="text-[11px] text-muted font-mono">+{p.prefijo}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <input
                type="tel"
                inputMode="tel"
                placeholder="300 123 4567"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && telefono.trim() && !enviando && pedirCodigo()}
                className="flex-1 min-w-0 bg-panel-2/60 rounded-full px-4 py-2.5 text-xs text-paper outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
              />
            </div>

            <button
              onClick={pedirCodigo}
              disabled={enviando || telefono.replace(/\D/g, '').length < 6}
              className="mt-4 w-full rounded-full bg-coral text-ink py-2.5 text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {enviando && <Loader2 size={13} className="animate-spin" />}
              Continuar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
