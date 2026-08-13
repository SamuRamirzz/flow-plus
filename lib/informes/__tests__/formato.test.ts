import { describe, expect, it } from 'vitest'
import { etiquetaPeriodo, fechaCorta, fechaLegible, fraccion, nombreArchivoInforme, porcentaje, textoPorcentaje } from '../formato'

describe('fechaLegible', () => {
  it('formatea en español, sin cero a la izquierda en el día', () => {
    expect(fechaLegible('2026-08-12')).toBe('12 de agosto de 2026')
    expect(fechaLegible('2026-01-05')).toBe('5 de enero de 2026')
  })

  it('acierta el último mes (diciembre = índice 12, no 11)', () => {
    expect(fechaLegible('2026-12-31')).toBe('31 de diciembre de 2026')
  })
})

describe('fechaCorta', () => {
  it('formatea compacto para listas', () => {
    expect(fechaCorta('2026-08-18')).toBe('18 ago')
  })
})

describe('etiquetaPeriodo', () => {
  it('semanal dentro del mismo mes colapsa el mes y el año', () => {
    expect(etiquetaPeriodo('semanal', { desde: '2026-08-10', hasta: '2026-08-16' })).toBe('10 – 16 de agosto de 2026')
  })

  it('semanal que cruza de mes nombra ambos meses', () => {
    expect(etiquetaPeriodo('semanal', { desde: '2026-09-28', hasta: '2026-10-04' })).toBe('28 de septiembre – 4 de octubre de 2026')
  })

  it('semanal que cruza de año nombra ambos años', () => {
    expect(etiquetaPeriodo('semanal', { desde: '2025-12-29', hasta: '2026-01-04' })).toBe(
      '29 de diciembre de 2025 – 4 de enero de 2026'
    )
  })

  it('mensual y anual son compactos', () => {
    expect(etiquetaPeriodo('mensual', { desde: '2026-08-01', hasta: '2026-08-31' })).toBe('agosto de 2026')
    expect(etiquetaPeriodo('anual', { desde: '2026-01-01', hasta: '2026-12-31' })).toBe('2026')
  })
})

describe('porcentaje', () => {
  it('redondea al entero', () => {
    expect(porcentaje(18, 22)).toBe(82)
    expect(porcentaje(1, 3)).toBe(33)
  })

  it('total 0 devuelve null, NUNCA NaN ni 0 — "no había nada que hacer" no es "hiciste 0 %"', () => {
    expect(porcentaje(0, 0)).toBeNull()
  })

  it('0 de N sí es 0 % — distinto del caso anterior', () => {
    expect(porcentaje(0, 5)).toBe(0)
  })

  it('todo completado es 100 %', () => {
    expect(porcentaje(7, 7)).toBe(100)
  })
})

describe('textoPorcentaje', () => {
  it('null se muestra como raya, no como "null %" ni "0 %"', () => {
    expect(textoPorcentaje(null)).toBe('—')
    expect(textoPorcentaje(0)).toBe('0 %')
    expect(textoPorcentaje(82)).toBe('82 %')
  })
})

describe('fraccion', () => {
  it('se lee en español', () => {
    expect(fraccion(18, 22)).toBe('18 de 22')
  })
})

describe('nombreArchivoInforme', () => {
  it('no lleva acentos ni espacios — viaja en un header HTTP', () => {
    const nombre = nombreArchivoInforme('semanal', { desde: '2026-08-10', hasta: '2026-08-16' })
    expect(nombre).toBe('flowplus-informe-semanal-2026-08-10.pdf')
    expect(nombre).toMatch(/^[\x20-\x7E]+$/)
    expect(nombre).not.toContain(' ')
  })
})
