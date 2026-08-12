'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StickyNote, Pencil, Trash2, Check, X, Loader2, FileText, CalendarDays, ClipboardList, BookOpen } from 'lucide-react'
import { useToast } from '@/lib/toast'
import { cargarTodasLasNotas, actualizarNota, eliminarNota } from '@/lib/notas/api'
import { anclaDeNota, type Nota, type TipoAnclaNota } from '@/lib/notas/tipos'
import { ETIQUETA_ANCLA, CHIPS_FILTRO_NOTAS, filtrarNotasPorAncla, nombreDeAncla, type FiltroNotas, type ContextoNotas } from '@/lib/notas/formato'
import { RUTA_AGENDA } from '@/lib/rutas'

const ICONO_ANCLA: Record<TipoAnclaNota, typeof StickyNote> = {
  tarea: ClipboardList,
  bloque_horario: CalendarDays,
  archivo: FileText,
  materia: BookOpen,
  suelta: StickyNote,
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Sprint Sistema de Notas Unificado / Parte C — subsección "Notas" dentro
// de Archivos: TODAS las notas del usuario, sin importar su ancla, en un
// solo lugar. Creación primaria sigue ocurriendo desde el contexto original
// (SeccionNotas montado en /agenda, /horario, y el panel de Archivos) — acá
// solo se listan, se navega al contexto original, y se puede editar/borrar
// directo (vista de gestión centralizada, no solo de consulta).
export default function VistaNotasUnificada({
  contexto,
  onAbrirArchivo,
}: {
  contexto: ContextoNotas
  // Abrir un archivo desde acá reusa el panel de detalle que ya existe en
  // ArchivosSection (no navega a otra ruta, ya estamos en /archivos).
  onAbrirArchivo: (archivoId: string) => void
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [notas, setNotas] = useState<Nota[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<FiltroNotas>('todas')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEdicion, setTextoEdicion] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [confirmandoBorrarId, setConfirmandoBorrarId] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    void cargarTodasLasNotas().then((r) => {
      if (!activo) return
      if (r.ok) setNotas(r.datos)
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [])

  const visibles = filtrarNotasPorAncla(notas, filtro)

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

  // Navega al contexto original de la nota. Tarea/materia → /agenda (esta
  // sección no tiene un detalle propio de tarea navegable por id todavía,
  // así que aterriza en la pantalla correcta y el usuario ubica la tarea —
  // documentado como límite conocido, no simulado). Bloque de horario →
  // /horario. Archivo → abre el panel de detalle sin salir de esta pantalla.
  function alNavegar(nota: Nota) {
    const tipo = anclaDeNota(nota)
    if (tipo === 'archivo' && nota.archivo_id) return onAbrirArchivo(nota.archivo_id)
    if (tipo === 'bloque_horario') return void router.push('/horario')
    if (tipo === 'tarea' || tipo === 'materia') return void router.push(RUTA_AGENDA)
  }

  if (cargando) {
    return (
      <div className="rounded-3xl bg-panel-glass backdrop-blur-md p-10 flex items-center justify-center text-muted text-sm gap-2">
        <Loader2 size={15} className="animate-spin" />
        Cargando notas…
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-panel-glass backdrop-blur-md p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote size={16} className="text-coral" />
        <h2 className="font-display text-base font-semibold text-paper">Todas tus notas</h2>
        <span className="text-[11px] font-mono text-muted/70 ml-1">{notas.length}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {CHIPS_FILTRO_NOTAS.map((c) => (
          <button
            key={c.id}
            onClick={() => setFiltro(c.id)}
            className={`text-[11px] font-medium px-3 py-1.5 rounded-full transition ${
              filtro === c.id ? 'bg-coral text-ink' : 'bg-panel-2/60 text-muted hover:text-paper'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="text-[12px] text-muted/60 text-center py-10">
          {notas.length === 0 ? 'Aún no has escrito ninguna nota.' : 'Nada acá con este filtro.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibles.map((nota) => {
            const tipoAncla = anclaDeNota(nota)
            const Icono = ICONO_ANCLA[tipoAncla]
            const editando = editandoId === nota.id
            return (
              <div key={nota.id} className="rounded-2xl bg-panel-2/50 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <button
                    onClick={() => alNavegar(nota)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-coral transition min-w-0"
                    title={`Ir a ${ETIQUETA_ANCLA[tipoAncla]}`}
                  >
                    <Icono size={12} className="shrink-0" />
                    <span className="truncate">
                      {ETIQUETA_ANCLA[tipoAncla]}: {nombreDeAncla(nota, contexto)}
                    </span>
                  </button>
                  <span className="text-[10px] font-mono text-muted/50 shrink-0">
                    {formatearFecha(nota.created_at)}
                    {nota.creado_por === 'ia' && ' · IA'}
                  </span>
                </div>

                {editando ? (
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
                    <p className="text-[12.5px] leading-relaxed text-paper whitespace-pre-wrap min-w-0 flex-1">{nota.contenido}</p>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
