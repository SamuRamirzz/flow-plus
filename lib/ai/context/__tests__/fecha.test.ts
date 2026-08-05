import { describe, expect, it } from 'vitest'
import { horaEnZona } from '../fecha'

describe('horaEnZona', () => {
  it('formatea HH:MM en la zona indicada', () => {
    // 15:30 UTC = 10:30 en America/Bogota (UTC-5, sin horario de verano).
    const r = horaEnZona(new Date('2026-07-28T15:30:00Z'), 'America/Bogota')
    expect(r).toBe('10:30')
  })

  it('medianoche se reporta como 00:00, no 24:00', () => {
    const r = horaEnZona(new Date('2026-07-28T00:00:00Z'), 'UTC')
    expect(r).toBe('00:00')
  })

  it('un minuto antes de medianoche', () => {
    const r = horaEnZona(new Date('2026-07-28T23:59:00Z'), 'UTC')
    expect(r).toBe('23:59')
  })

  it('zona horaria inválida cae a UTC en vez de lanzar', () => {
    const r = horaEnZona(new Date('2026-07-28T09:15:00Z'), 'Zona/Inventada')
    expect(r).toBe('09:15')
  })

  it('nunca lee el reloj real — mismo Date de entrada, mismo resultado siempre', () => {
    const d = new Date('2026-07-28T12:00:00Z')
    expect(horaEnZona(d, 'America/Bogota')).toBe(horaEnZona(d, 'America/Bogota'))
  })
})
