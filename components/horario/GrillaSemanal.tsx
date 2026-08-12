'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Trash2, LogIn, LogOut, Coffee } from 'lucide-react'
import type { Materia } from '@/lib/types'
import type { BloqueHorario, DiaSemana, TipoBloqueHorario } from '@/lib/horario/tipos'
import { bloquesDeCelda, construirFilas, diasVisibles, etiquetaFranja } from '@/lib/horario/grilla'
import { formatearHora, type FormatoReloj } from '@/lib/hora'
import { usePreferencias } from '@/lib/preferencias'
import SegmentedToggle from '@/components/ui/SegmentedToggle'

const NOMBRE_DIA: Record<DiaSemana, { largo: string; corto: string; letra: string }> = {
  1: { largo: 'Lunes', corto: 'Lun', letra: 'L' },
  2: { largo: 'Martes', corto: 'Mar', letra: 'M' },
  3: { largo: 'Miércoles', corto: 'Mié', letra: 'X' },
  4: { largo: 'Jueves', corto: 'Jue', letra: 'J' },
  5: { largo: 'Viernes', corto: 'Vie', letra: 'V' },
  6: { largo: 'Sábado', corto: 'Sáb', letra: 'S' },
  7: { largo: 'Domingo', corto: 'Dom', letra: 'D' },
}

const COLOR_POR_DEFECTO = '#5C7FA6'

// Sub-sprint 8.3 — mismo lenguaje de entrada que AIImmersiveOverlay
// (columnaVariants: blur+fade+y, misma curva de easing) para que /horario
// se sienta parte de la misma app que /ai, no una pantalla aparte con su
// propio criterio de movimiento.
const ENTRADA_GRILLA = {
  initial: { opacity: 0, filter: 'blur(10px)', y: 10 },
  animate: { opacity: 1, filter: 'blur(0px)', y: 0 },
  transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
}

const EASE_DIA = [0.16, 1, 0.3, 1] as [number, number, number, number]

// Plantilla de columnas: móvil siempre "horas + 1 día"; desde `md`, "horas +
// N días". Se escriben como clases literales (no interpoladas) porque el JIT
// de Tailwind necesita verlas en el código para generarlas — y se resuelve
// por CSS y no por JS a propósito: con matchMedia haría falta un listener de
// resize y un render extra, cuando una media query hace exactamente esto sin
// JavaScript. Las celdas ocultas con `hidden` desaparecen del flujo del grid
// (display:none), así que el número de items siempre calza con las columnas.
const COLUMNAS_MOVIL = 'grid-cols-[76px_minmax(0,1fr)]'
const COLUMNAS_DESKTOP: Record<number, string> = {
  5: 'md:grid-cols-[100px_repeat(5,minmax(0,1fr))]',
  6: 'md:grid-cols-[100px_repeat(6,minmax(0,1fr))]',
  7: 'md:grid-cols-[100px_repeat(7,minmax(0,1fr))]',
}

function clasesDeColumnas(cantidadDias: number): string {
  return `${COLUMNAS_MOVIL} ${COLUMNAS_DESKTOP[cantidadDias] ?? COLUMNAS_DESKTOP[5]}`
}

/** Tinte de fondo de una celda a partir del color de la materia. Alpha en
 *  hex (8 dígitos) — deliberadamente bajo: en el horario de referencia las
 *  clases comparten un fondo tranquilo y el color solo sirve para
 *  reconocerlas, no para competir entre sí. */
function tinte(color: string | undefined, alphaHex: string): string {
  const base = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : COLOR_POR_DEFECTO
  return `${base}${alphaHex}`
}

