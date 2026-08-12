'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { X, Sparkles, ListChecks, BookMarked, CalendarClock, MessageCircle, Send, Loader2, AlertTriangle, RotateCw, Tag, Download } from 'lucide-react'
import type { Materia } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import type { Archivo, MensajeArchivo } from '@/lib/archivos/tipos'
import { formatearTamano, familiaDeArchivo, ETIQUETA_TIPO_DOCUMENTO } from '@/lib/archivos/formato'
import { cargarConversacionArchivo, preguntarSobreArchivo, urlContenido } from '@/lib/archivos/api'
import { formatearHora } from '@/lib/hora'
import { usePreferencias } from '@/lib/preferencias'
import { diasHastaProximo } from '@/lib/horario/dias'
import PreviewArchivo from './PreviewArchivo'
import IconoArchivo from './IconoArchivo'
import SeccionNotas from './SeccionNotas'

type Props = {
  archivo: Archivo
  materias: Materia[]
  horario: BloqueHorario[]
  analizando: boolean
  onCerrar: () => void
  onAnalizar: () => void
}

export default function PanelDetalle({ archivo, materias, horario, analizando, onCerrar, onAnalizar }: Props) {
  const router = useRouter()
  const { formatoReloj } = usePreferencias()
  const materia = materias.find((m) => m.id === archivo.materia_id) ?? null
  const tareas = Array.isArray(archivo.tareas_detectadas) ? archivo.tareas_detectadas : []

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="rounded-3xl bg-panel-glass backdrop-blur-md p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
    >
      {/* Encabezado */}
      <div className="flex items-start gap-3 mb-4">
        <IconoArchivo mimeType={archivo.mime_type} nombre={archivo.nombre} tam={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-paper leading-snug break-words">{archivo.nombre}</p>
          <p className="text-[11px] text-muted mt-1">
            {familiaDeArchivo(archivo.mime_type, archivo.nombre).toUpperCase()} · {formatearTamano(archivo.tamano_bytes)}
          </p>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar detalle" className="shrink-0 rounded-lg p-1.5 text-muted hover:text-paper hover:bg-panel-2 transition">
          <X size={16} />
        </button>
      </div>

      <PreviewArchivo archivo={archivo} />

      <SeccionResumen archivo={archivo} analizando={analizando} onAnalizar={onAnalizar} />

      {tareas.length > 0 && (
        <Seccion Icono={ListChecks} titulo={`${tareas.length} ${tareas.length === 1 ? 'tarea detectada' : 'tareas detectadas'}`}>
          <ul className="space-y-2">
            {tareas.map((t) => (
              <li key={t.id} className="flex gap-2 text-[12px] leading-relaxed text-muted">
                <span className="text-coral mt-[3px] shrink-0" aria-hidden="true">
                  •
                </span>
                <span className="min-w-0">
                  <span className="text-paper">{t.titulo}</span>
                  {(t.fecha || t.materia) && <span className="text-muted"> — {[t.materia, t.fecha].filter(Boolean).join(', ')}</span>}
                </span>
              </li>
            ))}
          </ul>
          {/* Honestidad sobre la referencia: ahí cada tarea trae "(p. 2)". El
              backend guarda `DetectedTask` (título/materia/fecha/prioridad/
              tipo/confianza) — no hay número de página en el modelo de datos,
              así que no se muestra uno inventado. */}
          <p className="mt-3 text-[10px] text-muted/60 leading-relaxed">
            Estas tareas se detectaron dentro del documento. Todavía no se crean solas en tu agenda — revísalas y agrégalas desde IA si quieres.
          </p>
        </Seccion>
      )}

      <Seccion Icono={Tag} titulo="Detalles">
        <div className="space-y-1.5">
          <FilaMeta Icono={BookMarked} etiqueta="Materia">
            {materia ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: materia.color }} />
                {materia.nombre}
              </span>
            ) : (
              <span className="text-muted/60">Sin materia</span>
            )}
          </FilaMeta>

          {archivo.tipo_documento && (
            <FilaMeta Icono={Tag} etiqueta="Tipo">
              {ETIQUETA_TIPO_DOCUMENTO[archivo.tipo_documento]}
            </FilaMeta>
          )}

          <ProximaClase materia={materia} horario={horario} formatoReloj={formatoReloj} />
        </div>

        {/* Limitación real y declarada: no existe `PATCH /api/archivos/[id]`.
            La materia se fija al subir el archivo; cambiarla después exigiría
            un endpoint que este sprint no construye (el encargo pedía
            explícitamente no crear backend nuevo a mitad de camino). */}
        <p className="mt-3 text-[10px] text-muted/60 leading-relaxed">La materia se elige al subir el archivo. Cambiarla después todavía no está disponible.</p>
      </Seccion>

      <SeccionNotas archivoId={archivo.id} />

      <ConversacionArchivo archivoId={archivo.id} puedePreguntar={archivo.drive_file_id !== null} />

      <div className="mt-5 flex items-center gap-2">
        <motion.button
          onClick={() => router.push('/ai', { transitionTypes: ['to-ai'] })}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-coral px-4 py-3 text-sm font-semibold text-ink transition cursor-pointer"
        >
          <Sparkles size={15} />
          Abrir con IA
        </motion.button>
        <a
          href={urlContenido(archivo.id, 'descargar')}
          aria-label="Descargar archivo"
          className="shrink-0 rounded-2xl bg-panel-2 p-3 text-muted hover:text-paper transition"
        >
          <Download size={16} />
        </a>
      </div>
    </motion.aside>
  )
}

