'use client'

import { CalendarClock, Clock, StickyNote } from 'lucide-react'
import type { TareaProxima, ProximaClase } from '@/lib/estadisticas/pulso'
import type { Nota } from '@/lib/notas/tipos'
import { IconoMateria } from '@/components/ui/iconosMateria'
import MagicBentoCard from '@/components/reactbits/MagicBento'

type Props = {
  tareas: TareaProxima[]
  hoy: string
  proximaClase?: ProximaClase
  // Parte D — notas ancladas al bloque de `proximaClase`, si tiene. Lista
  // vacía (no undefined) cuando no hay ninguna: así el componente nunca
  // necesita distinguir "todavía no cargó" de "no tiene notas", ninguna de
  // las dos fuerza una sección vacía.
  notasProximaClase?: Nota[]
  className?: string
}

// Fila compacta: sin editar inline, sin borrar — esas acciones ya existen
// en TaskTable, más abajo en la misma página. Copia la paleta EXACTA de
// TaskRow.tsx (mismos tokens `text-danger`/`text-coral`/`text-muted`) para
// que "hoy"/"vencida" se lean igual en las dos vistas, sin forzar TaskRow a
// tener un segundo modo compacto que no necesita.
function fechaRelativa(fechaISO: string, hoy: string): { texto: string; clase: string } {
  if (fechaISO === hoy) return { texto: 'Hoy', clase: 'text-coral' }
  if (fechaISO < hoy) return { texto: 'Vencida', clase: 'text-danger' }
  // Mañana: mismo criterio simple que el resto de la app, sin aritmética
  // de fechas nueva — una comparación de string alcanza para "es la
  // próxima fecha calendario después de hoy", y quien quiera el detalle
  // exacto ("en 3 días") lo tiene en TaskTable.
  return { texto: fechaISO.slice(5).replace('-', '/'), clase: 'text-muted' }
}

// Sprint Home (rediseño bento) — absorbe la "próxima clase" que antes vivía
// dentro del botón de horario en AccesosRapidos.tsx: ahora esta es LA
// tarjeta "Hoy" (dato vivo del día — próxima clase + próximas tareas),
// mientras AccesosRapidos queda como navegación pura (sin dato en vivo).
// `proximaClaseHoy()` no se tocó, solo cambió qué componente la renderiza.
export default function ProximasTareas({ tareas, hoy, proximaClase, notasProximaClase, className }: Props) {
  return (
    <MagicBentoCard className={className ?? 'h-full'}>
      <div className="p-4 sm:p-5 h-full">
        <p className="font-display text-sm font-semibold text-paper mb-3 flex items-center gap-1.5">
          <CalendarClock size={14} className="text-coral" />
          Hoy
        </p>

        {proximaClase && (
          // Separación por bloque de color, no por línea — la directiva
          // global de globals.css anula cualquier `border-*` a propósito
          // (cero bordes duros en todo el proyecto, ver AGENTS.md/CLAUDE.md).
          <div className="mb-3 px-2.5 py-2 rounded-xl bg-coral/10 text-xs">
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-coral flex-shrink-0" />
              <span className="text-paper truncate">
                {proximaClase.materiaNombre} en {proximaClase.minutosHasta} min
                {proximaClase.bloque.aula ? ` · ${proximaClase.bloque.aula}` : ''}
              </span>
            </div>

            {/* Parte D — si el bloque tiene notas, la más reciente se
                muestra acá mismo, sin que el usuario tenga que ir a
                buscarla. Varias notas: solo la primera (ya viene ordenada
                por más reciente desde el backend, GET /api/notas ordena
                por updated_at desc) + un indicador de cuántas más hay, para
                no saturar una tarjeta que también muestra próximas tareas. */}
            {notasProximaClase && notasProximaClase.length > 0 && (
              <div className="flex items-start gap-1.5 mt-1.5 pt-1.5">
                <StickyNote size={11} className="text-coral/70 flex-shrink-0 mt-0.5" />
                <p className="text-paper/80 text-[11px] leading-snug line-clamp-2">
                  {notasProximaClase[0].contenido}
                  {notasProximaClase.length > 1 && <span className="text-muted"> · +{notasProximaClase.length - 1} más</span>}
                </p>
              </div>
            )}
          </div>
        )}

        {tareas.length === 0 ? (
          <p className="text-muted text-xs">Nada urgente por ahora ✨</p>
        ) : (
          <div className="flex flex-col gap-1">
            {tareas.map(({ tarea, materia }) => {
              const info = fechaRelativa(tarea.fecha_entrega as string, hoy)
              return (
                <div key={tarea.id} className="flex items-center gap-2.5 py-1.5">
                  <IconoMateria icono={materia?.icono} size={13} className="flex-shrink-0" style={{ color: materia?.color ?? '#5C7FA6' }} />
                  <span className="text-sm text-paper truncate flex-1">{tarea.titulo}</span>
                  <span className={`text-[11px] font-mono flex-shrink-0 ${info.clase}`}>{info.texto}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </MagicBentoCard>
  )
}
