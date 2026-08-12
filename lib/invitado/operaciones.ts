import type { Materia, Tarea } from '@/lib/types'
import type { BloqueHorario, DiaSemana, TipoBloqueHorario } from '@/lib/horario/tipos'
import { normalizarNombreMateria } from '@/lib/horario/diff'
import { asignarIconoDeterministico, ICONO_POR_DEFECTO } from '@/lib/materias/asignarIcono'
import type { DatosInvitado } from './tipos'

// Mismos 6 colores que `SUBJECT_COLORS` en lib/server/materias.ts — no se
// importa de ahí porque ese archivo es server-only (usa supabaseServer con
// la service role key); lib/invitado/* se empaqueta en el bundle del
// cliente, y arrastrar ese import filtraría un módulo server-only al
// navegador. Duplicar 6 strings hexadecimales es más seguro que ese riesgo.
const COLORES_MATERIA = ['#FF6B4D', '#6E8F6A', '#C9973F', '#5C7FA6', '#8B6F9E', '#4A8B8B']

// Funciones PURAS: `(datos, ...) => nuevoDatos`, sin tocar localStorage.
// Mismo criterio que lib/realtimeReconciliar.ts — separar la lógica del I/O
// permite testear en el entorno 'node' por defecto de Vitest, sin añadir
// jsdom como dependencia nueva solo para esto.

export function crearMateriaPura(datos: DatosInvitado, nombre: string): { datos: DatosInvitado; materia: Materia } {
  const nombreLimpio = nombre.trim()
  const normalizado = normalizarNombreMateria(nombreLimpio)
  const existente = datos.materias.find((m) => normalizarNombreMateria(m.nombre) === normalizado)
  if (existente) return { datos, materia: existente }

  const materia: Materia = {
    id: crypto.randomUUID(),
    nombre: nombreLimpio,
    color: COLORES_MATERIA[datos.materias.length % COLORES_MATERIA.length],
    icono: asignarIconoDeterministico(nombreLimpio) ?? ICONO_POR_DEFECTO,
  }
  return { datos: { ...datos, materias: [...datos.materias, materia] }, materia }
}

export type NuevaTareaInvitadoInput = {
  titulo: string
  materiaId: string | null
  nuevaMateria: string | null
  fecha: string
  prioridad: string
  tipo?: string
}

export type CrearTareaPuraResultado =
  | { ok: true; datos: DatosInvitado; tarea: Tarea; materiaCreada: Materia | null }
  | { ok: false; error: string }

export function crearTareaPura(datos: DatosInvitado, input: NuevaTareaInvitadoInput): CrearTareaPuraResultado {
  let datosActuales = datos
  let materiaId = input.materiaId
  let materiaCreada: Materia | null = null

  if (!materiaId && input.nuevaMateria) {
    const normalizado = normalizarNombreMateria(input.nuevaMateria)
    const yaExistia = datosActuales.materias.some((m) => normalizarNombreMateria(m.nombre) === normalizado)
    const resultado = crearMateriaPura(datosActuales, input.nuevaMateria)
    datosActuales = resultado.datos
    materiaId = resultado.materia.id
    if (!yaExistia) materiaCreada = resultado.materia
  }

  if (!materiaId) return { ok: false, error: 'La tarea necesita una materia' }

  const tarea: Tarea = {
    id: crypto.randomUUID(),
    titulo: input.titulo,
    materia_id: materiaId,
    fecha_entrega: input.fecha || null,
    prioridad: input.prioridad,
    completada: false,
    tipo: input.tipo ?? 'otro',
    temario: null,
    formato: null,
    peso: null,
    completada_en: null,
  }

  return { ok: true, datos: { ...datosActuales, tareas: [...datosActuales.tareas, tarea] }, tarea, materiaCreada }
}

export type CambiosTareaInvitado = {
  completada?: boolean
  titulo?: string
  materiaId?: string | null
  nuevaMateria?: string | null
  fecha?: string
  prioridad?: string
  tipo?: string
}

