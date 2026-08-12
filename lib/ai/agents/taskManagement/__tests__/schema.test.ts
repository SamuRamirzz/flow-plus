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

// Sprint Sistema de Notas Unificado (Parte E) — `objetivoTipo` es el único
// campo NUEVO agregado a crear_nota en este sprint (13→14 propiedades).
describe('TaskManagementOutputParser — crear_nota con objetivoTipo', () => {
  it('objetivoTipo "bloque_horario" se conserva tal cual', () => {
    const resultado = parser.parse(
      raw([
        {
          tipo: 'crear_nota',
          descripcion: 'mi clase de inglés',
          indiceObjetivo: 0,
          indicesCandidatos: [],
          objetivoTipo: 'bloque_horario',
          contenidoNota: 'llevar el libro',
        },
      ])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_nota') expect(op.objetivoTipo).toBe('bloque_horario')
    }
  })

  it('objetivoTipo "tarea" se conserva tal cual', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_nota', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], objetivoTipo: 'tarea', contenidoNota: 'y' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_nota') expect(op.objetivoTipo).toBe('tarea')
    }
  })

  // Sprint Sistema de Notas Unificado (cierre del gap de "archivo existente")
  it('objetivoTipo "archivo" se conserva tal cual', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_nota', descripcion: 'mi apunte de física', indiceObjetivo: 0, indicesCandidatos: [], objetivoTipo: 'archivo', contenidoNota: 'y' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_nota') expect(op.objetivoTipo).toBe('archivo')
    }
  })

  it('objetivoTipo ausente/inválido/mal tipado cae a "tarea" (compatibilidad con respuestas de antes de este sprint)', () => {
    for (const objetivoTipo of [undefined, null, '', 'nota', 'algo-inventado', 42]) {
      const resultado = parser.parse(
        raw([{ tipo: 'crear_nota', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], objetivoTipo, contenidoNota: 'y' }])
      )
      expect(resultado.ok).toBe(true)
      if (resultado.ok) {
        const [op] = resultado.data.operaciones
        if (op.tipo === 'crear_nota') expect(op.objetivoTipo).toBe('tarea')
      }
    }
  })
})

// Sprint Sistema de Notas Unificado (Parte E) — editar_nota/borrar_nota son
// los DOS miembros nuevos de la unión (sin campos propios nuevos: reusan
// indiceObjetivo/indicesCandidatos/contenidoNota, ya presentes en el
// schema).
describe('TaskManagementOutputParser — editar_nota / borrar_nota', () => {
  it('editar_nota bien formado parsea correcto, con contenidoNuevo e índices', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'editar_nota', descripcion: 'la de historia', indiceObjetivo: 1, indicesCandidatos: [], contenidoNota: 'nuevo contenido' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.data.operaciones).toHaveLength(1)
      const [op] = resultado.data.operaciones
      expect(op.tipo).toBe('editar_nota')
      if (op.tipo === 'editar_nota') {
        expect(op.contenidoNuevo).toBe('nuevo contenido')
        expect(op.indiceObjetivo).toBe(1)
      }
    }
  })

  it('editar_nota sin contenidoNota (o vacío) descarta el item entero — no habría nada que cambiar', () => {
    for (const contenidoNota of ['', '   ', undefined, null]) {
      const resultado = parser.parse(raw([{ tipo: 'editar_nota', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], contenidoNota }]))
      expect(resultado.ok).toBe(true)
      if (resultado.ok) expect(resultado.data.operaciones).toHaveLength(0)
    }
  })

  it('borrar_nota bien formado parsea correcto, contenidoNuevo null (nunca lo necesita)', () => {
    const resultado = parser.parse(raw([{ tipo: 'borrar_nota', descripcion: 'la de historia', indiceObjetivo: 0, indicesCandidatos: [] }]))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      expect(op.tipo).toBe('borrar_nota')
      if (op.tipo === 'borrar_nota') expect(op.contenidoNuevo).toBeNull()
    }
  })

  it('borrar_nota NUNCA se descarta por falta de contenidoNota (a diferencia de editar_nota) — borrar no necesita contenido', () => {
    const resultado = parser.parse(raw([{ tipo: 'borrar_nota', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], contenidoNota: '' }]))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.data.operaciones).toHaveLength(1)
  })

  it('indicesCandidatos con valores mezclados se limpia sin lanzar, igual que crear_nota', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'editar_nota', descripcion: 'x', indiceObjetivo: null, indicesCandidatos: [0, -1, 'dos', 1], contenidoNota: 'y' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'editar_nota') expect(op.indicesCandidatos).toEqual([0, 1])
    }
  })

  it('mezclado con crear_nota/modificar en el mismo array — todos sobreviven, en orden', () => {
    const resultado = parser.parse(
      raw([
        { tipo: 'crear_nota', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], objetivoTipo: 'tarea', contenidoNota: 'nota nueva' },
        { tipo: 'editar_nota', descripcion: 'y', indiceObjetivo: 0, indicesCandidatos: [], contenidoNota: 'editada' },
        { tipo: 'borrar_nota', descripcion: 'z', indiceObjetivo: 1, indicesCandidatos: [] },
      ])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.data.operaciones.map((o) => o.tipo)).toEqual(['crear_nota', 'editar_nota', 'borrar_nota'])
    }
  })
})
