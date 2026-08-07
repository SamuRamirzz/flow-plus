import { describe, it, expect } from 'vitest'
import { fechaEjecucion, debeEjecutarse, diasRestantes, DIAS_GRACIA } from '../eliminacion'

describe('fechaEjecucion', () => {
  it('suma exactamente 14 días por defecto', () => {
    const r = fechaEjecucion('2026-08-06T10:00:00.000Z')
    expect(r.toISOString()).toBe('2026-08-20T10:00:00.000Z')
  })

  it('acepta un Date además de un string ISO', () => {
    const r = fechaEjecucion(new Date('2026-08-06T10:00:00.000Z'))
    expect(r.toISOString()).toBe('2026-08-20T10:00:00.000Z')
  })

  it('respeta un período de gracia distinto si se pasa explícito', () => {
    const r = fechaEjecucion('2026-08-06T00:00:00.000Z', 1)
    expect(r.toISOString()).toBe('2026-08-07T00:00:00.000Z')
  })

  it('DIAS_GRACIA es 14, la decisión ya tomada por el encargo', () => {
    expect(DIAS_GRACIA).toBe(14)
  })
})

describe('debeEjecutarse', () => {
  const solicitada = '2026-08-06T10:00:00.000Z'

  it('false mientras no se cumplieron los 14 días', () => {
    expect(debeEjecutarse(solicitada, new Date('2026-08-19T10:00:00.000Z'))).toBe(false)
  })

  it('true en el instante exacto en que se cumplen', () => {
    expect(debeEjecutarse(solicitada, new Date('2026-08-20T10:00:00.000Z'))).toBe(true)
  })

  it('true bastante después de cumplirse (el cron no corrió a tiempo)', () => {
    expect(debeEjecutarse(solicitada, new Date('2026-09-01T00:00:00.000Z'))).toBe(true)
  })

  it('false un segundo antes de cumplirse — un usuario que cancela en el último momento se salva', () => {
    expect(debeEjecutarse(solicitada, new Date('2026-08-20T09:59:59.000Z'))).toBe(false)
  })
})

describe('diasRestantes', () => {
  it('14 días completos en el instante de la solicitud', () => {
    expect(diasRestantes('2026-08-06T10:00:00.000Z', new Date('2026-08-06T10:00:00.000Z'))).toBe(14)
  })

  it('redondea hacia arriba — 30 horas restantes siguen siendo 2 días, no 1', () => {
    const solicitada = '2026-08-06T10:00:00.000Z'
    const ahora = new Date('2026-08-19T04:00:00.000Z') // faltan 30h para el día 20 a las 10:00
    expect(diasRestantes(solicitada, ahora)).toBe(2)
  })

  it('nunca negativo — ya vencido devuelve 0, no un número negativo', () => {
    expect(diasRestantes('2026-08-06T10:00:00.000Z', new Date('2026-09-01T00:00:00.000Z'))).toBe(0)
  })
})
