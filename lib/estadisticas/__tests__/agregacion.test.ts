import { describe, expect, it } from 'vitest'
import { tendenciaSemanal, desglosePorMateria, calcularPuntualidad, calcularRacha, evaluarSuficiencia } from '../agregacion'
import type { Materia, Tarea } from '@/lib/types'

// 2026-07-27 es lunes de verdad (mismo fixture que lib/horario/__tests__).
const LUNES = '2026-07-27'
const MATEMATICAS = 'materia-mate'
const HISTORIA = 'materia-historia'

const MATERIAS: Materia[] = [
  { id: MATEMATICAS, nombre: 'Matemáticas', color: '#FF6B4D', icono: 'Calculator' },
  { id: HISTORIA, nombre: 'Historia', color: '#60A5FA', icono: 'BookOpen' },
]

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

describe('tendenciaSemanal', () => {
  it('devuelve `semanas` filas, de más antigua a más reciente', () => {
    const r = tendenciaSemanal([], LUNES, 3)
    expect(r).toHaveLength(3)
    expect(r[2].inicioSemana).toBe(LUNES) // la semana actual es la última (más reciente)
    expect(r[0].inicioSemana < r[1].inicioSemana).toBe(true)
  })

  it('cada fila empieza en lunes', () => {
    // Un martes cualquiera dentro de la semana actual no debe cambiar cuál
    // es "la semana actual" — sigue siendo la del lunes LUNES.
    const martes = '2026-07-28'
    const r = tendenciaSemanal([], martes, 1)
    expect(r[0].inicioSemana).toBe(LUNES)
  })

  it('cuenta una tarea en la semana de su fecha_entrega, sin importar cuándo se creó', () => {
    const r = tendenciaSemanal([tarea({ fecha_entrega: LUNES })], LUNES, 1)
    expect(r[0].total).toBe(1)
  })

  it('completadas vs total, dentro de la misma semana', () => {
    const r = tendenciaSemanal(
      [tarea({ id: 'a', fecha_entrega: LUNES, completada: true }), tarea({ id: 'b', fecha_entrega: '2026-07-29', completada: false })],
      LUNES,
      1
    )
    expect(r[0]).toEqual({ inicioSemana: LUNES, completadas: 1, total: 2 })
  })

  it('ignora tareas sin fecha_entrega — no pertenecen a ninguna semana', () => {
    const r = tendenciaSemanal([tarea({ fecha_entrega: null })], LUNES, 1)
    expect(r[0].total).toBe(0)
  })

  it('una tarea de la semana pasada no cuenta en la semana actual', () => {
    const semanaPasada = '2026-07-20' // lunes anterior
    const r = tendenciaSemanal([tarea({ fecha_entrega: semanaPasada })], LUNES, 1)
    expect(r[0].total).toBe(0)
  })

  it('con 0 semanas pedidas, devuelve arreglo vacío', () => {
    expect(tendenciaSemanal([tarea({ fecha_entrega: LUNES })], LUNES, 0)).toEqual([])
  })
})

describe('desglosePorMateria', () => {
  it('cuenta pendientes y vencidas por materia', () => {
    const r = desglosePorMateria(
      [tarea({ materia_id: MATEMATICAS, fecha_entrega: '2026-07-20' }), tarea({ id: 't2', materia_id: MATEMATICAS, fecha_entrega: '2026-08-01' })],
      MATERIAS,
      LUNES
    )
    const mate = r.find((m) => m.materiaId === MATEMATICAS)
    expect(mate?.pendientes).toBe(2)
    expect(mate?.vencidas).toBe(1) // solo la del 2026-07-20, que es antes de LUNES
  })

  it('excluye completadas del conteo', () => {
    const r = desglosePorMateria([tarea({ materia_id: MATEMATICAS, fecha_entrega: '2026-07-20', completada: true })], MATERIAS, LUNES)
    expect(r).toHaveLength(0)
  })

  it('materias sin ninguna tarea pendiente no aparecen', () => {
    const r = desglosePorMateria([], MATERIAS, LUNES)
    expect(r).toHaveLength(0)
  })

  it('ordena por vencidas desc primero, pendientes desc como desempate', () => {
    const r = desglosePorMateria(
      [
        tarea({ id: 'a', materia_id: MATEMATICAS, fecha_entrega: '2026-07-20' }), // vencida
        tarea({ id: 'b', materia_id: HISTORIA, fecha_entrega: '2026-08-01' }),
        tarea({ id: 'c', materia_id: HISTORIA, fecha_entrega: '2026-08-02' }),
      ],
      MATERIAS,
      LUNES
    )
    // Matemáticas tiene 1 vencida (gana aunque tenga menos pendientes en total)
    expect(r[0].materiaId).toBe(MATEMATICAS)
  })

  it('una tarea sin fecha_entrega no cuenta como vencida', () => {
    const r = desglosePorMateria([tarea({ materia_id: MATEMATICAS, fecha_entrega: null })], MATERIAS, LUNES)
    expect(r[0].vencidas).toBe(0)
    expect(r[0].pendientes).toBe(1)
  })
})