// ═══════════════════════════════════════════════════════════════════════════

function Seccion({ Icono, titulo, children }: { Icono: typeof Sparkles; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-paper mb-2.5">
        <Icono size={14} className="text-coral shrink-0" />
        {titulo}
      </h3>
      {children}
    </section>
  )
}

function FilaMeta({ Icono, etiqueta, children }: { Icono: typeof Sparkles; etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-panel-2/60 px-3 py-2.5">
      <span className="flex items-center gap-2 text-[12px] text-muted shrink-0">
        <Icono size={13} />
        {etiqueta}
      </span>
      <span className="text-[12px] text-paper text-right min-w-0 truncate">{children}</span>
    </div>
  )
}

const NOMBRE_DIA: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' }

/**
 * "En tu horario" de la referencia: cuándo es la próxima clase de la materia
 * de este archivo.
 *
 * NO reusa `proximaClaseHoy` de lib/estadisticas/pulso.ts pese al nombre
 * parecido: esa función solo mira los bloques de HOY (es lo que el pulso del
 * día necesita) y devolvería `null` para una materia que se cursa mañana —
 * justo el caso más común acá. Se compone con `diasHastaProximo`, que ya es
 * puro y probado, para elegir el bloque más cercano de cualquier día.
 *
 * Si la materia no tiene bloques de horario, la fila no se muestra: no hay
 * nada honesto que decir ahí.
 */
function ProximaClase({ materia, horario, formatoReloj }: { materia: Materia | null; horario: BloqueHorario[]; formatoReloj: '12h' | '24h' }) {
  if (!materia) return null
  const bloques = horario.filter((b) => b.materiaId === materia.id && b.horaInicio !== null)
  if (bloques.length === 0) return null

  const hoy = new Date()
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  const proximo = bloques
    .map((b) => ({ bloque: b, dias: diasHastaProximo(hoyISO, b.diaSemana, true) }))
    .sort((a, b) => a.dias - b.dias || (a.bloque.horaInicio ?? '').localeCompare(b.bloque.horaInicio ?? ''))[0]

  return (
    <FilaMeta Icono={CalendarClock} etiqueta="En tu horario">
      {NOMBRE_DIA[proximo.bloque.diaSemana]} {formatearHora(proximo.bloque.horaInicio as string, formatoReloj)}
    </FilaMeta>
  )
}

/**
 * Resumen de IA. Los tres estados son reales y distintos, y se muestran
 * distinto a propósito: nunca analizado / se intentó y falló / analizado.
 * `analizado_en` y `analisis_error` son dos columnas justamente para poder
 * hacer esta distinción (ver la migración 20260809000400).
 */
