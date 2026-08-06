import { describe, expect, it } from 'vitest'
import { AnalisisArchivoOutputParser } from '../schema'

const parser = new AnalisisArchivoOutputParser()

const tareaValida = { titulo: 'Resolver ejercicios 1 al 10', materia: 'Cálculo', fecha: '2026-08-14', prioridad: 'alta', tipo: 'ejercicios', confidence: 0.9 }

function raw(obj: unknown): string {
  return JSON.stringify(obj)
}

describe('AnalisisArchivoOutputParser', () => {
  it('respuesta completa y bien formada se parsea entera', () => {
    const r = parser.parse(raw({ resumen: 'Guía de ejercicios de derivadas.', tipoDocumento: 'guia', tareas: [tareaValida] }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.resumen).toBe('Guía de ejercicios de derivadas.')
    expect(r.data.tipoDocumento).toBe('guia')
    expect(r.data.tareas).toHaveLength(1)
    expect(r.data.tareas[0].titulo).toBe('Resolver ejercicios 1 al 10')
    expect(r.data.tareas[0].id).toBeTruthy()
  })

  it('arreglo de tareas vacío es válido — un documento informativo no asigna nada', () => {
    const r = parser.parse(raw({ resumen: 'Apuntes de clase sobre la Revolución Francesa.', tipoDocumento: 'apuntes', tareas: [] }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.tareas).toEqual([])
      expect(r.data.resumen).toBeTruthy()
    }
  })

  it('NUNCA devuelve ok:false — el análisis es enriquecimiento, no puede tumbar nada', () => {
    for (const entrada of ['no es json', '', null, 42, undefined, '{"roto": ', raw([1, 2, 3]), raw(null)]) {
      const r = parser.parse(entrada)
      expect(r.ok).toBe(true)
    }
  })

  it('JSON inválido degrada a análisis vacío con tipoDocumento "otro"', () => {
    const r = parser.parse('esto no es JSON')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toEqual({ resumen: null, tipoDocumento: 'otro', tareas: [] })
  })

  it('tipoDocumento fuera del enum cerrado cae a "otro", nunca se propaga al check de Postgres', () => {
    const r = parser.parse(raw({ resumen: 'x', tipoDocumento: 'inventado_por_el_modelo', tareas: [] }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.tipoDocumento).toBe('otro')
  })

  it('resumen vacío o solo espacios se normaliza a null (la UI distingue "sin resumen" de "resumen vacío")', () => {
    for (const resumen of ['', '   ', 42, null]) {
      const r = parser.parse(raw({ resumen, tipoDocumento: 'otro', tareas: [] }))
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.resumen).toBeNull()
    }
  })

  it('tarea sin título se descarta entera, no se guarda a medias', () => {
    const r = parser.parse(raw({ resumen: 'x', tipoDocumento: 'guia', tareas: [{ ...tareaValida, titulo: '   ' }, tareaValida] }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.tareas).toHaveLength(1)
  })

  it('prioridad y tipo inválidos caen a sus valores por defecto en vez de propagarse', () => {
    const r = parser.parse(raw({ resumen: 'x', tipoDocumento: 'guia', tareas: [{ ...tareaValida, prioridad: 'urgentísima', tipo: 'no_existe' }] }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.tareas[0].prioridad).toBe('media')
      expect(r.data.tareas[0].tipo).toBe('otro')
    }
  })

  it('materia y fecha vacías ("" — el centinela del schema) se normalizan a null', () => {
    const r = parser.parse(raw({ resumen: 'x', tipoDocumento: 'guia', tareas: [{ ...tareaValida, materia: '', fecha: '' }] }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.tareas[0].materia).toBeNull()
      expect(r.data.tareas[0].fecha).toBeNull()
    }
  })

  it('confidence fuera de rango o no numérica se acota a [0,1]', () => {
    const r = parser.parse(
      raw({ resumen: 'x', tipoDocumento: 'guia', tareas: [{ ...tareaValida, confidence: 5 }, { ...tareaValida, confidence: -2 }, { ...tareaValida, confidence: 'alta' }] })
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.tareas[0].confidence).toBe(1)
      expect(r.data.tareas[1].confidence).toBe(0)
      expect(r.data.tareas[2].confidence).toBe(0.5)
    }
  })

  it('trunca a 15 tareas aunque el modelo devuelva más (tope defensivo, no se confía en el schema)', () => {
    const muchas = Array.from({ length: 40 }, (_, i) => ({ ...tareaValida, titulo: `Tarea ${i}` }))
    const r = parser.parse(raw({ resumen: 'x', tipoDocumento: 'guia', tareas: muchas }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.tareas).toHaveLength(15)
  })

  it('items no-objeto dentro de tareas se saltan sin lanzar', () => {
    const r = parser.parse(raw({ resumen: 'x', tipoDocumento: 'guia', tareas: [null, 'texto', 42, tareaValida] }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.tareas).toHaveLength(1)
  })
})
