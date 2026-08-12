'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { StickyNote, Plus, Check, X, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { cargarNotas, crearNota, actualizarNota, eliminarNota, type AnclaNota } from '@/lib/notas/api'
import type { Nota } from '@/lib/notas/tipos'

// Sprint Sistema de Notas Unificado — generaliza la sección de notas que
// nació hardcodeada a `archivoId` (Sprint Archivos) para que
// `/agenda` (tareas/exámenes) y `/horario` (bloques, incluidos los 4 tipos:
// clase/ingreso/salida/descanso) la puedan montar con el mismo componente,
// sin duplicar el patrón de "lista + expandir para agregar + editar inline +
// borrar con doble confirmación". El diseño visual, la UX y el
// comportamiento son IDÉNTICOS a la versión original de Archivos — solo
// cambia qué ancla (AnclaNota) se le pasa.
export default function SeccionNotas({ ancla, mensajeVacio }: { ancla: AnclaNota; mensajeVacio?: string }) {
  const { notify } = useToast()
  // `notasCargadas` guarda para qué ancla se cargó — permite derivar
  // `cargando`/`notas` en el render (líneas de abajo) en vez de un
  // `setState` síncrono al inicio del efecto cada vez que `ancla` cambia
  // (evita react-hooks/set-state-in-effect, regla que este proyecto
  // mantiene en cero). En la práctica todos los llamadores de hoy montan
  // este componente con una ancla fija (nunca la cambian sin remontar), así
  // que esto es defensivo más que necesario hoy — pero el componente sigue
  // siendo correcto si algún día se reusa así.
  const [notasCargadas, setNotasCargadas] = useState<{ anclaId: string; notas: Nota[] } | null>(null)
  const [creando, setCreando] = useState(false)
  const [textoNueva, setTextoNueva] = useState('')
  const [guardandoNueva, setGuardandoNueva] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEdicion, setTextoEdicion] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [confirmandoBorrarId, setConfirmandoBorrarId] = useState<string | null>(null)

  const cargando = notasCargadas?.anclaId !== ancla.id
  const notas = notasCargadas?.anclaId === ancla.id ? notasCargadas.notas : []

  useEffect(() => {
    let activo = true
    void cargarNotas(ancla).then((r) => {
      if (!activo) return
      if (r.ok) setNotasCargadas({ anclaId: ancla.id, notas: r.datos })
    })
    return () => {
      activo = false
    }
    // `ancla.id` basta como dependencia real (el `tipo` no cambia sin que
    // el `id` también cambie, en todo caso de uso de este componente hoy).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ancla.tipo, ancla.id])

  async function alGuardarNueva() {
    const contenido = textoNueva.trim()
    if (contenido.length === 0 || guardandoNueva) return
    setGuardandoNueva(true)
    const r = await crearNota(ancla, contenido)
    setGuardandoNueva(false)
    if (!r.ok) return notify(r.error, false)
    setNotasCargadas((prev) => ({ anclaId: ancla.id, notas: [r.datos, ...(prev?.notas ?? [])] }))
    setTextoNueva('')
    setCreando(false)
  }

  function alEmpezarEdicion(nota: Nota) {
    setEditandoId(nota.id)
    setTextoEdicion(nota.contenido)
  }

  async function alGuardarEdicion(id: string) {
    const contenido = textoEdicion.trim()
    if (contenido.length === 0 || guardandoEdicion) return
    setGuardandoEdicion(true)
    const r = await actualizarNota(id, contenido)
    setGuardandoEdicion(false)
    if (!r.ok) return notify(r.error, false)
    setNotasCargadas((prev) => (prev ? { anclaId: prev.anclaId, notas: prev.notas.map((n) => (n.id === id ? r.datos : n)) } : prev))
    setEditandoId(null)
  }

  async function alBorrar(id: string) {
    const r = await eliminarNota(id)
    if (!r.ok) return notify(r.error, false)
    setNotasCargadas((prev) => (prev ? { anclaId: prev.anclaId, notas: prev.notas.filter((n) => n.id !== id) } : prev))
    setConfirmandoBorrarId(null)
  }

  return (
    <section className="mt-5">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-paper mb-2.5">
        <StickyNote size={14} className="text-coral shrink-0" />
        Notas
      </h3>

      {cargando ? (
        <div className="flex items-center gap-2 text-[12px] text-muted py-2">
          <Loader2 size={13} className="animate-spin" />
          Cargando notas…
        </div>
      ) : (
        <div className="space-y-2 mb-2.5">
          {notas.map((nota) => (
            <div key={nota.id} className="rounded-xl bg-panel-2/60 px-3 py-2.5">
              {editandoId === nota.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={textoEdicion}
                    onChange={(e) => setTextoEdicion(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full resize-none rounded-lg bg-panel/60 px-2.5 py-2 text-[12px] text-paper placeholder:text-muted/60 outline-none focus:ring-1 focus:ring-coral/50 transition"
                  />
                  <div className="flex items-center gap-1.5 justify-end">
                    <button onClick={() => setEditandoId(null)} className="rounded-lg p-1.5 text-muted hover:text-paper hover:bg-panel-2 transition">
                      <X size={13} />
                    </button>
                    <button
                      onClick={() => void alGuardarEdicion(nota.id)}
                      disabled={guardandoEdicion || textoEdicion.trim().length === 0}
                      aria-label="Confirmar edición"
                      className="rounded-lg p-1.5 text-coral hover:bg-coral/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {guardandoEdicion ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="text-[12px] leading-relaxed text-muted whitespace-pre-wrap min-w-0 flex-1">{nota.contenido}</p>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => alEmpezarEdicion(nota)} aria-label="Editar nota" className="rounded-lg p-1.5 text-muted hover:text-paper hover:bg-panel-2 transition">
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => (confirmandoBorrarId === nota.id ? void alBorrar(nota.id) : setConfirmandoBorrarId(nota.id))}
                      onBlur={() => setConfirmandoBorrarId(null)}
                      aria-label={confirmandoBorrarId === nota.id ? 'Confirmar borrado' : 'Borrar nota'}
                      className={`rounded-lg p-1.5 transition ${confirmandoBorrarId === nota.id ? 'text-ink bg-danger' : 'text-muted hover:text-danger hover:bg-danger/10'}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {!cargando && notas.length === 0 && !creando && (
            <p className="text-[11px] text-muted/60 leading-relaxed">{mensajeVacio ?? 'Aún no hay notas acá.'}</p>
          )}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {creando ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <textarea
              value={textoNueva}
              onChange={(e) => setTextoNueva(e.target.value)}
              placeholder="Escribe tu nota…"
              rows={3}
              autoFocus
              className="w-full resize-none rounded-xl bg-panel-2/60 px-3 py-2.5 text-[12px] text-paper placeholder:text-muted/60 outline-none focus:ring-1 focus:ring-coral/50 transition"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => {
                  setCreando(false)
                  setTextoNueva('')
                }}
                className="text-[11px] text-muted hover:text-paper transition px-2 py-1.5"
              >
                Cancelar
              </button>
              <button
                onClick={() => void alGuardarNueva()}
                disabled={guardandoNueva || textoNueva.trim().length === 0}
                className="flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-[11px] font-semibold text-ink transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {guardandoNueva && <Loader2 size={11} className="animate-spin" />}
                {guardandoNueva ? 'Guardando…' : 'Guardar nota'}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="boton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCreando(true)}
            className="flex items-center gap-1.5 rounded-full bg-panel-2/60 px-3.5 py-2 text-[11px] font-medium text-muted hover:text-paper hover:bg-panel-2 transition"
          >
            <Plus size={13} />
            Agregar nota
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  )
}
