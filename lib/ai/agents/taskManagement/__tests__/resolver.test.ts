import { describe, expect, it } from 'vitest'
import { resolverOperaciones, resolverNotas } from '../resolver'
import type { OperacionRaw, OperacionCrearNotaRaw } from '../schema'
import type { TareaContexto } from '../types'

const MATE: TareaContexto = { id: 'tarea-mate', titulo: 'Examen de matemáticas', materia: 'Matemáticas', fecha: '2026-07-30', completada: false }
const MATE2: TareaContexto = { id: 'tarea-mate-2', titulo: 'Tarea de matemáticas', materia: 'Matemáticas', fecha: '2026-08-02', completada: false }
const BIO: TareaContexto = { id: 'tarea-bio', titulo: 'Laboratorio de biología', materia: 'Biología', fecha: '2026-07-29', completada: false }

const tareasExistentes = [MATE, MATE2, BIO] // índices 0, 1, 2

function crearRaw(overrides: Partial<Extract<OperacionRaw, { tipo: 'crear' }>> = {}): OperacionRaw {
  return {
    tipo: 'crear',
    titulo: 'Ensayo de literatura',
    materia: 'Literatura',
    fecha: null,
    prioridad: 'media',
    tipoTarea: 'ensayo',
    confidence: 0.8,
    ...overrides,
  }
}

function refRaw(overrides: Partial<Extract<OperacionRaw, { tipo: 'modificar' | 'borrar' | 'ambiguo' }>> = {}): OperacionRaw {
  return {
    tipo: 'modificar',
    descripcion: 'la de biología',
    indiceObjetivo: null,
    indicesCandidatos: [],
    accionOriginal: null,
    cambios: {},
    ...overrides,
  }
}

describe('resolverOperaciones — crear', () => {
  it('pasa una operación de crear tal cual, con id nuevo', () => {
    const [op] = resolverOperaciones([crearRaw()], tareasExistentes)
    expect(op.tipo).toBe('crear')
    expect(op.id).toBeTruthy()
    if (op.tipo === 'crear') expect(op.titulo).toBe('Ensayo de literatura')
  })
})

describe('resolverOperaciones — borrar/modificar con índice único', () => {
  it('borrar con indiceObjetivo válido resuelve contra la tarea real (por id, no por posición)', () => {
    const [op] = resolverOperaciones([refRaw({ tipo: 'borrar', indiceObjetivo: 2 })], tareasExistentes)
    expect(op.tipo).toBe('borrar')
    if (op.tipo === 'borrar') {
      expect(op.tareaId).toBe(BIO.id)
      expect(op.antes).toEqual(BIO)
    }
  })

  it('modificar con indiceObjetivo válido lleva los cambios pedidos y el estado "antes"', () => {
    const [op] = resolverOperaciones(
      [refRaw({ tipo: 'modificar', indiceObjetivo: 0, cambios: { fecha: '2026-08-05' } })],
      tareasExistentes
    )
    expect(op.tipo).toBe('modificar')
    if (op.tipo === 'modificar') {
      expect(op.tareaId).toBe(MATE.id)
      expect(op.antes).toEqual(MATE)
      expect(op.cambios).toEqual({ fecha: '2026-08-05' })
    }
  })

  it('indiceObjetivo fuera de rango (alucinado) degrada a sin_coincidencias, nunca aplica a la tarea equivocada', () => {
    const [op] = resolverOperaciones([refRaw({ tipo: 'borrar', indiceObjetivo: 99 })], tareasExistentes)
    expect(op.tipo).toBe('sin_coincidencias')
  })

  it('indiceObjetivo negativo también degrada a sin_coincidencias', () => {
    const [op] = resolverOperaciones([refRaw({ tipo: 'modificar', indiceObjetivo: -1 })], tareasExistentes)
    expect(op.tipo).toBe('sin_coincidencias')
  })
})

describe('resolverOperaciones — ambigüedad', () => {
  it('más de un candidato válido queda "ambiguo" con la lista real de candidatos', () => {
    const [op] = resolverOperaciones(
      [refRaw({ tipo: 'ambiguo', descripcion: 'la de matemáticas', indicesCandidatos: [0, 1], accionOriginal: 'borrar' })],
      tareasExistentes
    )
    expect(op.tipo).toBe('ambiguo')
    if (op.tipo === 'ambiguo') {
      expect(op.candidatos).toEqual([MATE, MATE2])
      expect(op.accionOriginal).toBe('borrar')
    }
  })

  it('un solo candidato válido tras filtrar índices fuera de rango deja de ser ambiguo y se resuelve', () => {
    const [op] = resolverOperaciones(
      [refRaw({ tipo: 'ambiguo', indicesCandidatos: [1, 99], accionOriginal: 'modificar', cambios: { completada: true } })],
      tareasExistentes
    )
    expect(op.tipo).toBe('modificar')
    if (op.tipo === 'modificar') expect(op.tareaId).toBe(MATE2.id)
  })

  it('>1 candidato gana como ambiguo aunque el modelo haya dicho tipo "modificar" (defensivo, nunca aplica solo por posición)', () => {
    const [op] = resolverOperaciones(
      [refRaw({ tipo: 'modificar', indicesCandidatos: [0, 1], indiceObjetivo: 0, cambios: { completada: true } })],
      tareasExistentes
    )
    expect(op.tipo).toBe('ambiguo')
  })

  it('"ambiguo" sin accionOriginal declarado por el modelo cae a "modificar" (menos destructivo por defecto)', () => {
    const [op] = resolverOperaciones([refRaw({ tipo: 'ambiguo', indicesCandidatos: [0, 2], accionOriginal: null })], tareasExistentes)
    expect(op.tipo).toBe('ambiguo')
    if (op.tipo === 'ambiguo') expect(op.accionOriginal).toBe('modificar')
  })

  it('"ambiguo" sin ningún candidato válido degrada a sin_coincidencias', () => {
    const [op] = resolverOperaciones([refRaw({ tipo: 'ambiguo', indicesCandidatos: [50, 99] })], tareasExistentes)
    expect(op.tipo).toBe('sin_coincidencias')
  })
})

