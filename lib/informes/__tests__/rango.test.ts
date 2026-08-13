import { describe, expect, it } from 'vitest'
import { rangoAnterior, rangoDePeriodo, tareasDelRango, filasDelRango } from '../rango'
import type { Tarea } from '@/lib/types'

function tarea(overrides: Partial<Tarea> = {}): Tarea {
  return {
    id: 't1',
    titulo: 'Tarea',
    materia_id: 'm1',
    fecha_entrega: '2026-08-12',
    prioridad: 'media',
    completada: false,
    tipo: 'otro',
    temario: null,
    formato: null,
    peso: null,
    completada_en: null,
    ...overrides,
  }
}

describe('rangoDePeriodo — semanal', () => {
  it('un miércoles devuelve lunes→domingo de esa semana', () => {
    // 2026-08-12 es miércoles
    expect(rangoDePeriodo('semanal', '2026-08-12')).toEqual({ desde: '2026-08-10', hasta: '2026-08-16' })
  })

  it('el propio lunes se queda en su semana, no retrocede una', () => {
    expect(rangoDePeriodo('semanal', '2026-08-10')).toEqual({ desde: '2026-08-10', hasta: '2026-08-16' })
  })

  it('el domingo pertenece a la semana que empezó el lunes anterior (ISO), no a la siguiente', () => {
    expect(rangoDePeriodo('semanal', '2026-08-16')).toEqual({ desde: '2026-08-10', hasta: '2026-08-16' })
  })

  it('una semana que cruza el fin de mes se calcula igual', () => {
    // 2026-10-01 es jueves → la semana empezó el lunes 28 de septiembre
    expect(rangoDePeriodo('semanal', '2026-10-01')).toEqual({ desde: '2026-09-28', hasta: '2026-10-04' })
  })

  it('una semana que cruza el fin de año se calcula igual', () => {
    // 2026-01-01 es jueves → la semana empezó el lunes 29 de diciembre de 2025
    expect(rangoDePeriodo('semanal', '2026-01-01')).toEqual({ desde: '2025-12-29', hasta: '2026-01-04' })
  })
})

describe('rangoDePeriodo — mensual y anual', () => {
  it('mensual cubre del día 1 al último del mes', () => {
    expect(rangoDePeriodo('mensual', '2026-08-12')).toEqual({ desde: '2026-08-01', hasta: '2026-08-31' })
  })

  it('mensual resuelve meses de 30 días', () => {
    expect(rangoDePeriodo('mensual', '2026-09-15')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
  })

  it('febrero de un año NO bisiesto termina el 28', () => {
    expect(rangoDePeriodo('mensual', '2026-02-10')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
  })

  it('febrero de un año bisiesto termina el 29', () => {
    expect(rangoDePeriodo('mensual', '2028-02-10')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
  })

  it('anual cubre del 1 de enero al 31 de diciembre', () => {
    expect(rangoDePeriodo('anual', '2026-08-12')).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' })
  })
})

describe('rangoAnterior', () => {
  it('semanal retrocede exactamente 7 días', () => {
    expect(rangoAnterior('semanal', { desde: '2026-08-10', hasta: '2026-08-16' })).toEqual({
      desde: '2026-08-03',
      hasta: '2026-08-09',
    })
  })

  it('mensual retrocede un MES CALENDARIO, no 30 días', () => {
    // Marzo → febrero completo (28 días), nunca "marzo menos 30 días"
    expect(rangoAnterior('mensual', { desde: '2026-03-01', hasta: '2026-03-31' })).toEqual({
      desde: '2026-02-01',
      hasta: '2026-02-28',
    })
  })

  it('el mes anterior a enero es diciembre del año previo', () => {
    expect(rangoAnterior('mensual', { desde: '2026-01-01', hasta: '2026-01-31' })).toEqual({
      desde: '2025-12-01',
      hasta: '2025-12-31',
    })
  })

  it('mensual desde un mes de 31 días hacia uno de 30 no desborda', () => {
    expect(rangoAnterior('mensual', { desde: '2026-05-01', hasta: '2026-05-31' })).toEqual({
      desde: '2026-04-01',
      hasta: '2026-04-30',
    })
  })

  it('anual retrocede al año calendario completo anterior', () => {
    expect(rangoAnterior('anual', { desde: '2026-01-01', hasta: '2026-12-31' })).toEqual({
      desde: '2025-01-01',
      hasta: '2025-12-31',
    })
  })
})

describe('tareasDelRango', () => {
  const rango = { desde: '2026-08-10', hasta: '2026-08-16' }

  it('incluye los dos extremos del rango (inclusive)', () => {
    const dentro = tareasDelRango(
      [tarea({ id: 'a', fecha_entrega: '2026-08-10' }), tarea({ id: 'b', fecha_entrega: '2026-08-16' })],
      rango
    )
    expect(dentro.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('excluye lo que queda fuera por un día', () => {
    const dentro = tareasDelRango(
      [tarea({ id: 'antes', fecha_entrega: '2026-08-09' }), tarea({ id: 'despues', fecha_entrega: '2026-08-17' })],
      rango
    )
    expect(dentro).toHaveLength(0)
  })

  it('excluye tareas sin fecha de entrega — no pertenecen a ningún periodo', () => {
    expect(tareasDelRango([tarea({ fecha_entrega: null })], rango)).toHaveLength(0)
  })
})

describe('filasDelRango', () => {
  it('compara por DÍA, ignorando la hora del timestamp', () => {
    const filas = [
      { created_at: '2026-08-16T23:59:59.999Z' },
      { created_at: '2026-08-17T00:00:00.000Z' },
      { created_at: '2026-08-10T00:00:01.000Z' },
    ]
    const dentro = filasDelRango(filas, { desde: '2026-08-10', hasta: '2026-08-16' })
    expect(dentro.map((f) => f.created_at.slice(0, 10))).toEqual(['2026-08-16', '2026-08-10'])
  })
})
