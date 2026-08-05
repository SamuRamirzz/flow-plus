import { describe, expect, it } from 'vitest'
import { proximaClaseHoy, encabezadoVivo, proximasTareas } from '../pulso'
import type { BloqueHorario } from '@/lib/horario/tipos'
import type { Materia, Tarea } from '@/lib/types'

// 2026-07-27 es lunes de verdad (mismo fixture que lib/horario/__tests__).
const LUNES = '2026-07-27'
const MARTES = '2026-07-28'
const MATEMATICAS = 'materia-mate'
const HISTORIA = 'materia-historia'

const MATERIAS: Materia[] = [
  { id: MATEMATICAS, nombre: 'Matemáticas', color: '#FF6B4D', icono: 'Calculator' },
  { id: HISTORIA, nombre: 'Historia', color: '#60A5FA', icono: 'BookOpen' },
]

function bloque(overrides: Partial<BloqueHorario> = {}): BloqueHorario {
  return { id: 'b1', materiaId: MATEMATICAS, diaSemana: 1, horaInicio: '10:00', horaFin: '11:00', aula: null, profesor: null, ...overrides }
}

function tarea(overrides: Partial<Tarea> = {}): Tarea {
  return {
    id: 't1',
    titulo: 'Tarea',
    materia_id: MATEMATICAS,
    fecha_entrega: null,
    prioridad: 'media',
    completada: false,
    tipo: 'otro',
    temario: null,
    formato: null,
    peso: null,
    completada_en: null,
    ...overrides,
  }
}

describe('proximaClaseHoy', () => {
  it('encuentra la clase de hoy que todavía no empezó', () => {
    const r = proximaClaseHoy([bloque({ diaSemana: 1, horaInicio: '14:00' })], MATERIAS, LUNES, '10:00')
    expect(r?.materiaNombre).toBe('Matemáticas')
    expect(r?.minutosHasta).toBe(240)
  })

  it('ignora una clase que ya empezó', () => {
    const r = proximaClaseHoy([bloque({ diaSemana: 1, horaInicio: '09:00' })], MATERIAS, LUNES, '10:00')
    expect(r).toBeNull()
  })

  it('ignora bloques de otros días de la semana', () => {
    const r = proximaClaseHoy([bloque({ diaSemana: 2, horaInicio: '14:00' })], MATERIAS, LUNES, '10:00')
    expect(r).toBeNull()
  })

  it('con varias clases hoy, elige la más cercana', () => {
    const r = proximaClaseHoy(
      [bloque({ id: 'lejos', diaSemana: 1, horaInicio: '18:00' }), bloque({ id: 'cerca', diaSemana: 1, horaInicio: '12:00' })],
      MATERIAS,
      LUNES,
      '10:00'
    )
    expect(r?.bloque.id).toBe('cerca')
    expect(r?.minutosHasta).toBe(120)
  })

  it('sin bloques hoy, devuelve null', () => {
    expect(proximaClaseHoy([], MATERIAS, LUNES, '10:00')).toBeNull()
  })

  it('ignora bloques sin hora de inicio (horario incompleto)', () => {
    const r = proximaClaseHoy([bloque({ diaSemana: 1, horaInicio: null })], MATERIAS, LUNES, '10:00')
    expect(r).toBeNull()
  })

  it('materia no encontrada cae a un nombre genérico, no rompe', () => {
    const r = proximaClaseHoy([bloque({ diaSemana: 1, horaInicio: '14:00', materiaId: 'no-existe' })], MATERIAS, LUNES, '10:00')
    expect(r?.materiaNombre).toBe('Materia')
  })
})