describe('resolverOperaciones — sin_coincidencias explícito del modelo', () => {
  it('se conserva tal cual, con la descripción original', () => {
    const [op] = resolverOperaciones([{ tipo: 'sin_coincidencias', descripcion: 'la tarea de química' }], tareasExistentes)
    expect(op).toMatchObject({ tipo: 'sin_coincidencias', descripcion: 'la tarea de química' })
  })
})

describe('resolverOperaciones — instrucciones mixtas', () => {
  it('produce una operación por cada entrada, en el mismo orden', () => {
    const ops = resolverOperaciones(
      [crearRaw({ titulo: 'Leer capítulo 5' }), refRaw({ tipo: 'borrar', indiceObjetivo: 2 })],
      tareasExistentes
    )
    expect(ops).toHaveLength(2)
    expect(ops[0].tipo).toBe('crear')
    expect(ops[1].tipo).toBe('borrar')
  })
})

// Sprint Archivos / Fase 4.2 — crear_nota reusa resolverCandidatos (la misma
// lógica que modificar/borrar/ambiguo), pero resuelve a un tipo separado
// (OperacionCrearNotaResuelta) que NUNCA aparece en el array que devuelve
// resolverOperaciones() — ese array es exactamente lo que components/ai/*
// ya consume en producción, y no debe cambiar de forma por este sprint.
function notaRaw(overrides: Partial<OperacionCrearNotaRaw> = {}): OperacionRaw {
  return {
    tipo: 'crear_nota',
    descripcion: 'la de matemáticas',
    indiceObjetivo: null,
    indicesCandidatos: [],
    contenidoNota: 'faltó resolver el punto 3',
    ...overrides,
  }
}

describe('resolverOperaciones — crear_nota queda EXCLUIDO del array público', () => {
  it('un crear_nota resuelto no aparece en absoluto en resolverOperaciones()', () => {
    const ops = resolverOperaciones([notaRaw({ indiceObjetivo: 0 })], tareasExistentes)
    expect(ops).toHaveLength(0)
  })

  it('crear_nota mezclado con una operación real: solo la real aparece en el array público', () => {
    const ops = resolverOperaciones(
      [notaRaw({ indiceObjetivo: 0 }), refRaw({ tipo: 'borrar', indiceObjetivo: 2 })],
      tareasExistentes
    )
    expect(ops).toHaveLength(1)
    expect(ops[0].tipo).toBe('borrar')
  })
})

describe('resolverNotas', () => {
  it('índice único válido → resuelto contra la tarea real', () => {
    const [nota] = resolverNotas([notaRaw({ indiceObjetivo: 0, contenidoNota: 'faltó el punto 3' })], tareasExistentes)
    expect(nota.estado).toBe('resuelto')
    if (nota.estado === 'resuelto') {
      expect(nota.tareaId).toBe(MATE.id)
      expect(nota.contenidoNota).toBe('faltó el punto 3')
    }
  })

  it('>1 candidato válido → ambiguo, con la lista real de candidatos (mismo criterio defensivo que modificar/borrar)', () => {
    const [nota] = resolverNotas([notaRaw({ indicesCandidatos: [0, 1] })], tareasExistentes)
    expect(nota.estado).toBe('ambiguo')
    if (nota.estado === 'ambiguo') {
      expect(nota.candidatos).toEqual([MATE, MATE2])
      expect(nota.contenidoNota).toBe('faltó resolver el punto 3')
    }
  })

  it('índice alucinado (fuera de rango) → sin_coincidencias, nunca crea la nota en la tarea equivocada', () => {
    const [nota] = resolverNotas([notaRaw({ indiceObjetivo: 99 })], tareasExistentes)
    expect(nota.estado).toBe('sin_coincidencias')
  })

  it('sin ningún índice ni candidato → sin_coincidencias', () => {
    const [nota] = resolverNotas([notaRaw()], tareasExistentes)
    expect(nota.estado).toBe('sin_coincidencias')
  })

  it('ignora por completo las operaciones que no son crear_nota', () => {
    const notas = resolverNotas([crearRaw(), refRaw({ tipo: 'borrar', indiceObjetivo: 0 })], tareasExistentes)
    expect(notas).toHaveLength(0)
  })

  it('cada nota resuelta tiene un id propio', () => {
    const [n1, n2] = resolverNotas(
      [notaRaw({ indiceObjetivo: 0 }), notaRaw({ indiceObjetivo: 2, contenidoNota: 'otra nota' })],
      tareasExistentes
    )
    expect(n1.id).toBeTruthy()
    expect(n2.id).toBeTruthy()
    expect(n1.id).not.toBe(n2.id)
  })
})
