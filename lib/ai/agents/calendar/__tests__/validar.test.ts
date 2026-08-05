import { describe, expect, it } from 'vitest'
import { esFechaPlausible, detectarColisiones, decidirAutonomia } from '../validar'
import type { TareaExistenteParaColision } from '../types'

const HOY = '2026-07-28'

describe('esFechaPlausible', () => {
  it('sin fecha, siempre plausible (no hay nada que juzgar)', () => {
    expect(esFechaPlausible(null, HOY, 'sin_fecha')).toEqual({ valida: true, motivo: null })
  })

  it('explicita_usuario en el pasado NUNCA se bloquea — el usuario la eligió a propósito', () => {
    const r = esFechaPlausible('2020-01-01', HOY, 'explicita_usuario')
    expect(r.valida).toBe(true)
    expect(r.motivo).toBeNull()
  })

  it('explicita_usuario en el futuro, obviamente plausible', () => {
    expect(esFechaPlausible('2027-01-01', HOY, 'explicita_usuario').valida).toBe(true)
  })

  it('inferida_horario nunca se cuestiona — inferirFechaEntrega ya garantiza que no es pasado', () => {
    expect(esFechaPlausible('2020-01-01', HOY, 'inferida_horario').valida).toBe(true)
  })

  it('explicita_ia en el pasado SÍ es implausible — el modelo pudo leer mal el año', () => {
    const r = esFechaPlausible('2020-01-01', HOY, 'explicita_ia')
    expect(r.valida).toBe(false)
    expect(r.motivo).toMatch(/ya pasó/i)
  })

  it('explicita_ia hoy mismo es plausible (no es "pasado")', () => {
    expect(esFechaPlausible(HOY, HOY, 'explicita_ia').valida).toBe(true)
  })

  it('explicita_ia en el futuro es plausible', () => {
    expect(esFechaPlausible('2026-08-01', HOY, 'explicita_ia').valida).toBe(true)
  })

  // Margen de 1 día — el borde exacto importa: sin él, cruzar la medianoche
  // entre que el cliente arma el payload y el servidor lo procesa marcaría
  // como implausible una fecha perfectamente válida.
  it('explicita_ia AYER sigue siendo plausible — cae dentro del margen de 1 día', () => {
    expect(esFechaPlausible('2026-07-27', HOY, 'explicita_ia').valida).toBe(true)
  })

  it('explicita_ia anteayer YA es implausible — fuera del margen', () => {
    const r = esFechaPlausible('2026-07-26', HOY, 'explicita_ia')
    expect(r.valida).toBe(false)
    expect(r.motivo).toMatch(/ya pasó/i)
  })

  it('el margen cruza bien el fin de mes (1 de agosto contra 31 de julio)', () => {
    expect(esFechaPlausible('2026-07-31', '2026-08-01', 'explicita_ia').valida).toBe(true)
    expect(esFechaPlausible('2026-07-30', '2026-08-01', 'explicita_ia').valida).toBe(false)
  })

  describe('futuro absurdo — se cuestiona sin importar el origen', () => {
    it('a más de dos años, explicita_ia es implausible', () => {
      const r = esFechaPlausible('2029-01-01', HOY, 'explicita_ia')
      expect(r.valida).toBe(false)
      expect(r.motivo).toMatch(/dos años/i)
    })

    it('a más de dos años, explicita_usuario TAMBIÉN es implausible (un año tecleado de más)', () => {
      const r = esFechaPlausible('2062-07-28', HOY, 'explicita_usuario')
      expect(r.valida).toBe(false)
      expect(r.motivo).toMatch(/dos años/i)
    })

    it('justo dentro de los dos años sigue siendo plausible', () => {
      // 2026-07-28 + 730 días = 2028-07-27 → el último día aceptado.
      expect(esFechaPlausible('2028-07-27', HOY, 'explicita_usuario').valida).toBe(true)
    })

    it('un día más allá del límite ya no lo es', () => {
      expect(esFechaPlausible('2028-07-28', HOY, 'explicita_usuario').valida).toBe(false)
    })

    it('sin fecha nunca dispara la regla de futuro', () => {
      expect(esFechaPlausible(null, HOY, 'explicita_usuario').valida).toBe(true)
    })
  })
})

function existente(overrides: Partial<TareaExistenteParaColision> = {}): TareaExistenteParaColision {
  return { id: 'e1', titulo: 'Existente', fecha: '2026-08-01', prioridad: 'media', tipo: 'otro', ...overrides }
}

