import { describe, expect, it } from 'vitest'
import { tipoDeArchivo, validarAdjunto, concatenarTextoConAdjuntos, LIMITE_ADJUNTOS_POR_MENSAJE, type AdjuntoTextoProcesado } from '../adjuntos'

function archivo(nombre: string, tipo: string, bytes = 10): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo })
}

describe('tipoDeArchivo', () => {
  it('reconoce imágenes por MIME', () => {
    expect(tipoDeArchivo(archivo('foto.png', 'image/png'))).toBe('imagen')
    expect(tipoDeArchivo(archivo('foto.jpg', 'image/jpeg'))).toBe('imagen')
    expect(tipoDeArchivo(archivo('foto.webp', 'image/webp'))).toBe('imagen')
  })

  it('reconoce PDF', () => {
    expect(tipoDeArchivo(archivo('enunciado.pdf', 'application/pdf'))).toBe('documento')
  })

  it('reconoce .txt/.md por MIME', () => {
    expect(tipoDeArchivo(archivo('notas.txt', 'text/plain'))).toBe('texto')
    expect(tipoDeArchivo(archivo('notas.md', 'text/markdown'))).toBe('texto')
  })

  it('reconoce .md por extensión aunque el navegador mande mimeType vacío', () => {
    expect(tipoDeArchivo(archivo('notas.md', ''))).toBe('texto')
    expect(tipoDeArchivo(archivo('notas.txt', ''))).toBe('texto')
  })

  it('un tipo no soportado (ej. .docx) devuelve null', () => {
    expect(tipoDeArchivo(archivo('tarea.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBeNull()
    expect(tipoDeArchivo(archivo('cancion.mp3', 'audio/mpeg'))).toBeNull()
  })
})

describe('validarAdjunto', () => {
  it('imagen y PDF de tamaño normal pasan sin error', () => {
    expect(validarAdjunto(archivo('foto.png', 'image/png'))).toBeNull()
    expect(validarAdjunto(archivo('enunciado.pdf', 'application/pdf'))).toBeNull()
  })

  it('tipo no soportado da un mensaje explicando qué sí se acepta', () => {
    expect(validarAdjunto(archivo('tarea.docx', 'application/octet-stream'))).toMatch(/PNG\/JPG\/WEBP.*PDF.*TXT.*MD/)
  })

  it('PDF por encima del límite se rechaza', () => {
    const grande = archivo('enunciado.pdf', 'application/pdf', 11 * 1024 * 1024)
    expect(validarAdjunto(grande)).toMatch(/máx\. 10MB/)
  })

  it('texto por encima de su límite se rechaza', () => {
    const grande = archivo('apuntes.txt', 'text/plain', 3 * 1024 * 1024)
    expect(validarAdjunto(grande)).toMatch(/máx\. 2MB/)
  })
})

describe('concatenarTextoConAdjuntos', () => {
  it('sin adjuntos de texto, el mensaje queda intacto', () => {
    expect(concatenarTextoConAdjuntos('crea la tarea', [])).toBe('crea la tarea')
  })

  it('agrega el contenido de cada archivo con un separador que lo identifica', () => {
    const textos: AdjuntoTextoProcesado[] = [{ ok: true, tipo: 'texto', nombre: 'notas.txt', contenido: 'Entregar el jueves' }]
    const resultado = concatenarTextoConAdjuntos('esto es para clase', textos)
    expect(resultado).toContain('esto es para clase')
    expect(resultado).toContain('notas.txt')
    expect(resultado).toContain('Entregar el jueves')
  })

  it('varios archivos de texto se concatenan todos, en orden', () => {
    const textos: AdjuntoTextoProcesado[] = [
      { ok: true, tipo: 'texto', nombre: 'a.txt', contenido: 'contenido A' },
      { ok: true, tipo: 'texto', nombre: 'b.md', contenido: 'contenido B' },
    ]
    const resultado = concatenarTextoConAdjuntos('', textos)
    expect(resultado.indexOf('contenido A')).toBeLessThan(resultado.indexOf('contenido B'))
  })
})

describe('LIMITE_ADJUNTOS_POR_MENSAJE', () => {
  it('es un número positivo razonable (documentado en el código)', () => {
    expect(LIMITE_ADJUNTOS_POR_MENSAJE).toBeGreaterThan(0)
    expect(LIMITE_ADJUNTOS_POR_MENSAJE).toBeLessThanOrEqual(10)
  })
})
