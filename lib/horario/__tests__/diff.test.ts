import { describe, expect, it } from 'vitest'
import { diffHorario, diffTieneCambios, detectarMateriasNuevas, normalizarNombreMateria, type BloquePropuesto } from '../diff'
import type { BloqueHorario } from '../tipos'

const MAT_CALCULO = 'mat-calculo'
const MAT_FISICA = 'mat-fisica'

const nombres = new Map([
  [MAT_CALCULO, 'Cálculo II'],
  [MAT_FISICA, 'Física I'],
])

function guardado(overrides: Partial<BloqueHorario> = {}): BloqueHorario {
  return { id: 'b1', tipo: 'clase', materiaId: MAT_CALCULO, diaSemana: 1, horaInicio: '07:00', horaFin: '09:00', aula: null, profesor: null, ...overrides }
}

function propuesto(overrides: Partial<BloquePropuesto> = {}): BloquePropuesto {
  return { materia: 'Cálculo II', diaSemana: 1, horaInicio: '07:00', horaFin: '09:00', aula: 'A301', confidence: 0.9, ...overrides }
}

describe('normalizarNombreMateria', () => {
  it('quita acentos, baja a minúsculas y colapsa espacios', () => {
    expect(normalizarNombreMateria('  Cálculo   II ')).toBe('calculo ii')
  })

  it('dos escrituras del mismo nombre colapsan al mismo valor', () => {
    expect(normalizarNombreMateria('Física I')).toBe(normalizarNombreMateria('fisica i'))
  })
})

describe('diffHorario — clasificación', () => {
  it('bloque en la foto que no existe guardado → agregado', () => {
    const d = diffHorario({ guardado: [], propuesto: [propuesto()], nombrePorMateriaId: nombres })
    expect(d.agregados).toHaveLength(1)
    expect(d.movidos).toHaveLength(0)
    expect(d.eliminados).toHaveLength(0)
  })

  it('bloque idéntico (misma materia, día y horas) → sinCambios, no agregado', () => {
    const d = diffHorario({ guardado: [guardado()], propuesto: [propuesto()], nombrePorMateriaId: nombres })
    expect(d.sinCambios).toHaveLength(1)
    expect(d.agregados).toHaveLength(0)
    expect(d.eliminados).toHaveLength(0)
  })

  it('misma materia y día pero otra hora → movido, NO eliminado+agregado', () => {
    const d = diffHorario({
      guardado: [guardado({ horaInicio: '07:00', horaFin: '09:00' })],
      propuesto: [propuesto({ horaInicio: '08:00', horaFin: '10:00' })],
      nombrePorMateriaId: nombres,
    })
    expect(d.movidos).toHaveLength(1)
    expect(d.movidos[0].antes.horaInicio).toBe('07:00')
    expect(d.movidos[0].despues.horaInicio).toBe('08:00')
    expect(d.agregados).toHaveLength(0)
    expect(d.eliminados).toHaveLength(0)
  })

  it('bloque guardado que la foto no menciona → eliminado', () => {
    const d = diffHorario({ guardado: [guardado()], propuesto: [], nombrePorMateriaId: nombres })
    expect(d.eliminados).toHaveLength(1)
    expect(d.eliminados[0].id).toBe('b1')
  })

  it('la misma materia en otro día es un bloque distinto (agregado + eliminado, no movido)', () => {
    const d = diffHorario({
      guardado: [guardado({ diaSemana: 1 })],
      propuesto: [propuesto({ diaSemana: 3 })],
      nombrePorMateriaId: nombres,
    })
    expect(d.agregados).toHaveLength(1)
    expect(d.eliminados).toHaveLength(1)
    expect(d.movidos).toHaveLength(0)
  })

  it('el emparejamiento ignora acentos y mayúsculas del nombre leído de la foto', () => {
    const d = diffHorario({
      guardado: [guardado()],
      propuesto: [propuesto({ materia: 'calculo ii' })],
      nombrePorMateriaId: nombres,
    })
    expect(d.sinCambios).toHaveLength(1)
    expect(d.agregados).toHaveLength(0)
  })

  it('un bloque guardado cuya materia ya no existe se ignora, sin romper el diff', () => {
    const d = diffHorario({
      guardado: [guardado({ materiaId: 'materia-borrada' })],
      propuesto: [propuesto()],
      nombrePorMateriaId: nombres,
    })
    expect(d.agregados).toHaveLength(1)
    expect(d.eliminados).toHaveLength(0)
  })

  it('caso mixto: uno igual, uno movido, uno nuevo y uno que sobra', () => {
    const d = diffHorario({
      guardado: [
        guardado({ id: 'igual', materiaId: MAT_CALCULO, diaSemana: 1 }),
        guardado({ id: 'movido', materiaId: MAT_FISICA, diaSemana: 2, horaInicio: '07:00', horaFin: '09:00' }),
        guardado({ id: 'sobra', materiaId: MAT_FISICA, diaSemana: 5 }),
      ],
      propuesto: [
        propuesto({ materia: 'Cálculo II', diaSemana: 1 }),
        propuesto({ materia: 'Física I', diaSemana: 2, horaInicio: '14:00', horaFin: '16:00' }),
        propuesto({ materia: 'Álgebra Lineal', diaSemana: 3 }),
      ],
      nombrePorMateriaId: nombres,
    })
    expect(d.sinCambios.map((b) => b.id)).toEqual(['igual'])
    expect(d.movidos.map((m) => m.antes.id)).toEqual(['movido'])
    expect(d.agregados.map((a) => a.materia)).toEqual(['Álgebra Lineal'])
    expect(d.eliminados.map((b) => b.id)).toEqual(['sobra'])
  })
})