describe('detectarColisiones', () => {
  it('sin fecha en la tarea nueva, no hay nada que comparar', () => {
    expect(detectarColisiones({ fecha: null, prioridad: 'alta', tipo: 'examen' }, [existente()])).toEqual([])
  })

  it('mismo día pero ninguna señal fuerte (ambas media/otro) NO es colisión — evita ruido constante', () => {
    const r = detectarColisiones(
      { fecha: '2026-08-01', prioridad: 'media', tipo: 'otro' },
      [existente({ prioridad: 'media', tipo: 'otro' })]
    )
    expect(r).toEqual([])
  })

  it('mismo día, ambas prioridad alta → colisión', () => {
    const r = detectarColisiones(
      { fecha: '2026-08-01', prioridad: 'alta', tipo: 'ejercicios' },
      [existente({ id: 'e1', titulo: 'Ensayo de literatura', prioridad: 'alta', tipo: 'ensayo' })]
    )
    expect(r).toEqual([{ tareaId: 'e1', titulo: 'Ensayo de literatura', motivo: expect.stringMatching(/alta/i) }])
  })

  it('una alta y otra no, NO colisiona por prioridad', () => {
    const r = detectarColisiones({ fecha: '2026-08-01', prioridad: 'alta', tipo: 'otro' }, [existente({ prioridad: 'baja' })])
    expect(r).toEqual([])
  })

  it('mismo día, ambas tipo examen (sin ser alta ninguna) → colisión', () => {
    const r = detectarColisiones(
      { fecha: '2026-08-01', prioridad: 'baja', tipo: 'examen' },
      [existente({ id: 'e2', titulo: 'Examen de física', prioridad: 'media', tipo: 'examen' })]
    )
    expect(r).toEqual([{ tareaId: 'e2', titulo: 'Examen de física', motivo: expect.stringMatching(/examen/i) }])
  })

  it('un examen y algo que no lo es, NO colisiona por tipo', () => {
    const r = detectarColisiones({ fecha: '2026-08-01', prioridad: 'baja', tipo: 'examen' }, [existente({ tipo: 'lectura' })])
    expect(r).toEqual([])
  })

  it('distinto día, nunca colisiona aunque todo lo demás coincida', () => {
    const r = detectarColisiones(
      { fecha: '2026-08-02', prioridad: 'alta', tipo: 'examen' },
      [existente({ fecha: '2026-08-01', prioridad: 'alta', tipo: 'examen' })]
    )
    expect(r).toEqual([])
  })

  it('detecta colisión contra varias tareas existentes a la vez', () => {
    const r = detectarColisiones(
      { fecha: '2026-08-01', prioridad: 'alta', tipo: 'examen' },
      [existente({ id: 'a', titulo: 'A', prioridad: 'alta' }), existente({ id: 'b', titulo: 'B', prioridad: 'baja', tipo: 'lectura' }), existente({ id: 'c', titulo: 'C', tipo: 'examen' })]
    )
    expect(r.map((c) => c.tareaId).sort()).toEqual(['a', 'c'])
  })

  it('una tarea que choca por AMBAS señales se reporta una sola vez, no duplicada', () => {
    const r = detectarColisiones(
      { fecha: '2026-08-01', prioridad: 'alta', tipo: 'examen' },
      [existente({ id: 'e1', prioridad: 'alta', tipo: 'examen' })]
    )
    expect(r).toHaveLength(1)
  })

  it('lista vacía de existentes nunca colisiona', () => {
    expect(detectarColisiones({ fecha: '2026-08-01', prioridad: 'alta', tipo: 'examen' }, [])).toEqual([])
  })

  // Auto-exclusión: al MODIFICAR, la propia tarea sigue guardada con su
  // fecha vieja y aparecería como candidata a chocar consigo misma.
  it('al modificar, la tarea no choca consigo misma aunque esté en la lista', () => {
    const r = detectarColisiones(
      { id: 'yo', fecha: '2026-08-01', prioridad: 'alta', tipo: 'examen' },
      [existente({ id: 'yo', titulo: 'Yo mismo', prioridad: 'alta', tipo: 'examen' })]
    )
    expect(r).toEqual([])
  })

  it('al modificar, sí reporta el choque con OTRAS tareas del mismo día', () => {
    const r = detectarColisiones(
      { id: 'yo', fecha: '2026-08-01', prioridad: 'alta', tipo: 'examen' },
      [existente({ id: 'yo', prioridad: 'alta' }), existente({ id: 'otra', titulo: 'Otra', prioridad: 'alta' })]
    )
    expect(r).toEqual([{ tareaId: 'otra', titulo: 'Otra', motivo: expect.stringMatching(/alta/i) }])
  })

  it('sin id (creación), nada se auto-excluye', () => {
    const r = detectarColisiones(
      { fecha: '2026-08-01', prioridad: 'alta', tipo: 'examen' },
      [existente({ id: 'cualquiera', titulo: 'Cualquiera', prioridad: 'alta' })]
    )
    expect(r).toHaveLength(1)
  })
})

describe('decidirAutonomia', () => {
  it('confianza null → autonomo (hoy ningún llamador tiene una confianza real de modelo)', () => {
    expect(decidirAutonomia(null, 0.7)).toBe('autonomo')
  })

  it('confianza por debajo del umbral → requiere_revision', () => {
    expect(decidirAutonomia(0.4, 0.7)).toBe('requiere_revision')
  })

  it('confianza igual al umbral → autonomo (el umbral es el mínimo aceptable, no el máximo dudoso)', () => {
    expect(decidirAutonomia(0.7, 0.7)).toBe('autonomo')
  })

  it('confianza por encima del umbral → autonomo', () => {
    expect(decidirAutonomia(0.95, 0.7)).toBe('autonomo')
  })
})
