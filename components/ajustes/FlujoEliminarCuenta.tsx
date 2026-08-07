'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { AlertTriangle, HardDrive, Loader2, Trash2 } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { useCuentaEliminacion } from '@/lib/cuentaEliminacion'
import { estadoDrive } from '@/lib/archivos/api'
import { diasRestantes, fechaEjecucion } from '@/lib/cuenta/eliminacion'
import BotonConfirmacion from '@/components/ui/BotonConfirmacion'

const TEXTO_CONFIRMACION = 'ELIMINAR'

// Sprint Soporte + Eliminación de cuenta — Parte B.3.
//
// Tres pasos de fricción CRECIENTE antes de que algo irreversible quede
// programado, tal como pide el encargo: (1) BotonConfirmacion de dos toques
// (el mismo patrón que "Cerrar sesión"/"Limpiar horario" en todo el
// proyecto), (2) elegir explícitamente qué pasa con Drive — SIN default,
// el schema del servidor rechaza el campo si falta, (3) escribir "ELIMINAR"
// a mano. La fricción de más en el paso 3 es deliberada: los dos toques
// anteriores son el mismo patrón que ya se usa para acciones reversibles
// (cerrar sesión no pierde nada); esta acción, pasados 14 días, sí.
//
// El estado de la solicitud (¿hay una activa?, ¿desde cuándo?) vive en
// CuentaEliminacionProvider, no acá — es lo que permite que el banner
// persistente (otro árbol, montado en el layout raíz) se entere al instante
// cuando esto solicita o cancela, sin recargar la página.
export default function FlujoEliminarCuenta() {
  const { notify } = useToast()
  const { solicitada, solicitadaEn, eliminarDriveTambien, solicitar, cancelar } = useCuentaEliminacion()
  const [driveVinculado, setDriveVinculado] = useState<boolean | null>(null)

  const [paso, setPaso] = useState<'inicio' | 'drive' | 'confirmar'>('inicio')
  const [eliminarDrive, setEliminarDrive] = useState<boolean | null>(null)
  const [textoEscrito, setTextoEscrito] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  useEffect(() => {
    // Solo hace falta saber esto para decidir si se ofrece el paso "drive" —
    // no bloquea el render del botón inicial mientras carga.
    let activo = true
    void estadoDrive().then((r) => {
      if (activo && r.ok) setDriveVinculado(r.datos.estado === 'vinculada')
      else if (activo) setDriveVinculado(false)
    })
    return () => {
      activo = false
    }
  }, [])

  function reiniciar() {
    setPaso('inicio')
    setEliminarDrive(null)
    setTextoEscrito('')
  }

  function alArmarPrimerNivel() {
    // Sin Drive vinculado no hay elección real que ofrecer — se salta
    // directo a la confirmación por texto, con `eliminarDrive` en `false`
    // (el servidor exige el booleano igual; `false` es honesto acá porque
    // no hay Drive del que borrar nada).
    setEliminarDrive(driveVinculado ? null : false)
    setPaso(driveVinculado ? 'drive' : 'confirmar')
  }

  async function alConfirmarFinal() {
    if (eliminarDrive === null || textoEscrito !== TEXTO_CONFIRMACION) return
    setEnviando(true)
    const r = await solicitar(eliminarDrive)
    setEnviando(false)
    if (!r.ok) return notify(r.error, false)
    reiniciar()
  }

  async function alCancelar() {
    setCancelando(true)
    const r = await cancelar()
    setCancelando(false)
    if (!r.ok) return notify(r.error, false)
    notify('Se canceló la eliminación de tu cuenta', true)
  }

  // ── Ya hay una solicitud activa ─────────────────────────────────────────
  if (solicitada && solicitadaEn) {
    const restantes = diasRestantes(solicitadaEn, new Date())
    const fecha = fechaEjecucion(solicitadaEn).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

    return (
      <div className="rounded-2xl bg-danger/10 px-4 py-4">
        <p className="text-sm text-paper font-medium flex items-center gap-2 mb-1.5">
          <AlertTriangle size={15} className="text-danger shrink-0" />
          Tu cuenta se eliminará el {fecha}
        </p>
        <p className="text-xs text-muted leading-relaxed mb-3">
          Quedan {restantes} {restantes === 1 ? 'día' : 'días'}. {eliminarDriveTambien ? 'Tus archivos de Google Drive también se borrarán.' : 'Tus archivos se conservarán en tu Google Drive.'}{' '}
          Puedes cancelar en cualquier momento antes de esa fecha.
        </p>
        <button
          onClick={() => void alCancelar()}
          disabled={cancelando}
          className="flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-xs font-semibold text-ink hover:opacity-90 transition disabled:opacity-60"
        >
          {cancelando ? <Loader2 size={13} className="animate-spin" /> : null}
          {cancelando ? 'Cancelando…' : 'Cancelar eliminación'}
        </button>
      </div>
    )
  }

  // ── Sin solicitud activa: flujo de 3 pasos ──────────────────────────────
  return (
    <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-4">
      <p className="text-sm text-paper font-medium mb-1">Eliminar mi cuenta</p>
      <p className="text-xs text-muted leading-relaxed mb-3">
        Se elimina en 14 días — puedes cancelar en cualquier momento antes de esa fecha. Después, no hay vuelta atrás.
      </p>

      <AnimatePresence mode="wait">
        {paso === 'inicio' && (
          <motion.div key="inicio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BotonConfirmacion
              onConfirmar={alArmarPrimerNivel}
              etiqueta="Eliminar mi cuenta"
              etiquetaConfirmar="Toca de nuevo para continuar"
              icono={<Trash2 size={13} />}
              className="text-danger"
            />
          </motion.div>
        )}

        {paso === 'drive' && (
          <motion.div key="drive" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2.5">
            <p className="flex items-center gap-2 text-xs font-medium text-paper">
              <HardDrive size={13} className="text-coral" />
              ¿Qué hacemos con tus archivos en Google Drive?
            </p>
            {(
              [
                { valor: false, titulo: 'Conservarlos en mi Drive', detalle: 'Son tuyos — se quedan ahí aunque tu cuenta de Flow+ desaparezca.' },
                { valor: true, titulo: 'Eliminarlos también', detalle: 'Se borra la carpeta “Flow+” completa de tu Drive.' },
              ] as const
            ).map((opcion) => (
              <button
                key={String(opcion.valor)}
                onClick={() => setEliminarDrive(opcion.valor)}
                className={`text-left rounded-xl px-3.5 py-2.5 transition ${
                  eliminarDrive === opcion.valor ? 'bg-coral/12 ring-1 ring-coral/40' : 'bg-panel-2/60 hover:bg-panel-2'
                }`}
              >
                <p className="text-xs font-medium text-paper">{opcion.titulo}</p>
                <p className="text-[11px] text-muted mt-0.5">{opcion.detalle}</p>
              </button>
            ))}
            <div className="flex items-center gap-2 mt-1">
              <button onClick={reiniciar} className="text-xs text-muted hover:text-paper transition px-3 py-2">
                Cancelar
              </button>
              <button
                onClick={() => eliminarDrive !== null && setPaso('confirmar')}
                disabled={eliminarDrive === null}
                className="flex-1 rounded-full bg-panel-2 px-4 py-2.5 text-xs font-semibold text-paper hover:bg-panel-2/70 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </motion.div>
        )}

        {paso === 'confirmar' && (
          <motion.div key="confirmar" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2.5">
            <p className="text-xs text-muted leading-relaxed">
              Escribe <span className="font-mono text-paper">{TEXTO_CONFIRMACION}</span> para confirmar. Esta es la última pantalla antes de programar la eliminación.
            </p>
            <input
              value={textoEscrito}
              onChange={(e) => setTextoEscrito(e.target.value.toUpperCase())}
              placeholder={TEXTO_CONFIRMACION}
              className="w-full rounded-xl bg-panel-2/60 px-3.5 py-2.5 text-sm text-paper font-mono placeholder:text-muted/40 outline-none focus:ring-1 focus:ring-danger/50 transition"
            />
            <div className="flex items-center gap-2">
              <button onClick={reiniciar} className="text-xs text-muted hover:text-paper transition px-3 py-2">
                Cancelar
              </button>
              <button
                onClick={() => void alConfirmarFinal()}
                disabled={textoEscrito !== TEXTO_CONFIRMACION || enviando}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-danger px-4 py-2.5 text-xs font-semibold text-ink transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enviando && <Loader2 size={13} className="animate-spin" />}
                {enviando ? 'Programando…' : 'Eliminar mi cuenta en 14 días'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
