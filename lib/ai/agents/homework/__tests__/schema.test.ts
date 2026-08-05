import { describe, expect, it } from 'vitest'
import { HomeworkOutputParser } from '../schema'

const parser = new HomeworkOutputParser()

describe('HomeworkOutputParser — tipoRespuesta', () => {
  it('"tareas": detecta tareas y deja mensaje en null', () => {
    const r = parser.parse(
      JSON.stringify({
        tipoRespuesta: 'tareas',
        mensaje: '',
        tareas: [{ titulo: 'Examen de química', materia: 'Química', fecha: '2026-07-30', prioridad: 'alta', tipo: 'examen', confidence: 0.9 }],
      })
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.tipoRespuesta).toBe('tareas')
    expect(r.data.mensaje).toBeNull()
    expect(r.data.tareas).toHaveLength(1)
  })

  it('"ambiguo": texto insuficiente, sin tareas y sin mensaje', () => {
    const r = parser.parse(JSON.stringify({ tipoRespuesta: 'ambiguo', mensaje: '', tareas: [] }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.tipoRespuesta).toBe('ambiguo')
    expect(r.data.mensaje).toBeNull()
    expect(r.data.tareas).toHaveLength(0)
  })

  it('"conversacional": sin tareas, con mensaje natural (caso "hola")', () => {
    const r = parser.parse(
      JSON.stringify({
        tipoRespuesta: 'conversacional',
        mensaje: '¡Hola! Puedo ayudarte a registrar tareas — cuéntame qué tienes pendiente.',
        tareas: [],
      })
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.tipoRespuesta).toBe('conversacional')
    expect(r.data.mensaje).toBe('¡Hola! Puedo ayudarte a registrar tareas — cuéntame qué tienes pendiente.')
    expect(r.data.tareas).toHaveLength(0)
  })

  it('tipoRespuesta ausente o inválido con tareas presentes: infiere "tareas" en vez de fallar', () => {
    const r = parser.parse(
      JSON.stringify({
        tareas: [{ titulo: 'Leer capítulo 2', materia: '', fecha: '', prioridad: 'baja', tipo: 'lectura', confidence: 0.4 }],
      })
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.tipoRespuesta).toBe('tareas')
  })

  it('tipoRespuesta ausente y sin tareas: infiere "ambiguo" (comportamiento previo a este cambio), nunca "conversacional" por inferencia', () => {
    const r = parser.parse(JSON.stringify({ tareas: [] }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.tipoRespuesta).toBe('ambiguo')
  })

  it('tipoRespuesta con un valor fuera del enum se trata como ausente, sin lanzar', () => {
    const r = parser.parse(JSON.stringify({ tipoRespuesta: 'saludo', mensaje: 'hola', tareas: [] }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.tipoRespuesta).toBe('ambiguo')
  })

  it('mensaje "" se normaliza a null, igual que materia/fecha vacíos en tareas', () => {
    const r = parser.parse(JSON.stringify({ tipoRespuesta: 'tareas', mensaje: '', tareas: [] }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.mensaje).toBeNull()
  })
})
