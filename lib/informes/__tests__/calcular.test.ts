import { describe, expect, it } from 'vitest'
import { calcularDatosInforme, datosParaIA } from '../calcular'
import type { EntradaCalculoInforme } from '../calcular'
import type { Materia, Tarea } from '@/lib/types'

const MATE: Materia = { id: 'm-mate', nombre: 'Matemáticas', color: '#FF6B4D', icono: 'calculator' }
const BIO: Materia = { id: 'm-bio', nombre: 'Biología', color: '#6E8F6A', icono: 'leaf' }
const MATERIAS = [MATE, BIO]

function t(id: string, fecha: string, completada: boolean, completadaEn: string | null = null, materiaId = MATE.id, tipo = 'otro'): Tarea {
  return {
    id,
    titulo: `Tarea ${id}`,
    materia_id: materiaId,
    fecha_entrega: fecha,
    prioridad: 'media',
    completada,
    tipo,
    temario: null,
    formato: null,
    peso: null,
    completada_en: completadaEn,
  }
}

function entrada(overrides: Partial<EntradaCalculoInforme> = {}): EntradaCalculoInforme {
  return {
    periodo: 'semanal',
    fechaReferencia: '2026-08-12', // miércoles → semana 10..16 de agosto
    nombreUsuario: 'Samuel',
    tareas: [],
    materias: MATERIAS,
    archivos: [],
    notas: [],
    ...overrides,
  }
}

describe('calcularDatosInforme — estructura y rangos', () => {
  it('resuelve el rango del periodo y el anterior equivalente', () => {
    const d = calcularDatosInforme(entrada())
    expect(d.rango).toEqual({ desde: '2026-08-10', hasta: '2026-08-16' })
    expect(d.rangoPrevio).toEqual({ desde: '2026-08-03', hasta: '2026-08-09' })
    expect(d.etiquetaPeriodo).toBe('10 – 16 de agosto de 2026')
  })

  it('es determinista: la misma entrada produce el mismo resultado', () => {
    const e = entrada({ tareas: [t('a', '2026-08-11', true, '2026-08-11')] })
    expect(calcularDatosInforme(e)).toEqual(calcularDatosInforme(e))
  })
})

