import { describe, expect, it } from 'vitest'
import { politicaDeAnalisis } from '../analisisArchivo'

const MB = 1024 * 1024

describe('politicaDeAnalisis', () => {
  it('imágenes van por el camino de visión', () => {
    for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(politicaDeAnalisis(mime, 1000)).toEqual({ analizable: true, via: 'imagen' })
    }
  })

  it('PDF va como documento (no como imagen — Gemini los trata distinto)', () => {
    expect(politicaDeAnalisis('application/pdf', 1000)).toEqual({ analizable: true, via: 'documento' })
  })

  it('texto plano y markdown van como texto, no como binario base64', () => {
    for (const mime of ['text/plain', 'text/markdown', 'text/csv']) {
      expect(politicaDeAnalisis(mime, 1000)).toEqual({ analizable: true, via: 'texto' })
    }
  })

  it('.docx NO es analizable, y el motivo lo dice explícitamente', () => {
    const r = politicaDeAnalisis('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1000)
    expect(r.analizable).toBe(false)
    if (!r.analizable) expect(r.motivo).toContain('todavía no se puede analizar')
  })

  it('un archivo sin mime type no se analiza (mejor decirlo que mandar basura al modelo)', () => {
    const r = politicaDeAnalisis(null, 1000)
    expect(r.analizable).toBe(false)
    if (!r.analizable) expect(r.motivo).toContain('tipo reconocible')
  })

  it('el límite de tamaño gana incluso sobre un formato soportado', () => {
    const r = politicaDeAnalisis('application/pdf', 30 * MB)
    expect(r.analizable).toBe(false)
    if (!r.analizable) expect(r.motivo).toContain('MB')
  })

  it('justo por debajo del límite sigue siendo analizable', () => {
    expect(politicaDeAnalisis('application/pdf', 14 * MB)).toEqual({ analizable: true, via: 'documento' })
  })

  it('tamaño desconocido (null) no bloquea — se intenta y que falle el proveedor si es enorme', () => {
    expect(politicaDeAnalisis('application/pdf', null)).toEqual({ analizable: true, via: 'documento' })
  })
})
