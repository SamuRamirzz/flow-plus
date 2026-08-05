import { describe, expect, it } from 'vitest'
import { diaISODeFecha, diasEntre, diasHastaProximo, siguienteOcurrencia } from '../dias'

// 2026-07-27 es lunes de verdad (verificado contra Date.UTC/.toUTCString()
// antes de escribir este archivo, no asumido) — ancla real para todos los
// casos de esta suite.
const LUNES = '2026-07-27'

describe('diaISODeFecha — convención ISO (1=lunes…7=domingo), nunca la de JS', () => {
  const casos: Array<[string, number]> = [
    ['2026-07-27', 1], // lunes
    ['2026-07-28', 2], // martes
    ['2026-07-29', 3], // miércoles
    ['2026-07-30', 4], // jueves
    ['2026-07-31', 5], // viernes
    ['2026-08-01', 6], // sábado
    ['2026-08-02', 7], // domingo
  ]

  it.each(casos)('%s → día ISO %i', (fecha, esperado) => {
    expect(diaISODeFecha(fecha)).toBe(esperado)
  })

  it('cruza el año correctamente (31 dic 2026 es jueves)', () => {
    expect(diaISODeFecha('2026-12-31')).toBe(4)
    expect(diaISODeFecha('2027-01-01')).toBe(5)
  })
})

describe('diasHastaProximo', () => {
  it('mismo día, incluirHoy=false → avanza 7 (nunca 0)', () => {
    expect(diasHastaProximo(LUNES, 1, false)).toBe(7)
  })

  it('mismo día, incluirHoy=true → 0', () => {
    expect(diasHastaProximo(LUNES, 1, true)).toBe(0)
  })

  it('un día después', () => {
    expect(diasHastaProximo(LUNES, 2, false)).toBe(1)
  })

  it('el día anterior de la semana (envuelve hacia adelante, nunca negativo)', () => {
    expect(diasHastaProximo(LUNES, 7, false)).toBe(6) // domingo, 6 días después del lunes
  })
})

describe('siguienteOcurrencia', () => {
  it('un bloque simple: lunes → próximo miércoles', () => {
    expect(siguienteOcurrencia(LUNES, 3)).toBe('2026-07-29')
  })

  it('mismo día sin incluirHoy → la semana siguiente, no hoy', () => {
    expect(siguienteOcurrencia(LUNES, 1, false)).toBe('2026-08-03')
  })

  it('mismo día con incluirHoy → hoy mismo', () => {
    expect(siguienteOcurrencia(LUNES, 1, true)).toBe(LUNES)
  })

  it('cruza el mes', () => {
    expect(siguienteOcurrencia(LUNES, 7)).toBe('2026-08-02') // domingo
  })

  it('cruza el año (30 dic 2026, miércoles → próximo lunes cae en enero 2027)', () => {
    expect(siguienteOcurrencia('2026-12-30', 1)).toBe('2027-01-04')
  })

  it('nunca devuelve una fecha anterior a "hoy"', () => {
    for (let dia = 1; dia <= 7; dia++) {
      const resultado = siguienteOcurrencia(LUNES, dia as 1 | 2 | 3 | 4 | 5 | 6 | 7)
      expect(resultado >= LUNES).toBe(true)
    }
  })
})

describe('diasEntre', () => {
  it('mismo día → 0', () => {
    expect(diasEntre('2026-07-28', '2026-07-28')).toBe(0)
  })

  it('positivo cuando `hasta` es posterior', () => {
    expect(diasEntre('2026-07-28', '2026-07-31')).toBe(3)
  })

  it('negativo cuando `hasta` es anterior', () => {
    expect(diasEntre('2026-07-28', '2026-07-26')).toBe(-2)
  })

  it('cruza el fin de mes correctamente', () => {
    expect(diasEntre('2026-07-31', '2026-08-01')).toBe(1)
  })

  it('cruza el fin de año correctamente', () => {
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1)
  })

  // 2028 es bisiesto: febrero tiene 29 días, así que del 28-feb al 1-mar
  // hay 2 días, no 1. Si la aritmética se hiciera sumando 365/mes fijo,
  // esto fallaría.
  it('respeta el año bisiesto', () => {
    expect(diasEntre('2028-02-28', '2028-03-01')).toBe(2)
    expect(diasEntre('2027-02-28', '2027-03-01')).toBe(1)
  })

  it('dos años completos desde 2026-07-28 son 730 días', () => {
    expect(diasEntre('2026-07-28', '2028-07-27')).toBe(730)
  })
})
