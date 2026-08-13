import { describe, expect, it } from 'vitest'
import { hayColision } from '../horario'

// Bugs pendientes / Parte 2 — hayColision es PURA (sin I/O), probada
// directamente sin red ni mocks de Supabase.
describe('hayColision', () => {
  const INGLES = { id: 'b1', diaSemana: 1, horaInicio: '08:00', horaFin: '09:00' }
  const MATE = { id: 'b2', diaSemana: 3, horaInicio: '10:00', horaFin: '11:00' }
  const existentes = [INGLES, MATE]

  it('mismo día, rango se solapa exactamente → colisión', () => {
    expect(hayColision(existentes, { diaSemana: 1, horaInicio: '08:00', horaFin: '09:00' })).toBe(true)
  })

  it('mismo día, rango se solapa parcialmente (empieza antes, termina dentro) → colisión', () => {
    expect(hayColision(existentes, { diaSemana: 1, horaInicio: '07:30', horaFin: '08:30' })).toBe(true)
  })

  it('mismo día, rango se solapa parcialmente (empieza dentro, termina después) → colisión', () => {
    expect(hayColision(existentes, { diaSemana: 1, horaInicio: '08:30', horaFin: '09:30' })).toBe(true)
  })

  it('mismo día, un rango contiene por completo al otro → colisión', () => {
    expect(hayColision(existentes, { diaSemana: 1, horaInicio: '07:00', horaFin: '10:00' })).toBe(true)
  })

  it('mismo día, rangos consecutivos sin solape (uno termina cuando el otro empieza) → sin colisión', () => {
    expect(hayColision(existentes, { diaSemana: 1, horaInicio: '09:00', horaFin: '10:00' })).toBe(false)
  })

  it('mismo día, rangos completamente separados → sin colisión', () => {
    expect(hayColision(existentes, { diaSemana: 1, horaInicio: '14:00', horaFin: '15:00' })).toBe(false)
  })

  it('mismo horario, día distinto → sin colisión', () => {
    expect(hayColision(existentes, { diaSemana: 2, horaInicio: '08:00', horaFin: '09:00' })).toBe(false)
  })

  it('candidato sin hora (ninguna de las dos) → nunca colisiona, no hay franja real que comparar', () => {
    expect(hayColision(existentes, { diaSemana: 1, horaInicio: null, horaFin: null })).toBe(false)
  })

  it('candidato con horaInicio pero sin horaFin → nunca colisiona (rango incompleto)', () => {
    expect(hayColision(existentes, { diaSemana: 1, horaInicio: '08:00', horaFin: null })).toBe(false)
  })

  it('existente sin hora (bloque especial sin franja) → nunca colisiona con nada', () => {
    const conEspecialSinHora = [...existentes, { id: 'b3', diaSemana: 1, horaInicio: null, horaFin: null }]
    expect(hayColision(conEspecialSinHora, { diaSemana: 1, horaInicio: '08:00', horaFin: '09:00' })).toBe(true) // sigue chocando con INGLES
  })

  it('excluirId hace que un bloque no choque consigo mismo al modificarlo', () => {
    expect(hayColision(existentes, { diaSemana: 1, horaInicio: '08:00', horaFin: '09:00' }, 'b1')).toBe(false)
  })

  it('excluirId no protege a los DEMÁS bloques — solo al propio', () => {
    const dosEnElMismoDia = [INGLES, { id: 'b4', diaSemana: 1, horaInicio: '08:30', horaFin: '09:30' }]
    expect(hayColision(dosEnElMismoDia, { diaSemana: 1, horaInicio: '08:15', horaFin: '08:45' }, 'b1')).toBe(true)
  })

  it('lista vacía → nunca colisiona', () => {
    expect(hayColision([], { diaSemana: 1, horaInicio: '08:00', horaFin: '09:00' })).toBe(false)
  })
})