describe('diffHorario — bloques especiales (Sprint Zonas de horario)', () => {
  it('un ingreso nuevo (sin par guardado) → agregado, sin pasar por nombrePorMateriaId', () => {
    const d = diffHorario({
      guardado: [],
      propuesto: [{ tipo: 'ingreso', materia: '', diaSemana: 1, horaInicio: '07:00', horaFin: null, aula: null, confidence: 1 }],
      nombrePorMateriaId: new Map(), // vacío a propósito: un especial no debería necesitarlo
    })
    expect(d.agregados).toHaveLength(1)
  })

  it('mismo tipo especial y día, ya guardado, misma hora → sinCambios', () => {
    const d = diffHorario({
      guardado: [guardado({ tipo: 'descanso', materiaId: null, diaSemana: 2, horaInicio: '10:00', horaFin: '10:30' })],
      propuesto: [{ tipo: 'descanso', materia: '', diaSemana: 2, horaInicio: '10:00', horaFin: '10:30', aula: null, confidence: 1 }],
      nombrePorMateriaId: new Map(),
    })
    expect(d.sinCambios).toHaveLength(1)
    expect(d.agregados).toHaveLength(0)
  })

  it('mismo tipo especial y día, hora distinta → movido (igual que una clase)', () => {
    const d = diffHorario({
      guardado: [guardado({ tipo: 'salida', materiaId: null, diaSemana: 5, horaInicio: '15:00', horaFin: null })],
      propuesto: [{ tipo: 'salida', materia: '', diaSemana: 5, horaInicio: '16:00', horaFin: null, aula: null, confidence: 1 }],
      nombrePorMateriaId: new Map(),
    })
    expect(d.movidos).toHaveLength(1)
  })

  it('un ingreso y una clase el mismo día NUNCA se confunden entre sí (claves con prefijo distinto)', () => {
    const d = diffHorario({
      guardado: [guardado({ tipo: 'ingreso', materiaId: null, diaSemana: 1, horaInicio: '07:00', horaFin: null })],
      propuesto: [propuesto({ diaSemana: 1 })], // 'clase', materia 'Cálculo II'
      nombrePorMateriaId: nombres,
    })
    // El ingreso guardado no matchea contra la clase propuesta (claves
    // distintas) → la clase es agregada y el ingreso queda eliminado.
    expect(d.agregados).toHaveLength(1)
    expect(d.eliminados).toHaveLength(1)
    expect(d.eliminados[0].tipo).toBe('ingreso')
  })

  it('dos ingresos en días distintos son bloques independientes, no se funden', () => {
    const d = diffHorario({
      guardado: [guardado({ tipo: 'ingreso', materiaId: null, diaSemana: 1, horaInicio: '07:00', horaFin: null })],
      propuesto: [{ tipo: 'ingreso', materia: '', diaSemana: 3, horaInicio: '07:00', horaFin: null, aula: null, confidence: 1 }],
      nombrePorMateriaId: new Map(),
    })
    expect(d.agregados).toHaveLength(1) // el ingreso del miércoles
    expect(d.eliminados).toHaveLength(1) // el ingreso del lunes ya no aparece
  })
})

