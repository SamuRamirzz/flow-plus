import { describe, expect, it } from 'vitest'
import { numerosEnTexto, numerosPermitidos, validarPuntosClave } from '../validarPuntosClave'
import type { DatosSeccionIA } from '../tipos'

const DATOS: DatosSeccionIA = {
  periodo: 'semanal',
  etiquetaPeriodo: '10 – 16 de agosto de 2026',
  completadas: { hechas: 18, total: 22, porcentaje: 82 },
  porcentajePuntualidad: 75,
  rachaDias: 3,
  deltaCompletadas: -5,
  deltaPuntualidad: 12,
  materias: [
    { nombre: 'BIOLOGÍA', completadas: 7, pendientes: 2 },
    { nombre: 'MATEMÁTICAS', completadas: 11, pendientes: 2 },
  ],
}

describe('numerosEnTexto', () => {
  it('extrae enteros simples', () => {
    expect(numerosEnTexto('completaste 18 de 22')).toEqual([18, 22])
  })

  it('el símbolo % no forma parte del número', () => {
    expect(numerosEnTexto('un 82% de cumplimiento')).toEqual([82])
    expect(numerosEnTexto('un 82 % de cumplimiento')).toEqual([82])
  })

  it('normaliza la coma decimal española a punto', () => {
    expect(numerosEnTexto('subiste 8,5 puntos')).toEqual([8.5])
  })

  it('acepta también el punto decimal', () => {
    expect(numerosEnTexto('subiste 8.5 puntos')).toEqual([8.5])
  })

  it('trata 1.250 como separador de MILLAR, no como decimal', () => {
    expect(numerosEnTexto('llevas 1.250 tareas')).toEqual([1250])
  })

  it('una fracción "8/10" son dos números independientes', () => {
    expect(numerosEnTexto('sacaste 8/10')).toEqual([8, 10])
  })

  it('el signo no altera el valor: se compara en valor absoluto', () => {
    expect(numerosEnTexto('bajaste -4 puntos')).toEqual([4])
  })

  it('texto sin cifras devuelve lista vacía', () => {
    expect(numerosEnTexto('mejoraste bastante respecto al periodo anterior')).toEqual([])
  })
})

describe('numerosPermitidos', () => {
  it('incluye las cifras dadas y sus derivados triviales', () => {
    const p = numerosPermitidos(DATOS)
    expect(p.has(18)).toBe(true) // hechas
    expect(p.has(22)).toBe(true) // total
    expect(p.has(82)).toBe(true) // porcentaje
    expect(p.has(75)).toBe(true) // puntualidad
    expect(p.has(3)).toBe(true) // racha
    expect(p.has(4)).toBe(true) // 22 - 18 = pendientes del periodo
  })

  it('guarda los deltas en valor absoluto', () => {
    const p = numerosPermitidos(DATOS)
    expect(p.has(5)).toBe(true) // deltaCompletadas era -5
    expect(p.has(12)).toBe(true)
  })

  it('incluye las cifras por materia y su suma', () => {
    const p = numerosPermitidos(DATOS)
    expect(p.has(7)).toBe(true)
    expect(p.has(11)).toBe(true)
    expect(p.has(9)).toBe(true) // 7 + 2
    expect(p.has(13)).toBe(true) // 11 + 2
  })

  it('NO incluye un número que no se derive de los datos', () => {
    expect(numerosPermitidos(DATOS).has(99)).toBe(false)
  })
})

describe('validarPuntosClave — acepta', () => {
  it('un texto que solo cita cifras provistas', () => {
    const r = validarPuntosClave('Completaste 18 de 22 tareas (82 %), y el 75 % llegó a tiempo.', DATOS)
    expect(r.valido).toBe(true)
  })

  it('un texto sin ninguna cifra', () => {
    expect(validarPuntosClave('Mejoraste respecto al periodo anterior. Sigue así.', DATOS).valido).toBe(true)
  })

  it('un delta citado sin signo', () => {
    expect(validarPuntosClave('Bajaste 5 puntos respecto al periodo anterior.', DATOS).valido).toBe(true)
  })

  it('una materia real del usuario, escrita igual', () => {
    expect(validarPuntosClave('Tu mejor materia fue BIOLOGÍA.', DATOS).valido).toBe(true)
  })
})

describe('validarPuntosClave — descarta', () => {
  it('una cifra inventada', () => {
    const r = validarPuntosClave('Completaste 18 de 22 tareas, un 99 % de tu objetivo.', DATOS)
    expect(r.valido).toBe(false)
    if (!r.valido) expect(r.motivo).toContain('99')
  })

  it('un año inventado (un año también es un número)', () => {
    expect(validarPuntosClave('Vas mejor que en 2025.', DATOS).valido).toBe(false)
  })

  it('una materia que el usuario NO tiene', () => {
    const r = validarPuntosClave('Tu mejor materia fue QUÍMICA.', DATOS)
    expect(r.valido).toBe(false)
    if (!r.valido) expect(r.motivo).toContain('QUÍMICA')
  })

  it('basta UNA cifra mala para invalidar todo el texto (descarte total)', () => {
    const r = validarPuntosClave('Completaste 18 de 22 (82 %). El 75 % a tiempo. Racha de 40 días.', DATOS)
    expect(r.valido).toBe(false)
  })
})

describe('validarPuntosClave — casos borde', () => {
  it('cuando no hay comparación, citar un delta es inventar', () => {
    const sinDelta: DatosSeccionIA = { ...DATOS, deltaCompletadas: null, deltaPuntualidad: null }
    expect(validarPuntosClave('Subiste 5 puntos.', sinDelta).valido).toBe(false)
  })

  it('un periodo vacío solo admite el 0 y el total', () => {
    const vacio: DatosSeccionIA = {
      ...DATOS,
      completadas: { hechas: 0, total: 0, porcentaje: null },
      porcentajePuntualidad: null,
      rachaDias: 0,
      deltaCompletadas: null,
      deltaPuntualidad: null,
      materias: [],
    }
    expect(validarPuntosClave('No registraste tareas en este periodo.', vacio).valido).toBe(true)
    expect(validarPuntosClave('Completaste 0 tareas.', vacio).valido).toBe(true)
    expect(validarPuntosClave('Completaste 3 tareas.', vacio).valido).toBe(false)
  })
})
