import { describe, expect, it } from 'vitest'
import { TaskManagementOutputParser } from '../schema'

const parser = new TaskManagementOutputParser()

function raw(operaciones: unknown[]): string {
  return JSON.stringify({ tipoRespuesta: 'operaciones', mensaje: '', operaciones })
}

// Sprint Archivos / Fase 4.2 — el parser solo valida FORMA (no resuelve
// índices contra tareas reales, eso es resolver.ts). Estos tests cubren
// específicamente `tipo: 'crear_nota'`, el único agregado de este sprint al
// parser ya existente.
describe('TaskManagementOutputParser — crear_nota', () => {
  it('JSON bien formado parsea correcto, con contenidoNota e índices', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_nota', descripcion: 'la de matemáticas', indiceObjetivo: 0, indicesCandidatos: [], contenidoNota: 'faltó el punto 3' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.data.operaciones).toHaveLength(1)
      const [op] = resultado.data.operaciones
      expect(op.tipo).toBe('crear_nota')
      if (op.tipo === 'crear_nota') {
        expect(op.contenidoNota).toBe('faltó el punto 3')
        expect(op.indiceObjetivo).toBe(0)
      }
    }
  })

  it('contenidoNota vacío ("" — el sentinel de "no aplica") descarta el item entero, no lo deja a medias', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_nota', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], contenidoNota: '' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.data.operaciones).toHaveLength(0)
  })

  it('contenidoNota solo espacios en blanco se trata igual que vacío', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_nota', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], contenidoNota: '   ' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.data.operaciones).toHaveLength(0)
  })

  it('contenidoNota ausente o mal tipado nunca lanza — cae al mismo descarte que vacío', () => {
    for (const contenidoNota of [undefined, null, 42, {}]) {
      const resultado = parser.parse(raw([{ tipo: 'crear_nota', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], contenidoNota }]))
      expect(resultado.ok).toBe(true)
      if (resultado.ok) expect(resultado.data.operaciones).toHaveLength(0)
    }
  })

  it('indicesCandidatos con valores mezclados (válidos, negativos, no numéricos) se limpia sin lanzar', () => {
    const resultado = parser.parse(
      raw([
        {
          tipo: 'crear_nota',
          descripcion: 'x',
          indiceObjetivo: null,
          indicesCandidatos: [0, -1, 'dos', 2, 1.5],
          contenidoNota: 'contenido',
        },
      ])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_nota') expect(op.indicesCandidatos).toEqual([0, 2])
    }
  })

  it('indiceObjetivo ausente/inválido cae a null, no a un número inventado', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_nota', descripcion: 'x', indiceObjetivo: 'no-es-numero', indicesCandidatos: [], contenidoNota: 'y' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_nota') expect(op.indiceObjetivo).toBeNull()
    }
  })

  it('descripcion ausente cae al respaldo genérico, igual que modificar/borrar', () => {
    const resultado = parser.parse(raw([{ tipo: 'crear_nota', indiceObjetivo: 0, indicesCandidatos: [], contenidoNota: 'y' }]))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_nota') expect(op.descripcion).toBe('una tarea')
    }
  })

  it('mezclado con crear/modificar en el mismo array — todos sobreviven, en orden', () => {
    const resultado = parser.parse(
      raw([
        { tipo: 'crear', titulo: 'Ensayo', materia: '', fecha: '', prioridad: 'media', tipoTarea: 'ensayo', confidence: 0.9 },
        { tipo: 'crear_nota', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], contenidoNota: 'nota' },
      ])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.data.operaciones.map((o) => o.tipo)).toEqual(['crear', 'crear_nota'])
    }
  })
})
