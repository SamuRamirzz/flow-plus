import type { BloqueHorario, DiaSemana } from './tipos'
import type { BloquePropuesto, DiffHorario } from './diff'
import { normalizarNombreMateria } from './diff'

// PURO — sin I/O. Complementa diffHorario (que empareja por MATERIA+día,
// para saber si una materia se movió de hora) con un emparejamiento por
// FRANJA (día+hora): ¿esta franja horaria ahora tiene una materia distinta
// a la que ya tenía guardada? Eso es lo que "conflicto" significa en una
// fusión — dos horarios que no coinciden en qué se dicta a esa hora, no
// simplemente "algo cambió".
export type ConflictoFusion = {
  dia: DiaSemana
  horaInicio: string | null
  horaFin: string | null
  existente: BloqueHorario
  propuesto: BloquePropuesto
}

export type DecisionConflicto = 'existente' | 'propuesto'

// Sin hora en ninguno de los dos lados no cuenta como choque real de
// horario: no hay una franja de tiempo concreta que se esté solapando, solo
// dos bloques "sin hora" que coinciden en eso.
function franjaValida(horaInicio: string | null, horaFin: string | null): boolean {
  return horaInicio !== null || horaFin !== null
}

// Identidad ESTRUCTURAL de un BloquePropuesto, no por referencia de objeto.
// Verificado en pruebas reales en navegador (no solo lectura de código): el
// `diff`/`salida.bloques` que recibe ResolverImportacion vienen de un
// fetch() → JSON.parse(), así que aunque `diff.agregados[i]` y
// `conflicto.propuesto` describan EL MISMO bloque, son dos objetos
// distintos tras la serialización — un Set<BloquePropuesto> por referencia
// nunca los reconoce como iguales. Usar esto en vez de eso es lo que evita
// que un conflicto resuelto a favor de lo propuesto se aplique DOS veces
// (una vez como actualizarMateria y otra como crear un bloque duplicado).
function clavePropuesto(b: BloquePropuesto): string {
  return `${normalizarNombreMateria(b.materia)}|${b.diaSemana}|${b.horaInicio ?? ''}|${b.horaFin ?? ''}`
}

export function detectarConflictosFusion(input: {
  guardado: BloqueHorario[]
  propuesto: BloquePropuesto[]
  nombrePorMateriaId: Map<string, string>
}): ConflictoFusion[] {
  const { guardado, propuesto, nombrePorMateriaId } = input
  const conflictos: ConflictoFusion[] = []

  for (const p of propuesto) {
    if (!franjaValida(p.horaInicio, p.horaFin)) continue

    for (const g of guardado) {
      if (g.diaSemana !== p.diaSemana) continue
      if (g.horaInicio !== p.horaInicio || g.horaFin !== p.horaFin) continue

      const nombreExistente = nombrePorMateriaId.get(g.materiaId)
      if (!nombreExistente) continue // materia desconocida: no se puede comparar, se ignora

      if (normalizarNombreMateria(nombreExistente) === normalizarNombreMateria(p.materia)) continue // misma materia → no es un conflicto, es la misma clase

      conflictos.push({ dia: g.diaSemana, horaInicio: g.horaInicio, horaFin: g.horaFin, existente: g, propuesto: p })
    }
  }

  return conflictos
}

export type PlanFusion = {
  /** Bloques nuevos a crear — los `agregados` del diff que NO fueron rechazados por un conflicto. */
  crear: BloquePropuesto[]
  /** Bloques existentes cuyo horario cambió — los `movidos` del diff. */
  actualizarHora: { id: string; horaInicio: string | null; horaFin: string | null }[]
  /** Bloques existentes cuya materia cambia porque el usuario eligió "usar el nuevo" en un conflicto. */
  actualizarMateria: { id: string; materia: string }[]
}

// PURA — traduce (diff + conflictos + decisión del usuario por conflicto) a
// un plan de escritura concreto. No ejecuta nada: lib/horario/
// aplicarImportacion.ts es quien de verdad llama a los endpoints con este
// plan como entrada.
//
// La clave para identificar la decisión de un conflicto es el id del bloque
// EXISTENTE: un bloque guardado solo puede tener un horario, así que como
// mucho choca con un propuesto por franja.
export function construirPlanFusion(input: {
  diff: DiffHorario
  conflictos: ConflictoFusion[]
  decisiones: Record<string, DecisionConflicto>
}): PlanFusion {
  const { diff, conflictos, decisiones } = input

  // Un `agregado` del diff que además es el lado "propuesto" de un
  // conflicto NUNCA se crea como bloque nuevo, sin importar la decisión: si
  // gana lo existente, no hay nada que hacer; si gana lo propuesto, se
  // aplica como actualizarMateria sobre el bloque YA existente en esa
  // franja, no como una creación aparte (crear + actualizar produciría dos
  // bloques distintos ocupando la misma franja). Comparado por CLAVE
  // ESTRUCTURAL, no por referencia — ver el comentario de clavePropuesto().
  const clavesEnConflicto = new Set(conflictos.map((c) => clavePropuesto(c.propuesto)))

  const idsEnConflicto = new Set(conflictos.map((c) => c.existente.id))

  return {
    crear: diff.agregados.filter((b) => !clavesEnConflicto.has(clavePropuesto(b))),
    actualizarHora: diff.movidos
      .filter((m) => !idsEnConflicto.has(m.antes.id))
      .map((m) => ({ id: m.antes.id, horaInicio: m.despues.horaInicio, horaFin: m.despues.horaFin })),
    actualizarMateria: conflictos
      .filter((c) => decisiones[c.existente.id] === 'propuesto')
      .map((c) => ({ id: c.existente.id, materia: c.propuesto.materia })),
  }
}