// Sprint Zonas de horario — un bloque especial no tiene color de materia
// (no tiene materia), así que su distinción visual es un color FIJO propio
// por tipo + un ícono, no el punto de color que ya usan las clases. Verde
// para ingreso/salida (entrar/salir del día, tono afín al resto de "éxito"
// en la app — `success` del theme), coral para descanso — mismo tono que ya
// usa la fila "hueco" derivada, porque conceptualmente son la misma idea
// (un tramo sin clase), solo que uno es guardado y el otro inferido.
const ESPECIAL: Record<Exclude<TipoBloqueHorario, 'clase'>, { icono: typeof LogIn; label: string; color: string }> = {
  ingreso: { icono: LogIn, label: 'Ingreso', color: 'var(--color-success)' },
  salida: { icono: LogOut, label: 'Salida', color: 'var(--color-success)' },
  descanso: { icono: Coffee, label: 'Descanso', color: 'var(--color-coral)' },
}

type Props = {
  bloques: BloqueHorario[]
  materias: Materia[]
  cargando: boolean
  onQuitar: (id: string) => void
  onEditar: (bloque: BloqueHorario) => void
  // Modo invitado — importar por foto exige sesión y ese botón ya está
  // oculto en app/horario/page.tsx; sin este flag el estado vacío seguiría
  // invitando a una acción que no existe en la pantalla.
  invitado?: boolean
}

// Grilla semanal como TABLA real día × franja horaria: los días son columnas,
// los tramos de hora son filas, y la hora aparece UNA sola vez en la columna
// izquierda en vez de repetirse dentro de cada tarjeta. Reemplaza la versión
// anterior (siete columnas de tarjetas apiladas de forma independiente), en
// la que dos clases a la misma hora en días distintos no quedaban alineadas
// y la semana no se leía de un vistazo.
//
// Cero bordes duros (directiva global de globals.css): la separación entre
// celdas es por CONTRASTE DE SUPERFICIE y espaciado — `panel-2` para las
// celdas con clase, transparente para las vacías — nunca por líneas. Es la
// diferencia principal con un horario impreso, que sí se apoya en la
// cuadrícula dibujada.
export default function GrillaSemanal({ bloques, materias, cargando, onQuitar, onEditar, invitado }: Props) {
  const { formatoReloj } = usePreferencias()
  const filas = useMemo(() => construirFilas(bloques), [bloques])
  const dias = useMemo(() => diasVisibles(bloques), [bloques])
  const materiaPorId = useMemo(() => new Map(materias.map((m) => [m.id, m])), [materias])

  // Móvil: la tabla completa no cabe sin encoger las celdas a un tamaño
  // ilegible, así que se muestra UN día a la vez con el mismo selector que
  // ya usa el formulario de alta (SegmentedToggle) — se conserva la columna
  // de horas a la izquierda, que es lo que da la estructura. En >= md se
  // muestra la semana completa.
  const [diaMovil, setDiaMovil] = useState<DiaSemana>(1)
  const diaMovilVisible = dias.includes(diaMovil) ? diaMovil : dias[0]

  if (cargando) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-panel-glass backdrop-blur-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (filas.length === 0) {
    return (
      <motion.div {...ENTRADA_GRILLA} className="rounded-2xl bg-panel-glass backdrop-blur-xl p-8 text-center">
        <p className="text-paper text-sm mb-1">Todavía no tienes clases guardadas</p>
        <p className="text-muted text-xs">{invitado ? 'Agrega un bloque arriba.' : 'Agrega un bloque arriba o importa tu horario desde una foto.'}</p>
      </motion.div>
    )
  }

  return (
    <motion.div {...ENTRADA_GRILLA} className="rounded-2xl bg-panel-glass backdrop-blur-xl p-3 sm:p-4 overflow-x-auto">
      {/* Selector de día — solo móvil. */}
      <div className="md:hidden mb-3 flex justify-center">
        <SegmentedToggle
          options={dias.map((d) => ({ value: String(d), label: NOMBRE_DIA[d].letra }))}
          value={String(diaMovilVisible)}
          onChange={(v) => setDiaMovil(Number(v) as DiaSemana)}
        />
      </div>

      <TablaHorario
        filas={filas}
        dias={dias}
        diaMovil={diaMovilVisible}
        bloques={bloques}
        materiaPorId={materiaPorId}
        onQuitar={onQuitar}
        onEditar={onEditar}
        formato={formatoReloj}
      />
    </motion.div>
  )
}

