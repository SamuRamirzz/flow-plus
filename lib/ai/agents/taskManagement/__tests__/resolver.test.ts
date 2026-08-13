import { describe, expect, it } from 'vitest'
import { resolverOperaciones, resolverNotas, resolverOperacionesNotaExistente, resolverBloques, resolverOperacionesBloqueExistente } from '../resolver'
import type { OperacionRaw, OperacionCrearNotaRaw, OperacionNotaExistenteRaw, OperacionCrearBloqueRaw, OperacionBloqueExistenteRaw } from '../schema'
import type { TareaContexto, BloqueHorarioContexto, ArchivoContexto, NotaContextoIA } from '../types'

const MATE: TareaContexto = { id: 'tarea-mate', titulo: 'Examen de matemáticas', materia: 'Matemáticas', fecha: '2026-07-30', completada: false }
const MATE2: TareaContexto = { id: 'tarea-mate-2', titulo: 'Tarea de matemáticas', materia: 'Matemáticas', fecha: '2026-08-02', completada: false }
const BIO: TareaContexto = { id: 'tarea-bio', titulo: 'Laboratorio de biología', materia: 'Biología', fecha: '2026-07-29', completada: false }

const tareasExistentes = [MATE, MATE2, BIO] // índices 0, 1, 2

const INGLES_LUNES: BloqueHorarioContexto = { id: 'bloque-ingles', nombre: 'Inglés', diaSemana: 1, horaInicio: '08:00', horaFin: '09:00' }
const INGRESO: BloqueHorarioContexto = { id: 'bloque-ingreso', nombre: 'Ingreso', diaSemana: 1, horaInicio: '07:00', horaFin: '07:30' }
const bloquesExistentes = [INGLES_LUNES, INGRESO] // índices 0, 1

const APUNTE_FISICA: ArchivoContexto = { id: 'archivo-fisica', nombre: 'Apunte de Física' }
const COLLECTIVE_NOUNS: ArchivoContexto = { id: 'archivo-cn', nombre: 'Collective Nouns.pptx' }
const archivosExistentes = [APUNTE_FISICA, COLLECTIVE_NOUNS] // índices 0, 1

const NOTA_MATE: NotaContextoIA = { id: 'nota-mate', anclaTexto: 'tarea "Examen de matemáticas"', contenido: 'repasar integrales' }
const NOTA_INGRESO: NotaContextoIA = { id: 'nota-ingreso', anclaTexto: 'bloque "Ingreso" (Lun)', contenido: 'llevar el carnet' }
const notasExistentes = [NOTA_MATE, NOTA_INGRESO] // índices 0, 1

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
    objetivoTipo: 'tarea',
    contenidoNota: 'faltó resolver el punto 3',
    ...overrides,
  }
}

