'use client'
import { useEffect, useState } from 'react'
import { MessageCircle, Check, Loader2, Unlink } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { apiPatch } from '@/lib/api/cliente'
import BotonConfirmacion from '@/components/ui/BotonConfirmacion'

// Sprint 2/3 — vinculación de WhatsApp y preferencia de notificaciones.
//
// Deliberadamente SIN instrucciones de "únete al sandbox mandando un
// código": eso era un requisito del sandbox de Twilio, que se descartó.
// Whapi.Cloud usa una sesión de dispositivo vinculada por QR del lado del
// servidor, así que el usuario no tiene que hacer ningún paso previo — solo
// confirmar su número.

type Estado = {
  numero: string | null
  verificado: boolean
  notificaciones: boolean
}

export default function CategoriaWhatsApp() {
  const { notify } = useToast()
  const [cargando, setCargando] = useState(true)
  const [estado, setEstado] = useState<Estado>({ numero: null, verificado: false, notificaciones: false })
  const [numeroInput, setNumeroInput] = useState('')
  const [codigo, setCodigo] = useState('')
  const [fase, setFase] = useState<'numero' | 'codigo'>('numero')
  const [enviando, setEnviando] = useState(false)

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
      } catch {
        // Silencioso — mismo criterio que el resto de categorías.
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => {
      activo = false
    }
  }, [])

  async function pedirCodigo() {
    setEnviando(true)
    try {
      const res = await fetch('/api/whatsapp/vincular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: numeroInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        notify(data.error ?? 'No se pudo enviar el código', false)
        return
      }
      setFase('codigo')
      notify('Te mandamos un código por WhatsApp')
    } catch {
      notify('No se pudo enviar el código', false)
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarCodigo() {
    setEnviando(true)
    try {
      const res = await fetch('/api/whatsapp/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        notify(data.error ?? 'Código incorrecto', false)
        return
      }
      setEstado((e) => ({ ...e, numero: data.numero, verificado: true }))
      setFase('numero')
      setCodigo('')
      setNumeroInput('')
      notify('WhatsApp vinculado')
    } catch {
      notify('No se pudo verificar el código', false)
    } finally {
      setEnviando(false)
    }
  }

  async function desvincular() {
    const res = await fetch('/api/whatsapp/vincular', { method: 'DELETE' })
    if (!res.ok) {
      notify('No se pudo desvincular', false)
      return
    }
    setEstado({ numero: null, verificado: false, notificaciones: false })
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
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-paper flex items-center gap-2">
          <MessageCircle size={16} className="text-coral" />
          WhatsApp
        </h2>
        <p className="text-muted text-xs mt-1">Gestiona tu agenda por mensajes y recibe recordatorios ahí.</p>
      </div>

      {estado.verificado ? (
        <>
          <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-paper font-medium flex items-center gap-1.5">
                  <Check size={14} className="text-success flex-shrink-0" />
                  <span className="truncate">{estado.numero}</span>
                </p>
                <p className="text-muted text-xs mt-0.5">Número vinculado y verificado.</p>
              </div>
              <BotonConfirmacion
                onConfirmar={desvincular}
                etiqueta="Desvincular"
                etiquetaConfirmar="¿Seguro?"
                icono={<Unlink size={13} />}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5 gap-3">
            <div className="min-w-0">
              <p className="text-sm text-paper font-medium">Recordatorios por WhatsApp</p>
              <p className="text-muted text-xs mt-0.5">
                Recibe ahí las mismas notificaciones que ves en la campana.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={estado.notificaciones}
              aria-label="Recordatorios por WhatsApp"
              onClick={() => alternarNotificaciones(!estado.notificaciones)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition ${estado.notificaciones ? 'bg-coral' : 'bg-panel-2'}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-paper transition-all ${estado.notificaciones ? 'left-6' : 'left-1'}`}
              />
            </button>
          </div>

          <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
            <p className="text-sm text-paper font-medium mb-2">Comandos disponibles</p>
            <ul className="text-muted text-xs space-y-1 font-mono">
              <li>/tarea Ensayo, historia, mañana, alta</li>
              <li>/tareas · /horario · /proximo</li>
              <li>/completar ensayo</li>
              <li>/nota materia biología, revisar cap. 5</li>
              <li>/ayuda</li>
            </ul>
          </div>
        </>
      ) : fase === 'numero' ? (
        <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
          <p className="text-sm text-paper font-medium">Vincula tu número</p>
          <p className="text-muted text-xs mt-0.5 mb-3">
            Te mandamos un código por WhatsApp para confirmar que es tuyo.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="tel"
              inputMode="tel"
              placeholder="+57 300 123 4567"
              value={numeroInput}
              onChange={(e) => setNumeroInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && numeroInput.trim() && !enviando && pedirCodigo()}
              className="flex-1 min-w-0 bg-panel-glass backdrop-blur-md rounded-full px-4 py-2 text-xs text-paper outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
            />
            <button
              onClick={pedirCodigo}
              disabled={enviando || numeroInput.trim().length === 0}
              className="flex-shrink-0 rounded-full bg-coral text-ink px-4 py-2 text-xs font-medium disabled:opacity-40 flex items-center gap-1.5"
            >
              {enviando && <Loader2 size={12} className="animate-spin" />}
              Enviar código
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
          <p className="text-sm text-paper font-medium">Escribe el código</p>
          <p className="text-muted text-xs mt-0.5 mb-3">Te llegó por WhatsApp. Vence en 10 minutos.</p>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && codigo.length === 6 && !enviando && confirmarCodigo()}
              className="w-28 text-center tracking-[0.3em] bg-panel-glass backdrop-blur-md rounded-full px-4 py-2 text-xs text-paper outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
            />
            <button
              onClick={confirmarCodigo}
              disabled={enviando || codigo.length !== 6}
              className="flex-shrink-0 rounded-full bg-coral text-ink px-4 py-2 text-xs font-medium disabled:opacity-40 flex items-center gap-1.5"
            >
              {enviando && <Loader2 size={12} className="animate-spin" />}
              Confirmar
            </button>
            <button onClick={() => setFase('numero')} className="text-muted hover:text-paper text-xs transition">
              Cambiar número
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