export function actualizarTareaPura(datos: DatosInvitado, id: string, cambios: CambiosTareaInvitado): { datos: DatosInvitado; tarea: Tarea } | null {
  const idx = datos.tareas.findIndex((t) => t.id === id)
  if (idx === -1) return null
  const actual = datos.tareas[idx]

  let datosActuales = datos
  let materiaId = actual.materia_id
  if (cambios.nuevaMateria) {
    const resultado = crearMateriaPura(datosActuales, cambios.nuevaMateria)
    datosActuales = resultado.datos
    materiaId = resultado.materia.id
  } else if (cambios.materiaId) {
    materiaId = cambios.materiaId
  }

  // Mismo criterio que PATCH /api/tareas/[id]: `completada_en` se pone al
  // pasar a completada por primera vez, se conserva si ya lo estaba (no se
  // pisa con un segundo toggle), y se limpia a null si vuelve a pendiente.
  const completada = cambios.completada ?? actual.completada
  const completada_en = completada ? (actual.completada ? actual.completada_en : new Date().toISOString()) : null

  const tarea: Tarea = {
    ...actual,
    titulo: cambios.titulo ?? actual.titulo,
    materia_id: materiaId,
    fecha_entrega: cambios.fecha !== undefined ? cambios.fecha || null : actual.fecha_entrega,
    prioridad: cambios.prioridad ?? actual.prioridad,
    tipo: cambios.tipo ?? actual.tipo,
    completada,
    completada_en,
  }

  const tareasNuevas = [...datosActuales.tareas]
  tareasNuevas[idx] = tarea
  return { datos: { ...datosActuales, tareas: tareasNuevas }, tarea }
}

export function eliminarTareaPura(datos: DatosInvitado, id: string): { datos: DatosInvitado; tareaEliminada: Tarea } | null {
  const tarea = datos.tareas.find((t) => t.id === id)
  if (!tarea) return null
  return { datos: { ...datos, tareas: datos.tareas.filter((t) => t.id !== id) }, tareaEliminada: tarea }
}

export type NuevoBloqueInvitadoInput = {
  // Sprint Zonas de horario — mismo default 'clase' que crearBloqueHorarioSchema.
  tipo?: TipoBloqueHorario
  materiaId: string | null
  diaSemana: DiaSemana
  horaInicio: string | null
  horaFin: string | null
}

export function agregarBloquePura(datos: DatosInvitado, input: NuevoBloqueInvitadoInput): { datos: DatosInvitado; bloque: BloqueHorario } {
  const bloque: BloqueHorario = {
    id: crypto.randomUUID(),
    tipo: input.tipo ?? 'clase',
    materiaId: input.materiaId,
    diaSemana: input.diaSemana,
    horaInicio: input.horaInicio,
    horaFin: input.horaFin,
    aula: null,
    profesor: null,
  }
  return { datos: { ...datos, horario: [...datos.horario, bloque] }, bloque }
}

export type CambiosBloqueInvitado = {
  tipo?: TipoBloqueHorario
  materiaId?: string | null
  horaInicio?: string | null
  horaFin?: string | null
  aula?: string | null
  profesor?: string | null
}

export function actualizarBloquePura(datos: DatosInvitado, id: string, cambios: CambiosBloqueInvitado): { datos: DatosInvitado; bloque: BloqueHorario } | null {
  const idx = datos.horario.findIndex((b) => b.id === id)
  if (idx === -1) return null
  const bloque: BloqueHorario = { ...datos.horario[idx], ...cambios }
  const horarioNuevo = [...datos.horario]
  horarioNuevo[idx] = bloque
  return { datos: { ...datos, horario: horarioNuevo }, bloque }
}

export function eliminarBloquePura(datos: DatosInvitado, id: string): DatosInvitado | null {
  if (!datos.horario.some((b) => b.id === id)) return null
  return { ...datos, horario: datos.horario.filter((b) => b.id !== id) }
}
