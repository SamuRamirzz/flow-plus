import { crearMateria } from '@/lib/tasks'
import type { Materia } from '@/lib/types'
import type { BloqueHorario } from './tipos'
import type { BloquePropuesto } from './diff'
import { crearBloqueHorario, actualizarBloqueHorario, eliminarBloqueHorario } from './mutar'

// Impuro (I/O real contra los endpoints ya existentes) — el "qué hacer" vive
// en lib/horario/conflictos.ts (puro, testeado); esto es solo el "cómo",
// compartido por los tres caminos de importar una foto sobre un horario
// existente (reemplazar todo / fusionar) y por el alta manual de siempre
// (confirmarPropuesta en app/horario/page.tsx), para no repetir la
// resolución de materia en cada uno.

export type ResultadoAplicar = { materiasActuales: Materia[]; aplicados: number; errores: string[] }

function agregarMateriaSiNueva(materiasActuales: Materia[], materia: Materia): Materia[] {
  return materiasActuales.some((m) => m.id === materia.id) ? materiasActuales : [...materiasActuales, materia]
}

// Resuelve la materia (existente por nombre, o nueva) y crea el bloque —
// mismo camino que ya usaba confirmarPropuesta() para diff.agregados.
//
// Sprint Zonas de horario — un bloque especial (ingreso/salida/descanso)
// NUNCA llama a crearMateria(): b.materia es el sentinel `''` (ver el
// comentario de BloquePropuesto en diff.ts), y crear una materia real
// llamada "" sería el mismo tipo de contaminación del picker de materias
// que este sprint entero busca eliminar.
async function crearDesdePropuesto(
  b: BloquePropuesto,
  materiasActuales: Materia[]
): Promise<{ ok: true; materiasActuales: Materia[] } | { ok: false; error: string }> {
  const tipo = b.tipo ?? 'clase'

  if (tipo !== 'clase') {
    const resBloque = await crearBloqueHorario({
      tipo,
      materiaId: null,
      diaSemana: b.diaSemana,
      horaInicio: b.horaInicio,
      horaFin: b.horaFin,
    })
    if (!resBloque.ok) return { ok: false, error: resBloque.error }
    return { ok: true, materiasActuales }
  }

  const resMateria = await crearMateria(b.materia)
  if (!resMateria.ok) return { ok: false, error: `No se pudo crear la materia "${b.materia}"` }

  const resBloque = await crearBloqueHorario({
    tipo: 'clase',
    materiaId: resMateria.materia.id,
    diaSemana: b.diaSemana,
    horaInicio: b.horaInicio,
    horaFin: b.horaFin,
  })
  if (!resBloque.ok) return { ok: false, error: resBloque.error }

  return { ok: true, materiasActuales: agregarMateriaSiNueva(materiasActuales, resMateria.materia) }
}

export async function aplicarCreaciones(bloques: BloquePropuesto[], materiasIniciales: Materia[]): Promise<ResultadoAplicar> {
  let materiasActuales = materiasIniciales
  let aplicados = 0
  const errores: string[] = []
  for (const b of bloques) {
    const r = await crearDesdePropuesto(b, materiasActuales)
    if (!r.ok) {
      errores.push(r.error)
      continue
    }
    materiasActuales = r.materiasActuales
    aplicados++
  }
  return { materiasActuales, aplicados, errores }
}

export async function aplicarCambiosHora(
  cambios: { id: string; horaInicio: string | null; horaFin: string | null }[]
): Promise<{ aplicados: number; errores: string[] }> {
  let aplicados = 0
  const errores: string[] = []
  for (const c of cambios) {
    const r = await actualizarBloqueHorario(c.id, { horaInicio: c.horaInicio, horaFin: c.horaFin })
    if (!r.ok) {
      errores.push(r.error)
      continue
    }
    aplicados++
  }
  return { aplicados, errores }
}

// Conflicto resuelto a favor de lo propuesto: el bloque YA existe en esa
// franja, solo cambia de materia — nunca se crea uno nuevo (ver el
// comentario de construirPlanFusion sobre por qué `crear` y
// `actualizarMateria` son mutuamente excluyentes).
export async function aplicarCambiosMateria(
  cambios: { id: string; materia: string }[],
  materiasIniciales: Materia[]
): Promise<ResultadoAplicar> {
  let materiasActuales = materiasIniciales
  let aplicados = 0
  const errores: string[] = []
  for (const c of cambios) {
    const resMateria = await crearMateria(c.materia)
    if (!resMateria.ok) {
      errores.push(`No se pudo resolver la materia "${c.materia}"`)
      continue
    }
    materiasActuales = agregarMateriaSiNueva(materiasActuales, resMateria.materia)

    const r = await actualizarBloqueHorario(c.id, { materiaId: resMateria.materia.id })
    if (!r.ok) {
      errores.push(r.error)
      continue
    }
    aplicados++
  }
  return { materiasActuales, aplicados, errores }
}

// Usado por "Limpiar horario" (Parte B) y por "Reemplazar todo" al importar
// (Parte C, antes de crear los bloques nuevos) — un solo lugar que borra
// todos los bloques del usuario en paralelo.
export async function limpiarTodosLosBloques(bloques: BloqueHorario[]): Promise<{ errores: string[] }> {
  const errores: string[] = []
  await Promise.all(
    bloques.map(async (b) => {
      const r = await eliminarBloqueHorario(b.id)
      if (!r.ok) errores.push(r.error)
    })
  )
  return { errores }
}