// Sprint Sistema de Notas Unificado (Parte E) — mismo espíritu que notaRaw:
// editar_nota/borrar_nota comparten forma (OperacionNotaExistenteRaw).
function notaExistenteRaw(overrides: Partial<OperacionNotaExistenteRaw> = {}): OperacionRaw {
  return {
    tipo: 'editar_nota',
    descripcion: 'la nota de matemáticas',
    indiceObjetivo: null,
    indicesCandidatos: [],
    contenidoNuevo: 'contenido actualizado',
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
  it('índice único válido, objetivoTipo "tarea" → resuelto contra la tarea real', () => {
    const [nota] = resolverNotas([notaRaw({ indiceObjetivo: 0, contenidoNota: 'faltó el punto 3' })], tareasExistentes, bloquesExistentes, archivosExistentes)
    expect(nota.estado).toBe('resuelto')
    if (nota.estado === 'resuelto') {
      expect(nota.ancla).toEqual({ tipo: 'tarea', id: MATE.id })
      expect(nota.contenidoNota).toBe('faltó el punto 3')
    }
  })

  it('>1 candidato válido → ambiguo, con la lista real de candidatos (mismo criterio defensivo que modificar/borrar)', () => {
    const [nota] = resolverNotas([notaRaw({ indicesCandidatos: [0, 1] })], tareasExistentes, bloquesExistentes, archivosExistentes)
    expect(nota.estado).toBe('ambiguo')
    if (nota.estado === 'ambiguo') {
      expect(nota.candidatos).toEqual([MATE, MATE2])
      expect(nota.contenidoNota).toBe('faltó resolver el punto 3')
    }
  })

  it('índice alucinado (fuera de rango) → sin_coincidencias, nunca crea la nota en la tarea equivocada', () => {
    const [nota] = resolverNotas([notaRaw({ indiceObjetivo: 99 })], tareasExistentes, bloquesExistentes, archivosExistentes)
    expect(nota.estado).toBe('sin_coincidencias')
  })

  it('sin ningún índice ni candidato → sin_coincidencias', () => {
    const [nota] = resolverNotas([notaRaw()], tareasExistentes, bloquesExistentes, archivosExistentes)
    expect(nota.estado).toBe('sin_coincidencias')
  })

  it('ignora por completo las operaciones que no son crear_nota', () => {
    const notas = resolverNotas([crearRaw(), refRaw({ tipo: 'borrar', indiceObjetivo: 0 })], tareasExistentes, bloquesExistentes, archivosExistentes)
    expect(notas).toHaveLength(0)
  })

  it('cada nota resuelta tiene un id propio', () => {
    const [n1, n2] = resolverNotas(
      [notaRaw({ indiceObjetivo: 0 }), notaRaw({ indiceObjetivo: 2, contenidoNota: 'otra nota' })],
      tareasExistentes,
      bloquesExistentes,
      archivosExistentes
    )
    expect(n1.id).toBeTruthy()
    expect(n2.id).toBeTruthy()
    expect(n1.id).not.toBe(n2.id)
  })

  // Sprint Sistema de Notas Unificado (Parte E)
  it('objetivoTipo "bloque_horario" → resuelto contra el bloque real, no contra tareas', () => {
    const [nota] = resolverNotas(
      [notaRaw({ objetivoTipo: 'bloque_horario', indiceObjetivo: 0, contenidoNota: 'llevar el libro' })],
      tareasExistentes,
      bloquesExistentes,
      archivosExistentes
    )
    expect(nota.estado).toBe('resuelto')
    if (nota.estado === 'resuelto') expect(nota.ancla).toEqual({ tipo: 'bloque_horario', id: INGLES_LUNES.id })
  })

  it('objetivoTipo "bloque_horario" resuelve correctamente contra un bloque ESPECIAL (ingreso/salida/descanso)', () => {
    const [nota] = resolverNotas(
      [notaRaw({ objetivoTipo: 'bloque_horario', indiceObjetivo: 1, contenidoNota: 'llevar el carnet' })],
      tareasExistentes,
      bloquesExistentes,
      archivosExistentes
    )
    expect(nota.estado).toBe('resuelto')
    if (nota.estado === 'resuelto') expect(nota.ancla).toEqual({ tipo: 'bloque_horario', id: INGRESO.id })
  })

  it('objetivoTipo "bloque_horario" con >1 candidato → ambiguo con los BLOQUES candidatos (no tareas)', () => {
    const [nota] = resolverNotas(
      [notaRaw({ objetivoTipo: 'bloque_horario', indicesCandidatos: [0, 1] })],
      tareasExistentes,
      bloquesExistentes,
      archivosExistentes
    )
    expect(nota.estado).toBe('ambiguo')
    if (nota.estado === 'ambiguo') expect(nota.candidatos).toEqual([INGLES_LUNES, INGRESO])
  })

  it('índice fuera de rango en objetivoTipo "bloque_horario" → sin_coincidencias', () => {
    const [nota] = resolverNotas([notaRaw({ objetivoTipo: 'bloque_horario', indiceObjetivo: 99 })], tareasExistentes, bloquesExistentes, archivosExistentes)
    expect(nota.estado).toBe('sin_coincidencias')
  })

  // Sprint Sistema de Notas Unificado (Parte E, cierre del gap de "archivo
  // existente") — mismo criterio que objetivoTipo "bloque_horario": resuelve
  // contra `archivosExistentes`, nunca contra tareas ni bloques.
  it('objetivoTipo "archivo" → resuelto contra el archivo real', () => {
    const [nota] = resolverNotas(
      [notaRaw({ objetivoTipo: 'archivo', indiceObjetivo: 1, contenidoNota: 'revisar la sección de animales' })],
      tareasExistentes,
      bloquesExistentes,
      archivosExistentes
    )
    expect(nota.estado).toBe('resuelto')
    if (nota.estado === 'resuelto') expect(nota.ancla).toEqual({ tipo: 'archivo', id: COLLECTIVE_NOUNS.id })
  })

  it('objetivoTipo "archivo" con >1 candidato → ambiguo con los ARCHIVOS candidatos', () => {
    const [nota] = resolverNotas(
      [notaRaw({ objetivoTipo: 'archivo', indicesCandidatos: [0, 1] })],
      tareasExistentes,
      bloquesExistentes,
      archivosExistentes
    )
    expect(nota.estado).toBe('ambiguo')
    if (nota.estado === 'ambiguo') expect(nota.candidatos).toEqual([APUNTE_FISICA, COLLECTIVE_NOUNS])
  })

  it('índice fuera de rango en objetivoTipo "archivo" → sin_coincidencias', () => {
    const [nota] = resolverNotas([notaRaw({ objetivoTipo: 'archivo', indiceObjetivo: 99 })], tareasExistentes, bloquesExistentes, archivosExistentes)
    expect(nota.estado).toBe('sin_coincidencias')
  })
})

