import { describe, expect, it } from 'vitest'
import {
  crearMateriaSchema,
  crearTareaSchema,
  actualizarTareaSchema,
  crearBloqueHorarioSchema,
  actualizarBloqueHorarioSchema,
  fusionarMateriasSchema,
  solicitarEliminacionCuentaSchema,
  crearNotaSchema,
  actualizarNotaSchema,
} from '../schemas'

describe('crearMateriaSchema', () => {
  it('acepta un nombre no vacío', () => {
    expect(crearMateriaSchema.safeParse({ nombre: 'Historia' }).success).toBe(true)
  })

  it('recorta espacios y rechaza nombre vacío tras recortar', () => {
    const r = crearMateriaSchema.safeParse({ nombre: '   ' })
    expect(r.success).toBe(false)
  })

  it('rechaza nombre ausente', () => {
    expect(crearMateriaSchema.safeParse({}).success).toBe(false)
  })
})

describe('crearTareaSchema', () => {
  const base = {
    titulo: 'Leer capítulo 3',
    materiaId: null as string | null,
    nuevaMateria: null as string | null,
    fecha: '',
    prioridad: 'media',
  }

  it('acepta materiaId de una materia existente (UUID v4)', () => {
    const r = crearTareaSchema.safeParse({ ...base, materiaId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
    expect(r.success).toBe(true)
  })

  it('acepta nuevaMateria sin materiaId', () => {
    const r = crearTareaSchema.safeParse({ ...base, nuevaMateria: 'Historia' })
    expect(r.success).toBe(true)
  })

  it('rechaza cuando no hay materiaId NI nuevaMateria', () => {
    const r = crearTareaSchema.safeParse(base)
    expect(r.success).toBe(false)
  })

  it('rechaza título vacío', () => {
    const r = crearTareaSchema.safeParse({ ...base, titulo: '  ', nuevaMateria: 'Historia' })
    expect(r.success).toBe(false)
  })

  it('acepta fecha vacía (sin fecha todavía)', () => {
    const r = crearTareaSchema.safeParse({ ...base, nuevaMateria: 'Historia', fecha: '' })
    expect(r.success).toBe(true)
  })

  it('acepta fecha YYYY-MM-DD', () => {
    const r = crearTareaSchema.safeParse({ ...base, nuevaMateria: 'Historia', fecha: '2026-08-14' })
    expect(r.success).toBe(true)
  })

  it('rechaza fecha con formato distinto a YYYY-MM-DD', () => {
    const r = crearTareaSchema.safeParse({ ...base, nuevaMateria: 'Historia', fecha: '14/08/2026' })
    expect(r.success).toBe(false)
  })

  it('rechaza prioridad fuera de baja|media|alta', () => {
    const r = crearTareaSchema.safeParse({ ...base, nuevaMateria: 'Historia', prioridad: 'urgente' })
    expect(r.success).toBe(false)
  })

  it('rechaza materiaId con formato inválido', () => {
    const r = crearTareaSchema.safeParse({ ...base, materiaId: 'no-es-un-uuid' })
    expect(r.success).toBe(false)
  })
})

describe('actualizarTareaSchema', () => {
  it('acepta solo completada', () => {
    expect(actualizarTareaSchema.safeParse({ completada: true }).success).toBe(true)
  })

  it('acepta solo titulo', () => {
    expect(actualizarTareaSchema.safeParse({ titulo: 'Nuevo título' }).success).toBe(true)
  })

  it('rechaza body vacío — nada que actualizar', () => {
    expect(actualizarTareaSchema.safeParse({}).success).toBe(false)
  })

  // Regresión — cada campo de examen tiene que alcanzar POR SÍ SOLO para que
  // el PATCH sea válido. Al añadirlos, el `.refine()` de "nada que
  // actualizar" seguía con la lista vieja de campos, así que mandar solo
  // {formato:'mixto'} devolvía 400 aunque el campo se validara bien. No lo
  // detectó ningún test porque todos mandaban un campo viejo junto al nuevo;
  // se encontró probando el PATCH real contra la API.
  it('acepta cada campo de examen POR SÍ SOLO (regresión del refine de "nada que actualizar")', () => {
    expect(actualizarTareaSchema.safeParse({ temario: 'Capítulos 4 al 7' }).success).toBe(true)
    expect(actualizarTareaSchema.safeParse({ formato: 'mixto' }).success).toBe(true)
    expect(actualizarTareaSchema.safeParse({ peso: 30 }).success).toBe(true)
  })

  it('acepta null explícito en los campos de examen para vaciarlos', () => {
    expect(actualizarTareaSchema.safeParse({ temario: null }).success).toBe(true)
    expect(actualizarTareaSchema.safeParse({ formato: null }).success).toBe(true)
    expect(actualizarTareaSchema.safeParse({ peso: null }).success).toBe(true)
  })

  it('rechaza formato fuera del enum y peso fuera de 0-100', () => {
    expect(actualizarTareaSchema.safeParse({ formato: 'telepático' }).success).toBe(false)
    expect(actualizarTareaSchema.safeParse({ peso: 150 }).success).toBe(false)
    expect(actualizarTareaSchema.safeParse({ peso: -1 }).success).toBe(false)
  })

  it('rechaza titulo vacío tras recortar', () => {
    expect(actualizarTareaSchema.safeParse({ titulo: '   ' }).success).toBe(false)
  })
})

describe('crearBloqueHorarioSchema (Sprint Zonas de horario)', () => {
  const UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  it('sin tipo, con materiaId → válido, tipo por defecto "clase"', () => {
    const r = crearBloqueHorarioSchema.safeParse({ materiaId: UUID, diaSemana: 1 })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.tipo).toBe('clase')
  })

  it('tipo "clase" sin materiaId → rechazado (una clase necesita materia)', () => {
    const r = crearBloqueHorarioSchema.safeParse({ tipo: 'clase', materiaId: null, diaSemana: 1 })
    expect(r.success).toBe(false)
  })

  it('tipo "ingreso" con materiaId: null → válido', () => {
    const r = crearBloqueHorarioSchema.safeParse({ tipo: 'ingreso', materiaId: null, diaSemana: 1, horaInicio: '07:00' })
    expect(r.success).toBe(true)
  })

  it('tipo "ingreso" con un materiaId real → rechazado (un bloque especial no lleva materia)', () => {
    const r = crearBloqueHorarioSchema.safeParse({ tipo: 'ingreso', materiaId: UUID, diaSemana: 1 })
    expect(r.success).toBe(false)
  })

  it('tipo fuera del enum → rechazado', () => {
    const r = crearBloqueHorarioSchema.safeParse({ tipo: 'almuerzo', materiaId: null, diaSemana: 1 })
    expect(r.success).toBe(false)
  })

  it('materiaId ausente (ni siquiera null) → rechazado — el campo es nullable, no optional', () => {
    const r = crearBloqueHorarioSchema.safeParse({ diaSemana: 1 })
    expect(r.success).toBe(false)
  })
})

describe('actualizarBloqueHorarioSchema (Sub-sprint 8.2)', () => {
  it('acepta materiaId solo (cambiar materia de un bloque existente)', () => {
    expect(actualizarBloqueHorarioSchema.safeParse({ materiaId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }).success).toBe(true)
  })

  it('acepta aula/profesor, incluido null explícito para vaciarlos', () => {
    expect(actualizarBloqueHorarioSchema.safeParse({ aula: 'A301', profesor: 'Ana Restrepo' }).success).toBe(true)
    expect(actualizarBloqueHorarioSchema.safeParse({ aula: null, profesor: null }).success).toBe(true)
  })

  it('rechaza body vacío — nada que actualizar', () => {
    expect(actualizarBloqueHorarioSchema.safeParse({}).success).toBe(false)
  })

  it('rechaza horaFin anterior a horaInicio cuando ambas vienen juntas', () => {
    const r = actualizarBloqueHorarioSchema.safeParse({ horaInicio: '09:00', horaFin: '07:00' })
    expect(r.success).toBe(false)
  })

  it('acepta cambiar solo horaFin sin horaInicio (no puede validar el orden sin la otra)', () => {
    expect(actualizarBloqueHorarioSchema.safeParse({ horaFin: '10:00' }).success).toBe(true)
  })

  // Sprint Zonas de horario
  it('cambiar tipo a "clase" sin mandar materiaId en el mismo body → rechazado', () => {
    const r = actualizarBloqueHorarioSchema.safeParse({ tipo: 'clase' })
    expect(r.success).toBe(false)
  })

  it('cambiar tipo a "clase" CON materiaId en el mismo body → válido', () => {
    const r = actualizarBloqueHorarioSchema.safeParse({ tipo: 'clase', materiaId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
    expect(r.success).toBe(true)
  })

  it('cambiar tipo a "ingreso" con materiaId: null en el mismo body → válido', () => {
    const r = actualizarBloqueHorarioSchema.safeParse({ tipo: 'ingreso', materiaId: null })
    expect(r.success).toBe(true)
  })

  it('cambiar solo materiaId sin tocar tipo (bloque ya es "clase") → válido, sin exigir tipo en el body', () => {
    const r = actualizarBloqueHorarioSchema.safeParse({ materiaId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
    expect(r.success).toBe(true)
  })

  it('materiaId: null solo (sin tipo) → válido en la forma — la app nunca lo manda sin tipo, pero el schema no lo prohíbe', () => {
    // El PATCH real (guardarEdicionBloque en app/horario/page.tsx) siempre
    // manda tipo+materiaId juntos cuando cambia de tipo — este caso prueba
    // el límite exacto de lo que el refine sí permite cuando tipo no viene.
    const r = actualizarBloqueHorarioSchema.safeParse({ materiaId: null })
    expect(r.success).toBe(true)
  })
})

describe('fusionarMateriasSchema', () => {
  // UUID v4 de verdad (nibble de versión = 4) — z.string().uuid() en esta
  // versión de zod valida específicamente v4, no "cualquier cosa con forma
  // de UUID" (ver el comentario junto a crearTareaSchema más arriba).
  const A = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  const B = 'a1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d'

  it('acepta dos ids distintos', () => {
    expect(fusionarMateriasSchema.safeParse({ origenId: A, destinoId: B }).success).toBe(true)
  })

  it('rechaza origenId igual a destinoId — no se puede fusionar consigo misma', () => {
    const r = fusionarMateriasSchema.safeParse({ origenId: A, destinoId: A })
    expect(r.success).toBe(false)
  })

  it('rechaza ids que no son UUID', () => {
    expect(fusionarMateriasSchema.safeParse({ origenId: 'no-es-uuid', destinoId: B }).success).toBe(false)
    expect(fusionarMateriasSchema.safeParse({ origenId: A, destinoId: 'no-es-uuid' }).success).toBe(false)
  })

  it('rechaza campos ausentes', () => {
    expect(fusionarMateriasSchema.safeParse({ origenId: A }).success).toBe(false)
    expect(fusionarMateriasSchema.safeParse({}).success).toBe(false)
  })
})

describe('solicitarEliminacionCuentaSchema', () => {
  it('acepta true y false por igual — ninguna de las dos opciones es el default', () => {
    expect(solicitarEliminacionCuentaSchema.safeParse({ eliminarDriveTambien: true }).success).toBe(true)
    expect(solicitarEliminacionCuentaSchema.safeParse({ eliminarDriveTambien: false }).success).toBe(true)
  })

  it('rechaza si el campo falta — la elección no puede ser implícita', () => {
    expect(solicitarEliminacionCuentaSchema.safeParse({}).success).toBe(false)
  })

  it('rechaza un valor que no es booleano', () => {
    expect(solicitarEliminacionCuentaSchema.safeParse({ eliminarDriveTambien: 'si' }).success).toBe(false)
  })
})

describe('crearNotaSchema — ancla de 3 vías (tarea / bloque / archivo)', () => {
  const ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  it('acepta sin ninguna ancla (nota suelta)', () => {
    expect(crearNotaSchema.safeParse({ contenido: 'x' }).success).toBe(true)
  })

  it('acepta exactamente una de las 3 anclas por separado', () => {
    expect(crearNotaSchema.safeParse({ contenido: 'x', tareaId: ID }).success).toBe(true)
    expect(crearNotaSchema.safeParse({ contenido: 'x', bloqueHorarioId: ID }).success).toBe(true)
    expect(crearNotaSchema.safeParse({ contenido: 'x', archivoId: ID }).success).toBe(true)
  })

  it('rechaza dos anclas a la vez, en cualquier combinación', () => {
    expect(crearNotaSchema.safeParse({ contenido: 'x', tareaId: ID, archivoId: ID }).success).toBe(false)
    expect(crearNotaSchema.safeParse({ contenido: 'x', bloqueHorarioId: ID, archivoId: ID }).success).toBe(false)
    expect(crearNotaSchema.safeParse({ contenido: 'x', tareaId: ID, bloqueHorarioId: ID }).success).toBe(false)
  })

  it('rechaza las 3 anclas a la vez', () => {
    expect(crearNotaSchema.safeParse({ contenido: 'x', tareaId: ID, bloqueHorarioId: ID, archivoId: ID }).success).toBe(false)
  })
})

describe('actualizarNotaSchema', () => {
  const ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  it('acepta cambiar solo archivoId', () => {
    expect(actualizarNotaSchema.safeParse({ archivoId: ID }).success).toBe(true)
  })

  it('acepta poner archivoId en null (desanclar)', () => {
    expect(actualizarNotaSchema.safeParse({ archivoId: null }).success).toBe(true)
  })

  it('rechaza body vacío — nada que actualizar', () => {
    expect(actualizarNotaSchema.safeParse({}).success).toBe(false)
  })

  it('rechaza fijar dos anclas a la vez', () => {
    expect(actualizarNotaSchema.safeParse({ tareaId: ID, archivoId: ID }).success).toBe(false)
  })
})
