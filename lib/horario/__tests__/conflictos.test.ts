import { describe, expect, it } from 'vitest'
import { detectarConflictosFusion, construirPlanFusion, type ConflictoFusion, type DecisionConflicto } from '../conflictos'
import type { BloqueHorario } from '../tipos'
import type { BloquePropuesto, DiffHorario } from '../diff'

const MAT_FISICA = 'mat-fisica'
const MAT_QUIMICA = 'mat-quimica'

const nombres = new Map([
  [MAT_FISICA, 'Física I'],
  [MAT_QUIMICA, 'Química'],
])

function guardado(overrides: Partial<BloqueHorario> = {}): BloqueHorario {
  return { id: 'g1', materiaId: MAT_FISICA, diaSemana: 1, horaInicio: '07:00', horaFin: '09:00', aula: null, profesor: null, ...overrides }
}

function propuesto(overrides: Partial<BloquePropuesto> = {}): BloquePropuesto {
  return { materia: 'Química', diaSemana: 1, horaInicio: '07:00', horaFin: '09:00', aula: null, confidence: 0.9, ...overrides }
}

describe('detectarConflictosFusion', () => {
  it('misma franja (día+hora), materia distinta → conflicto', () => {
    const conflictos = detectarConflictosFusion({ guardado: [guardado()], propuesto: [propuesto()], nombrePorMateriaId: nombres })
    expect(conflictos).toHaveLength(1)
    expect(conflictos[0].existente.materiaId).toBe(MAT_FISICA)
    expect(conflictos[0].propuesto.materia).toBe('Química')
  })

  it('misma franja, MISMA materia (con distinto acento/mayúscula) → no es conflicto', () => {
    const conflictos = detectarConflictosFusion({
      guardado: [guardado()],
      propuesto: [propuesto({ materia: 'física i' })],
      nombrePorMateriaId: nombres,
    })
    expect(conflictos).toHaveLength(0)
  })

  it('día distinto → no hay conflicto aunque la hora coincida', () => {
    const conflictos = detectarConflictosFusion({
      guardado: [guardado({ diaSemana: 1 })],
      propuesto: [propuesto({ diaSemana: 2 })],
      nombrePorMateriaId: nombres,
    })
    expect(conflictos).toHaveLength(0)
  })

  it('hora distinta → no hay conflicto aunque el día coincida', () => {
    const conflictos = detectarConflictosFusion({
      guardado: [guardado({ horaInicio: '07:00', horaFin: '09:00' })],
      propuesto: [propuesto({ horaInicio: '10:00', horaFin: '12:00' })],
      nombrePorMateriaId: nombres,
    })
    expect(conflictos).toHaveLength(0)
  })

  it('ambos sin hora → no cuenta como choque real de horario', () => {
    const conflictos = detectarConflictosFusion({
      guardado: [guardado({ horaInicio: null, horaFin: null })],
      propuesto: [propuesto({ horaInicio: null, horaFin: null })],
      nombrePorMateriaId: nombres,
    })
    expect(conflictos).toHaveLength(0)
  })

  it('materia del bloque guardado desconocida (no está en el mapa) → se ignora, no revienta', () => {
    const conflictos = detectarConflictosFusion({
      guardado: [guardado({ materiaId: 'materia-borrada' })],
      propuesto: [propuesto()],
      nombrePorMateriaId: nombres,
    })
    expect(conflictos).toHaveLength(0)
  })

  it('varios propuestos, solo uno choca → se reporta solo ese', () => {
    const conflictos = detectarConflictosFusion({
      guardado: [guardado()],
      propuesto: [propuesto({ materia: 'Física I' }), propuesto({ materia: 'Química', diaSemana: 3 }), propuesto({ materia: 'Química' })],
      nombrePorMateriaId: nombres,
    })
    expect(conflictos).toHaveLength(1)
    expect(conflictos[0].propuesto.diaSemana).toBe(1)
  })
})