describe('calcularDatosInforme — periodo con datos completos', () => {
  const tareas = [
    // Semana actual: 3 de 4 completadas, 2 a tiempo y 1 tarde
    t('a1', '2026-08-11', true, '2026-08-10'),
    t('a2', '2026-08-12', true, '2026-08-12'),
    t('a3', '2026-08-13', true, '2026-08-15'), // tarde
    t('a4', '2026-08-14', false),
    // Semana anterior: 1 de 4 completadas → el actual mejora
    t('p1', '2026-08-04', true, '2026-08-04'),
    t('p2', '2026-08-05', false),
    t('p3', '2026-08-06', false),
    t('p4', '2026-08-07', false),
  ]

  it('cuenta completadas y total del rango, no de todo el historial', () => {
    const d = calcularDatosInforme(entrada({ tareas }))
    expect(d.actual.completadas).toBe(3)
    expect(d.actual.total).toBe(4)
    expect(d.actual.porcentaje).toBe(75)
  })

  it('calcula la puntualidad solo sobre lo completado', () => {
    const d = calcularDatosInforme(entrada({ tareas }))
    expect(d.actual.puntualidad.aTiempo).toBe(2)
    expect(d.actual.puntualidad.tarde).toBe(1)
    expect(d.actual.porcentajePuntualidad).toBe(67)
  })

  it('compara contra el periodo anterior y detecta la mejora', () => {
    const d = calcularDatosInforme(entrada({ tareas }))
    expect(d.previo?.porcentaje).toBe(25)
    expect(d.comparacion.completadas.comparable).toBe(true)
    expect(d.comparacion.completadas.direccion).toBe('sube')
    expect(d.comparacion.completadas.delta).toBe(50)
  })

  it('la serie semanal siempre tiene 7 puntos, aunque haya días vacíos', () => {
    const d = calcularDatosInforme(entrada({ tareas }))
    expect(d.tendencia.granularidad).toBe('dia')
    expect(d.tendencia.puntos).toHaveLength(7)
    expect(d.tendencia.puntos.map((p) => p.etiqueta)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D'])
    // Lunes 10 no tenía nada; martes 11 tenía una completada
    expect(d.tendencia.puntos[0]).toMatchObject({ clave: '2026-08-10', total: 0 })
    expect(d.tendencia.puntos[1]).toMatchObject({ clave: '2026-08-11', total: 1, completadas: 1 })
  })
})

describe('calcularDatosInforme — casos borde', () => {
  it('sin tareas en el periodo: porcentaje null (no 0), y no crashea', () => {
    const d = calcularDatosInforme(entrada())
    expect(d.actual.total).toBe(0)
    expect(d.actual.porcentaje).toBeNull()
    expect(d.actual.porcentajePuntualidad).toBeNull()
    expect(d.materias).toEqual([])
  })

  it('sin periodo anterior: previo es null y la comparación NO es comparable', () => {
    const d = calcularDatosInforme(entrada({ tareas: [t('a', '2026-08-11', true, '2026-08-11')] }))
    expect(d.previo).toBeNull()
    expect(d.comparacion.completadas.comparable).toBe(false)
    // Nunca debe presentarse como "igual, 0 %" — eso inventaría una comparación
    expect(d.comparacion.completadas.direccion).toBe('igual')
  })

  it('usuario sin nada completado nunca: estadoDatos sin_datos', () => {
    const d = calcularDatosInforme(entrada({ tareas: [t('a', '2026-08-11', false)] }))
    expect(d.estadoDatos).toBe('sin_datos')
  })

  it('tareas de OTRAS semanas no contaminan el periodo', () => {
    const d = calcularDatosInforme(entrada({ tareas: [t('lejana', '2026-05-01', true, '2026-05-01')] }))
    expect(d.actual.total).toBe(0)
  })
})

describe('calcularDatosInforme — materias', () => {
  it('incluye una materia con TODO completado (Home la ocultaría)', () => {
    const d = calcularDatosInforme(
      entrada({ tareas: [t('a', '2026-08-11', true, '2026-08-11'), t('b', '2026-08-12', true, '2026-08-12')] })
    )
    expect(d.materias).toHaveLength(1)
    expect(d.materias[0]).toMatchObject({ nombre: 'Matemáticas', completadas: 2, pendientes: 0, total: 2 })
  })

  it('omite materias sin ninguna tarea en el periodo', () => {
    const d = calcularDatosInforme(entrada({ tareas: [t('a', '2026-08-11', true, '2026-08-11', MATE.id)] }))
    expect(d.materias.map((m) => m.nombre)).toEqual(['Matemáticas'])
  })

  it('marca sin_comparacion cuando la materia no tenía tareas en el periodo previo', () => {
    const d = calcularDatosInforme(entrada({ tareas: [t('a', '2026-08-11', true, '2026-08-11')] }))
    expect(d.materias[0].tendencia).toBe('sin_comparacion')
  })

  it('detecta mejora por materia contra el periodo anterior', () => {
    const tareas = [
      t('a1', '2026-08-11', true, '2026-08-11', BIO.id),
      t('a2', '2026-08-12', true, '2026-08-12', BIO.id),
      t('p1', '2026-08-04', false, null, BIO.id),
      t('p2', '2026-08-05', false, null, BIO.id),
    ]
    const d = calcularDatosInforme(entrada({ tareas }))
    expect(d.materias.find((m) => m.nombre === 'Biología')?.tendencia).toBe('sube')
  })
})

describe('calcularDatosInforme — densidad por periodo', () => {
  it('mensual agrupa por semana', () => {
    const d = calcularDatosInforme(entrada({ periodo: 'mensual' }))
    expect(d.tendencia.granularidad).toBe('semana')
    expect(d.tendencia.puntos.length).toBeGreaterThanOrEqual(4)
    expect(d.tendencia.puntos[0].etiqueta).toBe('Sem 1')
  })

  it('anual agrupa por mes: 12 puntos, Ene..Dic', () => {
    const d = calcularDatosInforme(entrada({ periodo: 'anual' }))
    expect(d.tendencia.granularidad).toBe('mes')
    expect(d.tendencia.puntos).toHaveLength(12)
    expect(d.tendencia.puntos[0].etiqueta).toBe('Ene')
    expect(d.tendencia.puntos[11].etiqueta).toBe('Dic')
  })

  it('superlativos SOLO en anual', () => {
    expect(calcularDatosInforme(entrada({ periodo: 'semanal' })).superlativos).toBeNull()
    expect(calcularDatosInforme(entrada({ periodo: 'anual' })).superlativos).not.toBeNull()
  })

  it('"lo que viene" está en semanal/mensual y vacío en anual', () => {
    const futuras = [t('f1', '2026-08-20', false), t('f2', '2026-08-25', false, null, MATE.id, 'examen')]
    expect(calcularDatosInforme(entrada({ tareas: futuras })).proximos).toHaveLength(2)
    expect(calcularDatosInforme(entrada({ periodo: 'anual', tareas: futuras })).proximos).toEqual([])
  })

  it('"lo que viene" pone los exámenes primero a igual fecha', () => {
    const mismoDia = [t('normal', '2026-08-20', false), t('examen', '2026-08-20', false, null, MATE.id, 'examen')]
    const d = calcularDatosInforme(entrada({ tareas: mismoDia }))
    expect(d.proximos[0].esExamen).toBe(true)
  })
})

describe('calcularDatosInforme — actividad de archivos y notas', () => {
  it('cuenta archivos y notas del rango, y resúmenes por analizado_en', () => {
    const d = calcularDatosInforme(
      entrada({
        archivos: [
          { created_at: '2026-08-11T10:00:00Z', analizado_en: '2026-08-11T10:05:00Z' },
          { created_at: '2026-07-01T10:00:00Z', analizado_en: '2026-08-12T09:00:00Z' }, // subido antes, analizado DENTRO
          { created_at: '2026-08-13T10:00:00Z', analizado_en: null },
        ],
        notas: [{ created_at: '2026-08-12T11:00:00Z' }, { created_at: '2026-07-30T11:00:00Z' }],
      })
    )
    expect(d.actividad.archivosSubidos).toBe(2)
    expect(d.actividad.notasCreadas).toBe(1)
    expect(d.actividad.resumenesIA).toBe(2)
  })
})

describe('datosParaIA', () => {
  it('expone SOLO agregados: ni ids, ni títulos, ni fechas ISO', () => {
    const d = calcularDatosInforme(entrada({ tareas: [t('a1', '2026-08-11', true, '2026-08-11')] }))
    const ia = datosParaIA(d)
    const serializado = JSON.stringify(ia)
    expect(serializado).not.toContain('a1')
    expect(serializado).not.toContain('Tarea a1')
    expect(serializado).not.toContain('2026-08-11')
    expect(ia.materias[0].nombre).toBe('Matemáticas')
  })

  it('los deltas viajan como null cuando no hay comparación posible', () => {
    const ia = datosParaIA(calcularDatosInforme(entrada({ tareas: [t('a', '2026-08-11', true, '2026-08-11')] })))
    expect(ia.deltaCompletadas).toBeNull()
    expect(ia.deltaPuntualidad).toBeNull()
  })
})