function TablaHorario({
  filas,
  dias,
  diaMovil,
  bloques,
  materiaPorId,
  onQuitar,
  onEditar,
  formato,
}: {
  filas: ReturnType<typeof construirFilas>
  dias: DiaSemana[]
  diaMovil: DiaSemana
  bloques: BloqueHorario[]
  materiaPorId: Map<string, Materia>
  onQuitar: (id: string) => void
  onEditar: (bloque: BloqueHorario) => void
  formato: FormatoReloj
}) {
  // Una sola definición de columnas para encabezado y filas, así todo queda
  // alineado sin depender de <table> (que obligaría a pelear con el colapso
  // de bordes del navegador, justo lo que la directiva de cero bordes evita).
  const columnas = clasesDeColumnas(dias.length)

  return (
    <div className="min-w-[300px] md:min-w-[680px]">
      {/* Encabezado de días */}
      <div className={`grid gap-1.5 mb-1.5 ${columnas}`}>
        <div className="font-mono text-[10px] uppercase tracking-wide text-muted flex items-end pb-1 pl-1">Hora</div>
        {/* Móvil: solo el día seleccionado. Desktop: todos. Cambia con una
            transición (AnimatePresence) para que el nombre del día no salte
            de golpe cuando se toca otra letra en el selector. */}
        <div className="md:hidden overflow-hidden font-display text-xs font-semibold text-paper flex items-end pb-1">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={diaMovil}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22, ease: EASE_DIA }}
            >
              {NOMBRE_DIA[diaMovil].largo}
            </motion.span>
          </AnimatePresence>
        </div>
        {dias.map((d) => (
          <div key={d} className="hidden md:flex font-display text-xs font-semibold text-paper items-end pb-1 justify-center">
            <span className="lg:hidden">{NOMBRE_DIA[d].corto}</span>
            <span className="hidden lg:inline">{NOMBRE_DIA[d].largo}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {filas.map((fila, i) => (
          <motion.div
            key={fila.clave}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: Math.min(i * 0.025, 0.2) }}
          >
            {fila.tipo === 'hueco' ? (
              <FilaHueco horaInicio={fila.horaInicio} horaFin={fila.horaFin} formato={formato} />
            ) : (
              <FilaFranja
                etiqueta={etiquetaFranja(fila.franja, formato)}
                franja={fila.franja}
                dias={dias}
                diaMovil={diaMovil}
                bloques={bloques}
                materiaPorId={materiaPorId}
                onQuitar={onQuitar}
                onEditar={onEditar}
                columnas={columnas}
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Fila de descanso: el equivalente al "DESCANSO" del horario impreso, pero
// DERIVADO del espacio entre dos franjas (ver lib/horario/grilla.ts) — no es
// un bloque guardado. Se distingue en coral y ocupa todo el ancho, sin
// celdas por día, porque el descanso es de la semana entera, no de un día.
function FilaHueco({ horaInicio, horaFin, formato }: { horaInicio: string; horaFin: string; formato: FormatoReloj }) {
  return (
    <div className="rounded-xl bg-coral/10 px-3 py-1.5 flex items-center gap-2.5">
      <span className="font-mono text-[10px] text-coral/90 tabular-nums">
        {formatearHora(horaInicio, formato)} – {formatearHora(horaFin, formato)}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wide text-coral/70">Libre</span>
    </div>
  )
}

function FilaFranja({
  etiqueta,
  franja,
  dias,
  diaMovil,
  bloques,
  materiaPorId,
  onQuitar,
  onEditar,
  columnas,
}: {
  etiqueta: string
  franja: Parameters<typeof bloquesDeCelda>[2]
  dias: DiaSemana[]
  diaMovil: DiaSemana
  bloques: BloqueHorario[]
  materiaPorId: Map<string, Materia>
  onQuitar: (id: string) => void
  onEditar: (bloque: BloqueHorario) => void
  columnas: string
}) {
  return (
    <div className={`grid gap-1.5 ${columnas}`}>
      {/* Columna de horas: una sola vez por fila, no repetida por día. */}
      <div className="flex items-center rounded-xl bg-panel-2/40 px-2.5 py-2">
        <span className="font-display text-[11px] font-medium text-muted leading-tight tabular-nums">{etiqueta}</span>
      </div>

      {/* Móvil: solo la celda del día elegido, con la misma transición que
          el nombre del día en el encabezado (misma clave, mismo timing). */}
      <div className="md:hidden overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={diaMovil}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.22, ease: EASE_DIA }}
          >
            <Celda bloques={bloquesDeCelda(bloques, diaMovil, franja)} materiaPorId={materiaPorId} onQuitar={onQuitar} onEditar={onEditar} />
          </motion.div>
        </AnimatePresence>
      </div>

      {dias.map((d) => (
        <div key={d} className="hidden md:block">
          <Celda bloques={bloquesDeCelda(bloques, d, franja)} materiaPorId={materiaPorId} onQuitar={onQuitar} onEditar={onEditar} />
        </div>
      ))}
    </div>
  )
}

// Celda = una materia (o varias, si el usuario tiene un choque de horario).
// Vacía se ve claramente vacía pero NO como un error: superficie apenas
// insinuada, sin texto ni icono de alerta.
function Celda({
  bloques,
  materiaPorId,
  onQuitar,
  onEditar,
}: {
  bloques: BloqueHorario[]
  materiaPorId: Map<string, Materia>
  onQuitar: (id: string) => void
  onEditar: (bloque: BloqueHorario) => void
}) {
  if (bloques.length === 0) {
    return <div className="h-full min-h-[46px] rounded-xl bg-panel-2/15" />
  }

  return (
    <div className="flex flex-col gap-1 h-full">
      {bloques.map((b) => {
        if (b.tipo !== 'clase') {
          const { icono: Icono, label, color } = ESPECIAL[b.tipo]
          return (
            <div
              key={b.id}
              onClick={() => onEditar(b)}
              title="Clic para editar"
              className="group relative flex items-center min-h-[46px] rounded-xl px-2.5 py-2 transition-colors cursor-pointer"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
            >
              <Icono size={13} style={{ color }} className="flex-shrink-0 mr-2" />
              <span className="flex-1 min-w-0 text-[13px] leading-tight text-paper break-words">{label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onQuitar(b.id)
                }}
                title={`Quitar ${label}`}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted hover:text-danger transition p-1 flex-shrink-0 -mr-1"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        }

        const materia = b.materiaId ? materiaPorId.get(b.materiaId) : undefined
        return (
          <div
            key={b.id}
            onClick={() => onEditar(b)}
            title="Clic para editar"
            className="group relative flex items-center min-h-[46px] rounded-xl px-2.5 py-2 transition-colors cursor-pointer"
            style={{ backgroundColor: tinte(materia?.color, '2E') }}
          >
            <span
              className="w-1 self-stretch rounded-full flex-shrink-0 mr-2"
              style={{ backgroundColor: materia?.color ?? COLOR_POR_DEFECTO }}
            />
            <span className="flex-1 min-w-0 text-[13px] leading-tight text-paper break-words">{materia?.nombre ?? '—'}</span>
            <button
              onClick={(e) => {
                // Sin esto, el clic en "quitar" también dispararía onEditar
                // (el botón vive DENTRO de la fila que ahora abre el modal).
                e.stopPropagation()
                onQuitar(b.id)
              }}
              title={`Quitar ${materia?.nombre ?? 'bloque'}`}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted hover:text-danger transition p-1 flex-shrink-0 -mr-1"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