describe('construirPlanFusion', () => {
  const agregadoLibre = propuesto({ materia: 'Historia', diaSemana: 4, horaInicio: '14:00', horaFin: '16:00' })
  const conflictoPropuesto = propuesto({ materia: 'Química', diaSemana: 1, horaInicio: '07:00', horaFin: '09:00' })
  const conflictoExistente = guardado({ id: 'g-conflicto', materiaId: MAT_FISICA, diaSemana: 1, horaInicio: '07:00', horaFin: '09:00' })
  const movidoAntes = guardado({ id: 'g-movido', materiaId: MAT_FISICA, diaSemana: 5, horaInicio: '08:00', horaFin: '10:00' })
  const movidoDespues = propuesto({ materia: 'Física I', diaSemana: 5, horaInicio: '09:00', horaFin: '11:00' })

  const diff: DiffHorario = {
    agregados: [agregadoLibre, conflictoPropuesto],
    movidos: [{ antes: movidoAntes, despues: movidoDespues }],
    sinCambios: [],
    eliminados: [],
  }

  const conflicto: ConflictoFusion = {
    dia: 1,
    horaInicio: '07:00',
    horaFin: '09:00',
    existente: conflictoExistente,
    propuesto: conflictoPropuesto,
  }

  it('sin conflictos: crear = agregados, actualizarHora = movidos, actualizarMateria vacío', () => {
    const plan = construirPlanFusion({ diff: { ...diff, agregados: [agregadoLibre] }, conflictos: [], decisiones: {} })
    expect(plan.crear).toEqual([agregadoLibre])
    expect(plan.actualizarHora).toEqual([{ id: 'g-movido', horaInicio: '09:00', horaFin: '11:00' }])
    expect(plan.actualizarMateria).toEqual([])
  })

  it('conflicto resuelto a favor de lo EXISTENTE: no se crea ni se actualiza nada de ese bloque', () => {
    const decisiones: Record<string, DecisionConflicto> = { [conflictoExistente.id]: 'existente' }
    const plan = construirPlanFusion({ diff, conflictos: [conflicto], decisiones })
    expect(plan.crear).toEqual([agregadoLibre]) // el agregado libre sí se crea; el del conflicto NO
    expect(plan.actualizarMateria).toEqual([])
  })

  it('conflicto resuelto a favor de lo PROPUESTO: actualiza la materia del bloque existente, y NO además lo crea como bloque nuevo', () => {
    const decisiones: Record<string, DecisionConflicto> = { [conflictoExistente.id]: 'propuesto' }
    const plan = construirPlanFusion({ diff, conflictos: [conflicto], decisiones })
    expect(plan.actualizarMateria).toEqual([{ id: 'g-conflicto', materia: 'Química' }])
    // Este es el bug que se evitó: el propuesto del conflicto NO debe aparecer en `crear`.
    expect(plan.crear).toEqual([agregadoLibre])
    expect(plan.crear).not.toContain(conflictoPropuesto)
  })

  // Bug real encontrado probando en navegador (no solo hipotético): en la
  // app de verdad, `diff`/`salida.bloques` llegan a ResolverImportacion
  // desde un fetch() → JSON.parse(). Aunque `diff.agregados[i]` y
  // `conflicto.propuesto` describan EL MISMO bloque, dejan de ser el MISMO
  // objeto — comparar por referencia (`Set<BloquePropuesto>`) no los
  // reconocía como iguales, y el conflicto resuelto a favor de lo propuesto
  // terminaba creándose COMO ADEMÁS de actualizarse, duplicando el bloque.
  it('conflicto resuelto a favor de lo propuesto, con `diff.agregados` como una copia estructural (no la misma referencia) — mismo bug que produce un fetch() real', () => {
    const copiaEstructural: BloquePropuesto = JSON.parse(JSON.stringify(conflictoPropuesto))
    expect(copiaEstructural).not.toBe(conflictoPropuesto) // referencias distintas, mismo contenido — la condición real del bug

    const diffConCopia: DiffHorario = { ...diff, agregados: [agregadoLibre, copiaEstructural] }
    const decisiones: Record<string, DecisionConflicto> = { [conflictoExistente.id]: 'propuesto' }
    const plan = construirPlanFusion({ diff: diffConCopia, conflictos: [conflicto], decisiones })

    expect(plan.actualizarMateria).toEqual([{ id: 'g-conflicto', materia: 'Química' }])
    expect(plan.crear).toEqual([agregadoLibre]) // la copia NO debe colarse en crear
  })

  it('un conflicto sin decisión todavía no se aplica de ninguna forma (ni crea ni actualiza)', () => {
    const plan = construirPlanFusion({ diff, conflictos: [conflicto], decisiones: {} })
    expect(plan.crear).not.toContain(conflictoPropuesto)
    expect(plan.actualizarMateria).toEqual([])
  })
})