describe('resolverOperacionesNotaExistente (Sprint Sistema de Notas Unificado)', () => {
  it('editar_nota con índice único → resuelto, accion "editar", con el contenido nuevo', () => {
    const [op] = resolverOperacionesNotaExistente([notaExistenteRaw({ tipo: 'editar_nota', indiceObjetivo: 0 })], notasExistentes)
    expect(op.estado).toBe('resuelto')
    expect(op.accion).toBe('editar')
    if (op.estado === 'resuelto') {
      expect(op.notaId).toBe(NOTA_MATE.id)
      expect(op.contenidoNuevo).toBe('contenido actualizado')
    }
  })

  it('borrar_nota con índice único → resuelto, accion "borrar", sin contenidoNuevo', () => {
    const [op] = resolverOperacionesNotaExistente(
      [notaExistenteRaw({ tipo: 'borrar_nota', indiceObjetivo: 1, contenidoNuevo: null })],
      notasExistentes
    )
    expect(op.estado).toBe('resuelto')
    expect(op.accion).toBe('borrar')
    if (op.estado === 'resuelto') {
      expect(op.notaId).toBe(NOTA_INGRESO.id)
      expect(op.contenidoNuevo).toBeUndefined()
    }
  })

  it('>1 candidato válido → ambiguo, con la lista real de NOTAS candidatas', () => {
    const [op] = resolverOperacionesNotaExistente([notaExistenteRaw({ tipo: 'borrar_nota', indicesCandidatos: [0, 1] })], notasExistentes)
    expect(op.estado).toBe('ambiguo')
    if (op.estado === 'ambiguo') expect(op.candidatos).toEqual([NOTA_MATE, NOTA_INGRESO])
  })

  it('índice alucinado (fuera de rango) → sin_coincidencias, nunca edita/borra la nota equivocada', () => {
    const [op] = resolverOperacionesNotaExistente([notaExistenteRaw({ tipo: 'editar_nota', indiceObjetivo: 99 })], notasExistentes)
    expect(op.estado).toBe('sin_coincidencias')
  })

  it('ignora por completo las operaciones que no son editar_nota/borrar_nota', () => {
    const ops = resolverOperacionesNotaExistente([crearRaw(), notaRaw({ indiceObjetivo: 0 })], notasExistentes)
    expect(ops).toHaveLength(0)
  })

  it('cada operación resuelta tiene un id propio', () => {
    const [op1, op2] = resolverOperacionesNotaExistente(
      [notaExistenteRaw({ tipo: 'editar_nota', indiceObjetivo: 0 }), notaExistenteRaw({ tipo: 'borrar_nota', indiceObjetivo: 1, contenidoNuevo: null })],
      notasExistentes
    )
    expect(op1.id).toBeTruthy()
    expect(op2.id).toBeTruthy()
    expect(op1.id).not.toBe(op2.id)
  })
})

// Bugs pendientes / Parte 2 — resolverBloques (crear_bloque).
function bloqueRaw(overrides: Partial<OperacionCrearBloqueRaw> = {}): OperacionRaw {
  return {
    tipo: 'crear_bloque',
    tipoBloque: 'clase',
    materia: 'Física',
    diaSemana: 4,
    horaInicio: '10:00',
    horaFin: '11:00',
    ...overrides,
  }
}

