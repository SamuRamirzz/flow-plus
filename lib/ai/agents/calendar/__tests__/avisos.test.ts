import { describe, expect, it } from 'vitest'
import { mensajeAvisoCalendario } from '../avisos'

describe('mensajeAvisoCalendario', () => {
  it('sin aviso de fecha ni colisiones → null', () => {
    expect(mensajeAvisoCalendario(null, [])).toBeNull()
    expect(mensajeAvisoCalendario(undefined, undefined)).toBeNull()
  })

  it('fecha plausible (valida: true) no genera texto aunque tenga motivo', () => {
    expect(mensajeAvisoCalendario({ valida: true, motivo: null }, [])).toBeNull()
  })

  it('fecha implausible con motivo → devuelve el motivo', () => {
    expect(mensajeAvisoCalendario({ valida: false, motivo: 'Esa fecha ya pasó' }, [])).toBe('Esa fecha ya pasó')
  })

  it('una colisión → menciona el título de la tarea', () => {
    const resultado = mensajeAvisoCalendario(null, [{ tareaId: 't1', titulo: 'Examen de física', motivo: 'Ya tienes otro examen este día' }])
    expect(resultado).toBe('Choca con "Examen de física" ese día')
  })

  it('varias colisiones → cuenta en vez de listar títulos', () => {
    const resultado = mensajeAvisoCalendario(null, [
      { tareaId: 't1', titulo: 'A', motivo: 'x' },
      { tareaId: 't2', titulo: 'B', motivo: 'y' },
    ])
    expect(resultado).toBe('Choca con 2 tareas más ese día')
  })

  it('aviso de fecha y colisión a la vez → se combinan', () => {
    const resultado = mensajeAvisoCalendario({ valida: false, motivo: 'Esa fecha ya pasó' }, [{ tareaId: 't1', titulo: 'A', motivo: 'x' }])
    expect(resultado).toBe('Esa fecha ya pasó — Choca con "A" ese día')
  })
})