describe('detectarMateriasNuevas', () => {
  it('un bloque con una materia que no existe todavía → esa materia es nueva', () => {
    const nuevas = detectarMateriasNuevas([propuesto({ materia: 'Álgebra Lineal' })], [{ nombre: 'Cálculo II' }])
    expect(nuevas).toEqual(['Álgebra Lineal'])
  })

  it('la misma materia repetida en dos bloques (ej. dos clases el mismo día) cuenta una sola vez', () => {
    const nuevas = detectarMateriasNuevas(
      [propuesto({ materia: 'Álgebra Lineal', diaSemana: 1 }), propuesto({ materia: 'Álgebra Lineal', diaSemana: 3 })],
      []
    )
    expect(nuevas).toEqual(['Álgebra Lineal'])
  })

  it('variación de acentos/mayúsculas contra una materia existente → NO es nueva', () => {
    const nuevas = detectarMateriasNuevas([propuesto({ materia: 'calculo ii' })], [{ nombre: 'Cálculo II' }])
    expect(nuevas).toEqual([])
  })

  it('una materia existente sin ninguna franja guardada, con un bloque nuevo → NO es nueva', () => {
    // Caso real que el diff por sí solo no puede distinguir: el bloque cae
    // en `agregados` porque nunca hubo una franja guardada para comparar,
    // pero la materia ya existe en la lista completa del usuario.
    const nuevas = detectarMateriasNuevas([propuesto({ materia: 'Filosofía' })], [{ nombre: 'Filosofía' }])
    expect(nuevas).toEqual([])
  })

  it('sin materias existentes y sin bloques → lista vacía', () => {
    expect(detectarMateriasNuevas([], [])).toEqual([])
  })

  it('varias materias nuevas distintas se devuelven todas, en el orden en que aparecen', () => {
    const nuevas = detectarMateriasNuevas(
      [propuesto({ materia: 'Matemáticas' }), propuesto({ materia: 'Inglés' }), propuesto({ materia: 'Educación Física' })],
      []
    )
    expect(nuevas).toEqual(['Matemáticas', 'Inglés', 'Educación Física'])
  })

  it('un bloque especial con materia sentinel "" nunca cuenta como "materia nueva llamada vacío"', () => {
    const nuevas = detectarMateriasNuevas(
      [{ tipo: 'ingreso', materia: '', diaSemana: 1, horaInicio: '07:00', horaFin: null, aula: null, confidence: 1 }],
      []
    )
    expect(nuevas).toEqual([])
  })
})

describe('diffTieneCambios', () => {
  it('es false cuando todo quedó igual', () => {
    const d = diffHorario({ guardado: [guardado()], propuesto: [propuesto()], nombrePorMateriaId: nombres })
    expect(diffTieneCambios(d)).toBe(false)
  })

  it('es true si hay algo agregado', () => {
    const d = diffHorario({ guardado: [], propuesto: [propuesto()], nombrePorMateriaId: nombres })
    expect(diffTieneCambios(d)).toBe(true)
  })

  it('es true si solo hay eliminados', () => {
    const d = diffHorario({ guardado: [guardado()], propuesto: [], nombrePorMateriaId: nombres })
    expect(diffTieneCambios(d)).toBe(true)
  })
})
