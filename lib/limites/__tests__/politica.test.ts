import { describe, expect, it } from 'vitest'
import { POLITICAS, excedeLimite, inicioVentana, type AccionLimitada } from '../politica'

const ACCIONES: AccionLimitada[] = ['ia_mensaje', 'ia_vision', 'ia_archivo', 'informe_pdf', 'whatsapp_envio']

describe('excedeLimite', () => {
  const politica = { max: 3, ventanaMinutos: 60, mensaje: 'x' }

  it('por debajo del tope deja pasar', () => {
    expect(excedeLimite(0, politica)).toBe(false)
    expect(excedeLimite(2, politica)).toBe(false)
  })

  it('justo en el tope ya bloquea — el conteo son ejecuciones YA registradas', () => {
    // Con max=3 y 3 usos hechos, el cuarto sobra: comparar con `>` en vez de
    // `>=` dejaría pasar siempre uno de más.
    expect(excedeLimite(3, politica)).toBe(true)
  })

  it('por encima del tope bloquea', () => {
    expect(excedeLimite(4, politica)).toBe(true)
  })
})

describe('inicioVentana', () => {
  it('resta exactamente la ventana al instante recibido', () => {
    const ahora = Date.UTC(2026, 7, 22, 12, 0, 0)
    const inicio = inicioVentana(ahora, { max: 5, ventanaMinutos: 60, mensaje: 'x' })
    expect(inicio.toISOString()).toBe('2026-08-22T11:00:00.000Z')
  })

  it('no depende del reloj del proceso: el mismo instante da siempre el mismo resultado', () => {
    const ahora = Date.UTC(2026, 0, 1, 0, 30, 0)
    const p = { max: 5, ventanaMinutos: 45, mensaje: 'x' }
    expect(inicioVentana(ahora, p).toISOString()).toBe(inicioVentana(ahora, p).toISOString())
    expect(inicioVentana(ahora, p).toISOString()).toBe('2025-12-31T23:45:00.000Z')
  })
})

describe('POLITICAS', () => {
  it('define las 5 acciones y ninguna de más', () => {
    expect(Object.keys(POLITICAS).sort()).toEqual([...ACCIONES].sort())
  })

  it('toda política tiene un tope y una ventana positivos', () => {
    for (const accion of ACCIONES) {
      expect(POLITICAS[accion].max).toBeGreaterThan(0)
      expect(POLITICAS[accion].ventanaMinutos).toBeGreaterThan(0)
    }
  })

  it('ningún mensaje revela el número exacto del tope', () => {
    // Decirle "máximo 60 por hora" a quien abusa le dice exactamente cuánto
    // esperar para seguir; al usuario legítimo no le aporta nada.
    for (const accion of ACCIONES) {
      const { mensaje, max } = POLITICAS[accion]
      expect(mensaje).not.toContain(String(max))
    }
  })

  it('el envío por WhatsApp es el tope más restrictivo — es un recurso compartido', () => {
    for (const accion of ACCIONES) {
      if (accion === 'whatsapp_envio') continue
      expect(POLITICAS.whatsapp_envio.max).toBeLessThan(POLITICAS[accion].max)
    }
  })
})