describe('resolverBloques — crear_bloque', () => {
  it('clase con materia/día/hora completos → resuelto', () => {
    const [op] = resolverBloques([bloqueRaw()])
    expect(op.estado).toBe('resuelto')
    if (op.estado === 'resuelto') {
      expect(op.tipo).toBe('clase')
      expect(op.materiaNombre).toBe('Física')
      expect(op.diaSemana).toBe(4)
      expect(op.horaInicio).toBe('10:00')
      expect(op.horaFin).toBe('11:00')
    }
  })

  it('bloque especial (ingreso/salida/descanso) → resuelto sin materia, aunque el modelo mande una', () => {
    const [op] = resolverBloques([bloqueRaw({ tipoBloque: 'descanso', materia: null })])
    expect(op.estado).toBe('resuelto')
    if (op.estado === 'resuelto') {
      expect(op.tipo).toBe('descanso')
      expect(op.materiaNombre).toBeNull()
    }
  })

  it('clase sin materia → inválido, nunca crea un bloque de clase sin materia', () => {
    const [op] = resolverBloques([bloqueRaw({ materia: null })])
    expect(op.estado).toBe('invalido')
  })

  it('sin hora de inicio o fin → inválido', () => {
    const [op1] = resolverBloques([bloqueRaw({ horaInicio: null })])
    expect(op1.estado).toBe('invalido')
    const [op2] = resolverBloques([bloqueRaw({ horaFin: null })])
    expect(op2.estado).toBe('invalido')
  })

  it('sin día de la semana → inválido', () => {
    const [op] = resolverBloques([bloqueRaw({ diaSemana: null })])
    expect(op.estado).toBe('invalido')
  })

  it('varias operaciones crear_bloque en el mismo turno (mismo bloque, distintos días) se resuelven todas', () => {
    const ops = resolverBloques([bloqueRaw({ diaSemana: 1 }), bloqueRaw({ diaSemana: 3 })])
    expect(ops).toHaveLength(2)
    expect(ops.every((o) => o.estado === 'resuelto')).toBe(true)
  })

  it('ignora por completo las operaciones que no son crear_bloque', () => {
    const ops = resolverBloques([crearRaw(), refRaw()])
    expect(ops).toHaveLength(0)
  })

  it('cada operación resuelta tiene un id propio', () => {
    const [op1, op2] = resolverBloques([bloqueRaw({ diaSemana: 1 }), bloqueRaw({ diaSemana: 3 })])
    expect(op1.id).toBeTruthy()
    expect(op1.id).not.toBe(op2.id)
  })
})

// Bugs pendientes / Parte 2 — resolverOperacionesBloqueExistente
// (modificar_bloque/borrar_bloque), mismo criterio defensivo que
// resolverOperacionesNotaExistente.
function bloqueExistenteRaw(overrides: Partial<OperacionBloqueExistenteRaw> = {}): OperacionRaw {
  return {
    tipo: 'modificar_bloque',
    descripcion: 'mi clase de Inglés',
    indiceObjetivo: null,
    indicesCandidatos: [],
    cambios: {},
    ...overrides,
  }
}

describe('resolverOperacionesBloqueExistente', () => {
  it('modificar_bloque resuelto con índice único → resuelto, con los cambios propuestos', () => {
    const [op] = resolverOperacionesBloqueExistente(
      [bloqueExistenteRaw({ indiceObjetivo: 0, cambios: { horaInicio: '09:00', horaFin: '10:00' } })],
      bloquesExistentes
    )
    expect(op.estado).toBe('resuelto')
    expect(op.accion).toBe('modificar')
    if (op.estado === 'resuelto') {
      expect(op.bloqueId).toBe(INGLES_LUNES.id)
      expect(op.cambios).toEqual({ horaInicio: '09:00', horaFin: '10:00' })
    }
  })

  it('borrar_bloque resuelto, sin cambios (undefined, nunca un objeto vacío que confunda "no cambia nada" con "cambia todo a undefined")', () => {
    const [op] = resolverOperacionesBloqueExistente([bloqueExistenteRaw({ tipo: 'borrar_bloque', indiceObjetivo: 1 })], bloquesExistentes)
    expect(op.estado).toBe('resuelto')
    expect(op.accion).toBe('borrar')
    if (op.estado === 'resuelto') {
      expect(op.bloqueId).toBe(INGRESO.id)
      expect(op.cambios).toBeUndefined()
    }
  })

  it('>1 candidato válido → ambiguo, con la lista real de BLOQUES candidatos', () => {
    const [op] = resolverOperacionesBloqueExistente([bloqueExistenteRaw({ indicesCandidatos: [0, 1] })], bloquesExistentes)
    expect(op.estado).toBe('ambiguo')
    if (op.estado === 'ambiguo') expect(op.candidatos).toEqual([INGLES_LUNES, INGRESO])
  })

  it('índice alucinado (fuera de rango) → sin_coincidencias, nunca modifica/borra el bloque equivocado', () => {
    const [op] = resolverOperacionesBloqueExistente([bloqueExistenteRaw({ indiceObjetivo: 99 })], bloquesExistentes)
    expect(op.estado).toBe('sin_coincidencias')
  })

  it('ignora por completo las operaciones que no son modificar_bloque/borrar_bloque', () => {
    const ops = resolverOperacionesBloqueExistente([crearRaw(), bloqueRaw()], bloquesExistentes)
    expect(ops).toHaveLength(0)
  })

  it('cada operación resuelta tiene un id propio', () => {
    const [op1, op2] = resolverOperacionesBloqueExistente(
      [bloqueExistenteRaw({ indiceObjetivo: 0 }), bloqueExistenteRaw({ tipo: 'borrar_bloque', indiceObjetivo: 1 })],
      bloquesExistentes
    )
    expect(op1.id).toBeTruthy()
    expect(op1.id).not.toBe(op2.id)
  })
})
