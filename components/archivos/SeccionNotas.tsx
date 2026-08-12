'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { StickyNote, Plus, Check, X, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { cargarNotasDeArchivo, crearNotaDeArchivo, actualizarNota, eliminarNota } from '@/lib/archivos/api'
import type { Nota } from '@/lib/archivos/tipos'

// Sprint Archivos — Notas ancladas a un archivo, dentro del panel de
// detalle. Mismo patrón de expandir-para-escribir que el resto de la app
// usa para captura rápida (ej. AddTaskBar): un botón "+ Agregar nota" que
// se convierte en un textarea + Guardar/Cancelar, en vez de un formulario
// siempre visible que ocuparía espacio sin necesidad.
//
// El backend ya sincroniza cada nota a Drive automáticamente (crearNota()/
// sincronizarNotaADrive() en lib/server/notas.ts, dentro de la carpeta
// "Notas") — este componente no sabe nada de Drive, solo llama al endpoint
// y confía en que el reflejo ya está resuelto del otro lado.
export default function SeccionNotas({ archivoId }: { archivoId: string }) {
  const { notify } = useToast()
  const [notas, setNotas] = useState<Nota[]>([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [textoNueva, setTextoNueva] = useState('')
  const [guardandoNueva, setGuardandoNueva] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEdicion, setTextoEdicion] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [confirmandoBorrarId, setConfirmandoBorrarId] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    void cargarNotasDeArchivo(archivoId).then((r) => {
      if (!activo) return
      if (r.ok) setNotas(r.datos)
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [archivoId])

  async function alGuardarNueva() {
    const contenido = textoNueva.trim()
    if (contenido.length === 0 || guardandoNueva) return
    setGuardandoNueva(true)
    const r = await crearNotaDeArchivo(archivoId, contenido)
    setGuardandoNueva(false)
    if (!r.ok) return notify(r.error, false)
    setNotas((prev) => [r.datos, ...prev])
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
    setNotas((prev) => prev.map((n) => (n.id === id ? r.datos : n)))
    setEditandoId(null)
  }

  async function alBorrar(id: string) {
    const r = await eliminarNota(id)
    if (!r.ok) return notify(r.error, false)
    setNotas((prev) => prev.filter((n) => n.id !== id))
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

          {!cargando && notas.length === 0 && !creando && <p className="text-[11px] text-muted/60 leading-relaxed">Aún no hay notas en este archivo.</p>}
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
