import { describe, expect, it } from 'vitest'
import { formatearHora } from '../hora'

describe('formatearHora', () => {
  it('24h es passthrough, sin tocar el string', () => {
    expect(formatearHora('09:05', '24h')).toBe('09:05')
    expect(formatearHora('23:45', '24h')).toBe('23:45')
  })

  it('medianoche (00:00) en 12h es 12:00 a. m.', () => {
    expect(formatearHora('00:00', '12h')).toBe('12:00 a. m.')
  })

  it('mediodía (12:00) en 12h es 12:00 p. m.', () => {
    expect(formatearHora('12:00', '12h')).toBe('12:00 p. m.')
  })

  it('hora de la tarde (23:45) en 12h resta 12 y usa p. m.', () => {
    expect(formatearHora('23:45', '12h')).toBe('11:45 p. m.')
  })

  it('hora de la mañana con minutos de un dígito conserva el cero a la izquierda', () => {
    expect(formatearHora('09:05', '12h')).toBe('9:05 a. m.')
  })

  it('hora inválida se devuelve tal cual, sin lanzar', () => {
    expect(formatearHora('', '12h')).toBe('')
    expect(formatearHora('abc', '12h')).toBe('abc')
  })
})
