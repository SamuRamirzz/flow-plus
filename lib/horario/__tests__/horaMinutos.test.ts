import { describe, expect, it } from 'vitest'
import { minutosDesdeHHMM, hhmmDesdeMinutos } from '../horaMinutos'

describe('minutosDesdeHHMM', () => {
  it('convierte medianoche a 0', () => {
    expect(minutosDesdeHHMM('00:00')).toBe(0)
  })

  it('convierte una hora intermedia', () => {
    expect(minutosDesdeHHMM('10:30')).toBe(630)
  })

  it('convierte 23:59 al máximo del día', () => {
    expect(minutosDesdeHHMM('23:59')).toBe(1439)
  })
})

describe('hhmmDesdeMinutos', () => {
  it('es la inversa de minutosDesdeHHMM para valores dentro del día', () => {
    expect(hhmmDesdeMinutos(630)).toBe('10:30')
    expect(hhmmDesdeMinutos(0)).toBe('00:00')
    expect(hhmmDesdeMinutos(1439)).toBe('23:59')
  })

  it('recorta un total negativo a 00:00, nunca devuelve una hora inválida', () => {
    expect(hhmmDesdeMinutos(-30)).toBe('00:00')
  })

  it('recorta un total que se pasa del día a 23:59, nunca devuelve 25:00', () => {
    expect(hhmmDesdeMinutos(1500)).toBe('23:59')
  })

  it('preserva ceros a la izquierda', () => {
    expect(hhmmDesdeMinutos(5)).toBe('00:05')
  })
})