describe('calcularPuntualidad', () => {
  it('completada el mismo día que vencía cuenta como a tiempo', () => {
    const r = calcularPuntualidad([tarea({ completada: true, fecha_entrega: LUNES, completada_en: `${LUNES}T23:50:00.000Z` })])
    expect(r).toEqual({ aTiempo: 1, tarde: 0, sinDato: 0 })
  })

  it('completada un día después de vencer cuenta como tarde', () => {
    const r = calcularPuntualidad([tarea({ completada: true, fecha_entrega: LUNES, completada_en: '2026-07-28T08:00:00.000Z' })])
    expect(r).toEqual({ aTiempo: 0, tarde: 1, sinDato: 0 })
  })

  it('completada antes de vencer cuenta como a tiempo', () => {
    const r = calcularPuntualidad([tarea({ completada: true, fecha_entrega: '2026-07-30', completada_en: `${LUNES}T08:00:00.000Z` })])
    expect(r.aTiempo).toBe(1)
  })

  it('completada sin completada_en (dato de antes de la migración) cuenta como sinDato', () => {
    const r = calcularPuntualidad([tarea({ completada: true, fecha_entrega: LUNES, completada_en: null })])
    expect(r).toEqual({ aTiempo: 0, tarde: 0, sinDato: 1 })
  })

  it('completada sin fecha_entrega cuenta como sinDato — no hay contra qué comparar', () => {
    const r = calcularPuntualidad([tarea({ completada: true, fecha_entrega: null, completada_en: '2026-07-27T08:00:00.000Z' })])
    expect(r.sinDato).toBe(1)
  })

  it('ignora tareas no completadas por completo', () => {
    const r = calcularPuntualidad([tarea({ completada: false, fecha_entrega: LUNES })])
    expect(r).toEqual({ aTiempo: 0, tarde: 0, sinDato: 0 })
  })
})

describe('calcularRacha', () => {
  it('sin ninguna tarea vencida nunca, la racha es el tope', () => {
    const r = calcularRacha([], LUNES)
    expect(r.diasSinVencidas).toBe(365)
  })

  it('una tarea vencida ayer corta la racha en 0', () => {
    const ayer = '2026-07-26'
    const r = calcularRacha([tarea({ fecha_entrega: ayer, completada: false })], LUNES)
    expect(r.diasSinVencidas).toBe(0)
  })

  it('una tarea vencida hace 5 días da una racha de 4 (los días entre esa y hoy, sin incluir ninguno de los dos)', () => {
    const hace5 = '2026-07-22'
    const r = calcularRacha([tarea({ fecha_entrega: hace5, completada: false })], LUNES)
    expect(r.diasSinVencidas).toBe(4)
  })

  it('una tarea vencida pero completada A TIEMPO no rompe la racha', () => {
    const ayer = '2026-07-26'
    const r = calcularRacha([tarea({ fecha_entrega: ayer, completada: true, completada_en: `${ayer}T10:00:00.000Z` })], LUNES)
    expect(r.diasSinVencidas).toBe(365)
  })

  it('una tarea completada TARDE rompe la racha en el día en que vencía', () => {
    const ayer = '2026-07-26'
    const r = calcularRacha([tarea({ fecha_entrega: ayer, completada: true, completada_en: `${LUNES}T10:00:00.000Z` })], LUNES)
    expect(r.diasSinVencidas).toBe(0)
  })

  it('tareas de hoy o futuras no cuentan — todavía pueden completarse a tiempo', () => {
    const r = calcularRacha([tarea({ fecha_entrega: LUNES, completada: false })], LUNES)
    expect(r.diasSinVencidas).toBe(365)
  })
})

describe('evaluarSuficiencia', () => {
  it('sin ninguna tarea completada: sin_datos', () => {
    expect(evaluarSuficiencia([])).toBe('sin_datos')
    expect(evaluarSuficiencia([tarea({ completada: false, fecha_entrega: LUNES })])).toBe('sin_datos')
  })

  it('completadas pero en un rango corto (< 14 días): insuficiente', () => {
    const r = evaluarSuficiencia([
      tarea({ id: 'a', completada: true, fecha_entrega: '2026-07-20' }),
      tarea({ id: 'b', completada: true, fecha_entrega: '2026-07-25' }),
    ])
    expect(r).toBe('insuficiente')
  })

  it('un solo día de historial (una sola tarea completada): insuficiente, no crashea', () => {
    expect(evaluarSuficiencia([tarea({ completada: true, fecha_entrega: LUNES })])).toBe('insuficiente')
  })

  it('rango de 14 días o más: completo', () => {
    const r = evaluarSuficiencia([
      tarea({ id: 'a', completada: true, fecha_entrega: '2026-07-13' }),
      tarea({ id: 'b', completada: true, fecha_entrega: LUNES }),
    ])
    expect(r).toBe('completo')
  })

  it('completadas sin fecha_entrega no cuentan para el rango', () => {
    expect(evaluarSuficiencia([tarea({ completada: true, fecha_entrega: null })])).toBe('sin_datos')
  })
})
