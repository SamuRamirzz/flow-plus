import { describe, expect, it } from 'vitest'
import { TaskManagementOutputParser } from '../schema'

const parser = new TaskManagementOutputParser()

// Sprint Rediseño /ai — Parte A. El schema manda todas las propiedades de un
// bloque SIEMPRE (con centinelas, misma disciplina que el resto del archivo);
// el parser las traduce a la unión discriminada. Estos tests cubren esa
// traducción y, sobre todo, que un bloque a medias NUNCA llegue al cliente.

function raw(bloques: unknown[]): string {
  return JSON.stringify({ tipoRespuesta: 'conversacional', mensaje: '', operaciones: [], bloques })
}

/** Bloque con todas las propiedades en su centinela, como lo manda el schema. */
function bloque(overrides: Record<string, unknown>): Record<string, unknown> {
  return { tipo: 'texto', contenido: '', items: [], itemsDetallados: [], columnas: [], filas: [], pares: [], ...overrides }
}

describe('bloques — el caso que motivó el sprint', () => {
  it('materias duplicadas se parsean como lista_detallada con título y detalle', () => {
    const r = parser.parse(
      raw([
        bloque({
          tipo: 'lista_detallada',
          itemsDetallados: [
            { titulo: 'BIOLOGÍA', detalle: ['Lunes 6:30 – 7:29', 'Martes 11:40 – 12:20'] },
            { titulo: 'INGLÉS', detalle: ['Lunes 8:20 – 9:14'] },
          ],
        }),
      ])
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.bloques).toEqual([
      {
        tipo: 'lista_detallada',
        items: [
          { titulo: 'BIOLOGÍA', detalle: ['Lunes 6:30 – 7:29', 'Martes 11:40 – 12:20'] },
          { titulo: 'INGLÉS', detalle: ['Lunes 8:20 – 9:14'] },
        ],
      },
    ])
  })
})

describe('bloques — cada tipo', () => {
  it('texto', () => {
    const r = parser.parse(raw([bloque({ tipo: 'texto', contenido: 'Tienes 3 tareas.' })]))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([{ tipo: 'texto', contenido: 'Tienes 3 tareas.' }])
  })

  it('lista', () => {
    const r = parser.parse(raw([bloque({ tipo: 'lista', items: ['Biología', 'Inglés'] })]))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([{ tipo: 'lista', items: ['Biología', 'Inglés'] }])
  })

  it('tabla', () => {
    const r = parser.parse(
      raw([bloque({ tipo: 'tabla', columnas: ['Materia', 'Pendientes'], filas: [['Biología', '3'], ['Inglés', '1']] })])
    )
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([
      { tipo: 'tabla', columnas: ['Materia', 'Pendientes'], filas: [['Biología', '3'], ['Inglés', '1']] },
    ])
  })

  it('renglones', () => {
    const r = parser.parse(
      raw([bloque({ tipo: 'renglones', pares: [{ etiqueta: 'Materia', valor: 'Física' }, { etiqueta: 'Vence', valor: 'mañana' }] })])
    )
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([
      { tipo: 'renglones', pares: [{ etiqueta: 'Materia', valor: 'Física' }, { etiqueta: 'Vence', valor: 'mañana' }] },
    ])
  })
})

describe('bloques — descarta lo inválido, nunca a medias', () => {
  it('sin bloques el array queda vacío (el camino normal)', () => {
    const r = parser.parse(JSON.stringify({ tipoRespuesta: 'conversacional', mensaje: 'Hola', operaciones: [] }))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([])
  })

  it('un tipo desconocido se descarta sin lanzar', () => {
    const r = parser.parse(raw([bloque({ tipo: 'grafico_3d' })]))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([])
  })

  it('texto vacío se descarta — no deja un bloque en blanco en pantalla', () => {
    const r = parser.parse(raw([bloque({ tipo: 'texto', contenido: '   ' })]))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([])
  })

  it('lista sin items se descarta', () => {
    const r = parser.parse(raw([bloque({ tipo: 'lista', items: [] })]))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([])
  })

  it('lista_detallada: un item sin título se cae, los válidos sobreviven', () => {
    const r = parser.parse(
      raw([
        bloque({
          tipo: 'lista_detallada',
          itemsDetallados: [{ titulo: '', detalle: ['x'] }, { titulo: 'Válido', detalle: ['y'] }],
        }),
      ])
    )
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([{ tipo: 'lista_detallada', items: [{ titulo: 'Válido', detalle: ['y'] }] }])
  })

  it('tabla sin columnas se descarta, aunque traiga filas', () => {
    const r = parser.parse(raw([bloque({ tipo: 'tabla', columnas: [], filas: [['a']] })]))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([])
  })

  it('una fila con MÁS celdas que columnas se recorta — si no, la tabla se desalinea entera', () => {
    const r = parser.parse(raw([bloque({ tipo: 'tabla', columnas: ['A', 'B'], filas: [['1', '2', '3']] })]))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([{ tipo: 'tabla', columnas: ['A', 'B'], filas: [['1', '2']] }])
  })

  it('una fila con MENOS celdas se rellena — si no, quedan huecos sin celda en el grid', () => {
    const r = parser.parse(raw([bloque({ tipo: 'tabla', columnas: ['A', 'B', 'C'], filas: [['1']] })]))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([{ tipo: 'tabla', columnas: ['A', 'B', 'C'], filas: [['1', '', '']] }])
  })

  it('renglones: un par sin valor se cae', () => {
    const r = parser.parse(
      raw([bloque({ tipo: 'renglones', pares: [{ etiqueta: 'Materia', valor: '' }, { etiqueta: 'Vence', valor: 'hoy' }] })])
    )
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([{ tipo: 'renglones', pares: [{ etiqueta: 'Vence', valor: 'hoy' }] }])
  })

  it('`bloques` mal tipado (no array) no rompe el parseo del resto', () => {
    const r = parser.parse(JSON.stringify({ tipoRespuesta: 'conversacional', mensaje: 'Hola', operaciones: [], bloques: 'nope' }))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques).toEqual([])
    expect(r.data.mensaje).toBe('Hola')
  })

  it('un modelo desviado que devuelve 100 bloques se recorta', () => {
    const muchos = Array.from({ length: 100 }, (_, i) => bloque({ tipo: 'texto', contenido: `bloque ${i}` }))
    const r = parser.parse(raw(muchos))
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.bloques.length).toBeLessThanOrEqual(8)
  })
})

describe('bloques — coexisten con operaciones', () => {
  it('una respuesta con operaciones también puede traer bloques', () => {
    const crudo = JSON.stringify({
      tipoRespuesta: 'operaciones',
      mensaje: '',
      operaciones: [{ tipo: 'crear', titulo: 'Ensayo', materia: '', fecha: '', prioridad: 'media', tipoTarea: 'ensayo', confidence: 0.9 }],
      bloques: [bloque({ tipo: 'lista', items: ['Ensayo de Historia'] })],
    })
    const r = parser.parse(crudo)
    if (!r.ok) throw new Error('no parseó')
    expect(r.data.operaciones).toHaveLength(1)
    expect(r.data.bloques).toHaveLength(1)
  })
})
