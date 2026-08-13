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

// Bugs pendientes / Parte 2 — crear_bloque/modificar_bloque/borrar_bloque:
// tercera extensión del schema, la de mayor riesgo (14→18 propiedades
// requeridas, ver el comentario en schema.ts). Estos tests cubren solo FORMA
// (el parser no conoce bloques reales, eso es resolver.ts).
describe('TaskManagementOutputParser — crear_bloque', () => {
  it('clase bien formada parsea correcto', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_bloque', tipoBloque: 'clase', materia: 'Física', diaSemanaBloque: 4, horaInicioBloque: '10:00', horaFinBloque: '11:00' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      expect(op.tipo).toBe('crear_bloque')
      if (op.tipo === 'crear_bloque') {
        expect(op.tipoBloque).toBe('clase')
        expect(op.materia).toBe('Física')
        expect(op.diaSemana).toBe(4)
        expect(op.horaInicio).toBe('10:00')
        expect(op.horaFin).toBe('11:00')
      }
    }
  })

  it('bloque especial (ingreso/salida/descanso) sin materia parsea correcto', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_bloque', tipoBloque: 'descanso', materia: '', diaSemanaBloque: 1, horaInicioBloque: '10:30', horaFinBloque: '10:45' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_bloque') {
        expect(op.tipoBloque).toBe('descanso')
        expect(op.materia).toBeNull()
      }
    }
  })

  it('bloque especial CON materia mandada por el modelo la descarta — nunca se guarda una materia en un bloque especial', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_bloque', tipoBloque: 'ingreso', materia: 'Ingreso', diaSemanaBloque: 1, horaInicioBloque: '06:30', horaFinBloque: '07:00' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_bloque') expect(op.materia).toBeNull()
    }
  })

  it('clase sin materia se descarta por completo — nunca crea un bloque de clase sin materia', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_bloque', tipoBloque: 'clase', materia: '', diaSemanaBloque: 4, horaInicioBloque: '10:00', horaFinBloque: '11:00' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.data.operaciones).toHaveLength(0)
  })

  it('tipoBloque ausente/inválido cae a "clase" (mismo default que crearBloqueHorarioSchema del servidor)', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_bloque', tipoBloque: 'algo-inventado', materia: 'Química', diaSemanaBloque: 2, horaInicioBloque: '08:00', horaFinBloque: '09:00' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_bloque') expect(op.tipoBloque).toBe('clase')
    }
  })

  it('hora con formato inválido cae a null, nunca se cuela un valor mal formado', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_bloque', tipoBloque: 'clase', materia: 'Física', diaSemanaBloque: 4, horaInicioBloque: '10h00', horaFinBloque: '11:00' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_bloque') expect(op.horaInicio).toBeNull()
    }
  })

  it('diaSemanaBloque fuera de 1-7 cae a null', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'crear_bloque', tipoBloque: 'clase', materia: 'Física', diaSemanaBloque: 9, horaInicioBloque: '10:00', horaFinBloque: '11:00' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'crear_bloque') expect(op.diaSemana).toBeNull()
    }
  })
})

describe('TaskManagementOutputParser — modificar_bloque / borrar_bloque', () => {
  it('modificar_bloque bien formado parsea correcto, con cambios y índice', () => {
    const resultado = parser.parse(
      raw([
        {
          tipo: 'modificar_bloque',
          descripcion: 'mi clase de Inglés',
          indiceObjetivo: 0,
          indicesCandidatos: [],
          horaInicioBloque: '09:00',
          horaFinBloque: '10:00',
        },
      ])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      expect(op.tipo).toBe('modificar_bloque')
      if (op.tipo === 'modificar_bloque') {
        expect(op.cambios).toEqual({ horaInicio: '09:00', horaFin: '10:00' })
        expect(op.indiceObjetivo).toBe(0)
      }
    }
  })

  it('borrar_bloque bien formado parsea correcto, cambios vacío (borrar no necesita cambios)', () => {
    const resultado = parser.parse(raw([{ tipo: 'borrar_bloque', descripcion: 'mi descanso de la tarde', indiceObjetivo: 0, indicesCandidatos: [] }]))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      expect(op.tipo).toBe('borrar_bloque')
      if (op.tipo === 'borrar_bloque') expect(op.cambios).toEqual({})
    }
  })

  it('modificar_bloque solo con cambio de materia — el resto de cambios queda ausente, no en blanco', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'modificar_bloque', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], materia: 'Química' }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'modificar_bloque') expect(op.cambios).toEqual({ materia: 'Química' })
    }
  })

  it('indicesCandidatos con valores mezclados se limpia sin lanzar, igual que el resto del parser', () => {
    const resultado = parser.parse(
      raw([{ tipo: 'modificar_bloque', descripcion: 'x', indiceObjetivo: null, indicesCandidatos: [0, -1, 'dos', 1] }])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'modificar_bloque') expect(op.indicesCandidatos).toEqual([0, 1])
    }
  })

  it('descripcion ausente cae al respaldo genérico', () => {
    const resultado = parser.parse(raw([{ tipo: 'borrar_bloque', indiceObjetivo: 0, indicesCandidatos: [] }]))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      const [op] = resultado.data.operaciones
      if (op.tipo === 'borrar_bloque') expect(op.descripcion).toBe('un bloque de horario')
    }
  })

  it('mezclado con crear_bloque/crear_nota/tarea en el mismo array — todos sobreviven, en orden', () => {
    const resultado = parser.parse(
      raw([
        { tipo: 'crear_bloque', tipoBloque: 'clase', materia: 'Física', diaSemanaBloque: 4, horaInicioBloque: '10:00', horaFinBloque: '11:00' },
        { tipo: 'modificar_bloque', descripcion: 'x', indiceObjetivo: 0, indicesCandidatos: [], horaInicioBloque: '09:00' },
        { tipo: 'borrar_bloque', descripcion: 'y', indiceObjetivo: 1, indicesCandidatos: [] },
        { tipo: 'crear', titulo: 'Ensayo', materia: '', fecha: '', prioridad: 'media', tipoTarea: 'ensayo', confidence: 0.9 },
      ])
    )
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.data.operaciones.map((o) => o.tipo)).toEqual(['crear_bloque', 'modificar_bloque', 'borrar_bloque', 'crear'])
    }
  })
})