function SeccionResumen({ archivo, analizando, onAnalizar }: { archivo: Archivo; analizando: boolean; onAnalizar: () => void }) {
  if (analizando) {
    return (
      <Seccion Icono={Sparkles} titulo="Resumen generado por IA">
        <div className="flex items-center gap-2.5 rounded-xl bg-panel-2/60 px-3 py-3 text-[12px] text-muted">
          <Loader2 size={14} className="animate-spin text-coral shrink-0" />
          Analizando el documento…
        </div>
      </Seccion>
    )
  }

  if (archivo.resumen_ia) {
    return (
      <Seccion Icono={Sparkles} titulo="Resumen generado por IA">
        <p className="text-[12px] leading-relaxed text-muted">{archivo.resumen_ia}</p>
      </Seccion>
    )
  }

  if (archivo.analisis_error) {
    return (
      <Seccion Icono={AlertTriangle} titulo="No se pudo analizar">
        <p className="text-[12px] leading-relaxed text-muted mb-2.5">{archivo.analisis_error}</p>
        <button onClick={onAnalizar} className="flex items-center gap-2 rounded-full bg-panel-2 px-3.5 py-2 text-[11px] font-medium text-paper hover:bg-panel-2/70 transition">
          <RotateCw size={12} />
          Reintentar
        </button>
      </Seccion>
    )
  }

  return (
    <Seccion Icono={Sparkles} titulo="Resumen generado por IA">
      <p className="text-[12px] leading-relaxed text-muted mb-2.5">Aún no se generó un resumen para este archivo.</p>
      {archivo.drive_file_id && (
        <button onClick={onAnalizar} className="flex items-center gap-2 rounded-full bg-coral/12 px-3.5 py-2 text-[11px] font-medium text-coral hover:bg-coral/20 transition">
          <Sparkles size={12} />
          Analizar con IA
        </button>
      )}
    </Seccion>
  )
}

/**
 * Hilo de preguntas sobre ESTE archivo. Sí existe backend real detrás
 * (`POST`/`GET /api/archivos/[id]/preguntar`, Fase 7) — se persiste en
 * `conversaciones_ia` con `archivo_id`, así que el hilo sobrevive a recargar
 * la página.
 */
function ConversacionArchivo({ archivoId, puedePreguntar }: { archivoId: string; puedePreguntar: boolean }) {
  const [mensajes, setMensajes] = useState<MensajeArchivo[]>([])
  const [pregunta, setPregunta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sin reseteo de estado acá a propósito: el llamador monta
  // `<PanelDetalle key={archivo.id}>`, así que cambiar de archivo REMONTA
  // todo este subárbol y el estado nace vacío solo. Un `setMensajes([])`
  // dentro del efecto sería redundante y además dispararía
  // `react-hooks/set-state-in-effect` — la misma regla y la misma solución
  // (remontar en vez de resetear) que ya se aplicó en el modal de Ajustes.
  useEffect(() => {
    let activo = true
    void cargarConversacionArchivo(archivoId).then((r) => {
      if (activo && r.ok) setMensajes(r.datos)
    })
    return () => {
      activo = false
    }
  }, [archivoId])

  async function enviar() {
    const texto = pregunta.trim()
    if (texto.length === 0 || enviando) return
    setEnviando(true)
    setError(null)
    const r = await preguntarSobreArchivo(archivoId, texto)
    setEnviando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setMensajes(r.datos.mensajes)
    setPregunta('')
  }

  if (!puedePreguntar) return null

  return (
    <Seccion Icono={MessageCircle} titulo="Conversación con IA">
      {mensajes.length > 0 && (
        <div className="space-y-2 mb-2.5 max-h-56 overflow-y-auto">
          {mensajes.map((m, i) => (
            <div
              key={`${m.en}-${i}`}
              className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${m.rol === 'usuario' ? 'bg-panel-2 text-paper' : 'bg-coral/10 text-muted'}`}
            >
              {m.rol === 'ia' && <Sparkles size={11} className="text-coral inline mr-1.5 -mt-0.5" />}
              {m.texto}
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void enviar()}
          disabled={enviando}
          placeholder="Pregunta algo sobre este archivo…"
          className="w-full rounded-xl bg-panel-2/60 pl-3 pr-10 py-2.5 text-[12px] text-paper placeholder:text-muted/60 outline-none focus:ring-1 focus:ring-coral/50 transition disabled:opacity-60"
        />
        <button
          onClick={() => void enviar()}
          disabled={enviando || pregunta.trim().length === 0}
          aria-label="Enviar pregunta"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-coral hover:bg-coral/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 text-[11px] text-danger leading-relaxed">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </Seccion>
  )
}