describe('encabezadoVivo', () => {
  it('tareas de hoy ganan siempre — 1 tarea muestra su título', () => {
    const r = encabezadoVivo([tarea({ fecha_entrega: LUNES })], null, LUNES)
    expect(r.titulo).toBe('Tienes 1 tarea hoy')
    expect(r.subtitulo).toBe('Tarea')
  })

  it('varias tareas hoy: plural, sin subtítulo (no hay una sola que destacar)', () => {
    const r = encabezadoVivo([tarea({ id: 'a', fecha_entrega: LUNES }), tarea({ id: 'b', fecha_entrega: LUNES })], null, LUNES)
    expect(r.titulo).toBe('Tienes 2 tareas hoy')
    expect(r.subtitulo).toBeUndefined()
  })

  it('tareas completadas de hoy no cuentan — ya no son pendientes', () => {
    const r = encabezadoVivo([tarea({ fecha_entrega: LUNES, completada: true })], null, LUNES)
    expect(r.titulo).not.toContain('Tienes')
  })

  it('tareas de otro día no cuentan como "hoy"', () => {
    const r = encabezadoVivo([tarea({ fecha_entrega: MARTES })], null, LUNES)
    expect(r.titulo).not.toContain('Tienes')
  })

  it('sin tareas hoy, con clase inminente (<=60 min): la anuncia', () => {
    const proxima = { bloque: bloque(), materiaNombre: 'Matemáticas', minutosHasta: 40 }
    const r = encabezadoVivo([], proxima, LUNES)
    expect(r.titulo).toBe('Tu próxima clase, Matemáticas, es en 40 minutos')
  })

  it('clase a más de 60 minutos no cuenta como inminente', () => {
    const proxima = { bloque: bloque(), materiaNombre: 'Matemáticas', minutosHasta: 90 }
    const r = encabezadoVivo([], proxima, LUNES)
    expect(r.titulo).toBe('Nada pendiente hoy, buen momento para adelantar')
  })

  it('exactamente 60 minutos SÍ cuenta como inminente (borde inclusivo)', () => {
    const proxima = { bloque: bloque(), materiaNombre: 'Matemáticas', minutosHasta: 60 }
    const r = encabezadoVivo([], proxima, LUNES)
    expect(r.titulo).toContain('60 minutos')
  })

  it('un minuto usa singular, no "1 minutos"', () => {
    const proxima = { bloque: bloque(), materiaNombre: 'Matemáticas', minutosHasta: 1 }
    const r = encabezadoVivo([], proxima, LUNES)
    expect(r.titulo).toBe('Tu próxima clase, Matemáticas, es en 1 minuto')
  })

  it('sin tareas ni clase: mensaje neutro', () => {
    const r = encabezadoVivo([], null, LUNES)
    expect(r.titulo).toBe('Nada pendiente hoy, buen momento para adelantar')
  })

  it('tareas hoy gana sobre una clase inminente', () => {
    const proxima = { bloque: bloque(), materiaNombre: 'Matemáticas', minutosHasta: 10 }
    const r = encabezadoVivo([tarea({ fecha_entrega: LUNES })], proxima, LUNES)
    expect(r.titulo).toContain('Tienes')
  })
})

describe('proximasTareas', () => {
  it('ordena por fecha ascendente, más urgente primero', () => {
    const r = proximasTareas(
      [tarea({ id: 'lejos', fecha_entrega: '2026-08-01' }), tarea({ id: 'cerca', fecha_entrega: LUNES })],
      MATERIAS,
      LUNES
    )
    expect(r.map((x) => x.tarea.id)).toEqual(['cerca', 'lejos'])
  })

  it('excluye completadas', () => {
    const r = proximasTareas([tarea({ fecha_entrega: LUNES, completada: true })], MATERIAS, LUNES)
    expect(r).toHaveLength(0)
  })

  it('excluye tareas sin fecha — el pulso no puede ordenarlas por urgencia', () => {
    const r = proximasTareas([tarea({ fecha_entrega: null })], MATERIAS, LUNES)
    expect(r).toHaveLength(0)
  })

  it('respeta el límite', () => {
    const tareas = Array.from({ length: 8 }, (_, i) => tarea({ id: `t${i}`, fecha_entrega: LUNES }))
    expect(proximasTareas(tareas, MATERIAS, LUNES, 5)).toHaveLength(5)
    expect(proximasTareas(tareas, MATERIAS, LUNES)).toHaveLength(5) // default también 5
  })

  it('adjunta la materia real, o null si no se encuentra', () => {
    const r = proximasTareas([tarea({ fecha_entrega: LUNES, materia_id: 'no-existe' })], MATERIAS, LUNES)
    expect(r[0].materia).toBeNull()
  })
})
