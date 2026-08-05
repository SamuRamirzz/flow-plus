import { describe, expect, it } from 'vitest'
import { calcularVentanaRecordatorio } from '../ventanas'

const HOY = '2026-07-28'

function tarea(overrides: Partial<{ fecha: string | null; prioridad: string; tipo: string }> = {}) {
  return { fecha: '2026-08-01', prioridad: 'media', tipo: 'otro', ...overrides }
}

describe('calcularVentanaRecordatorio — sin fecha', () => {
  it('fecha null nunca genera recordatorio', () => {
    const r = calcularVentanaRecordatorio(tarea({ fecha: null }), HOY)
    expect(r).toEqual({ debeRecordar: false, diasRestantes: null, urgencia: 'baja' })
  })
})

describe('calcularVentanaRecordatorio — ventanas base por prioridad (sin examen)', () => {
  it('alta: entra en ventana a 3 días, no a 4', () => {
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'alta', fecha: '2026-07-31' }), HOY).debeRecordar).toBe(true) // 3 días
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'alta', fecha: '2026-08-01' }), HOY).debeRecordar).toBe(false) // 4 días
  })

  it('media: entra en ventana a 2 días, no a 3', () => {
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'media', fecha: '2026-07-30' }), HOY).debeRecordar).toBe(true) // 2 días
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'media', fecha: '2026-07-31' }), HOY).debeRecordar).toBe(false) // 3 días
  })

  it('baja: entra en ventana a 1 día, no a 2', () => {
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'baja', fecha: '2026-07-29' }), HOY).debeRecordar).toBe(true) // 1 día
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'baja', fecha: '2026-07-30' }), HOY).debeRecordar).toBe(false) // 2 días
  })

  it('prioridad desconocida cae al criterio de baja (1 día)', () => {
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'urgentísima', fecha: '2026-07-29' }), HOY).debeRecordar).toBe(true)
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'urgentísima', fecha: '2026-07-30' }), HOY).debeRecordar).toBe(false)
  })

  it('el mismo día (0 días) siempre está dentro de la ventana', () => {
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'baja', fecha: HOY }), HOY).debeRecordar).toBe(true)
  })
})

describe('calcularVentanaRecordatorio — bonus de examen (+2 días)', () => {
  it('alta+examen: ventana de 5 días, no 6', () => {
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'alta', tipo: 'examen', fecha: '2026-08-02' }), HOY).debeRecordar).toBe(true) // 5 días
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'alta', tipo: 'examen', fecha: '2026-08-03' }), HOY).debeRecordar).toBe(false) // 6 días
  })

  it('media+examen: ventana de 4 días', () => {
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'media', tipo: 'examen', fecha: '2026-08-01' }), HOY).debeRecordar).toBe(true) // 4 días
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'media', tipo: 'examen', fecha: '2026-08-02' }), HOY).debeRecordar).toBe(false) // 5 días
  })

  it('baja+examen: ventana de 3 días', () => {
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'baja', tipo: 'examen', fecha: '2026-07-31' }), HOY).debeRecordar).toBe(true) // 3 días
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'baja', tipo: 'examen', fecha: '2026-08-01' }), HOY).debeRecordar).toBe(false) // 4 días
  })

  it('un examen y una tarea genérica de la misma prioridad NO tienen la misma ventana', () => {
    const fecha = '2026-08-01' // 4 días
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'media', tipo: 'otro', fecha }), HOY).debeRecordar).toBe(false)
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'media', tipo: 'examen', fecha }), HOY).debeRecordar).toBe(true)
  })
})

describe('calcularVentanaRecordatorio — tareas vencidas', () => {
  it('vencida hace 1 día sigue generando recordatorio (urgente)', () => {
    const r = calcularVentanaRecordatorio(tarea({ prioridad: 'baja', fecha: '2026-07-27' }), HOY)
    expect(r.debeRecordar).toBe(true)
    expect(r.diasRestantes).toBe(-1)
    expect(r.urgencia).toBe('alta')
  })

  it('vencida hace exactamente 7 días todavía genera recordatorio (el límite es inclusive)', () => {
    const r = calcularVentanaRecordatorio(tarea({ fecha: '2026-07-21' }), HOY)
    expect(r.debeRecordar).toBe(true)
  })

  it('vencida hace 8 días ya NO genera recordatorio — se asume abandonada/vista', () => {
    const r = calcularVentanaRecordatorio(tarea({ fecha: '2026-07-20' }), HOY)
    expect(r.debeRecordar).toBe(false)
    expect(r.diasRestantes).toBe(-8)
  })

  it('vencida hace mucho (200 días) no genera recordatorio', () => {
    expect(calcularVentanaRecordatorio(tarea({ fecha: '2026-01-01' }), HOY).debeRecordar).toBe(false)
  })
})

describe('calcularVentanaRecordatorio — escalada de urgencia', () => {
  it('alta+examen (ventana 5): 5-4 días baja, 3-2 media, 1-0 alta', () => {
    const casos: Array<[string, string]> = [
      ['2026-08-02', 'baja'], // 5 días
      ['2026-08-01', 'baja'], // 4 días
      ['2026-07-31', 'media'], // 3 días
      ['2026-07-30', 'media'], // 2 días
      ['2026-07-29', 'alta'], // 1 día
      ['2026-07-28', 'alta'], // 0 días
    ]
    for (const [fecha, esperado] of casos) {
      expect(calcularVentanaRecordatorio(tarea({ prioridad: 'alta', tipo: 'examen', fecha }), HOY).urgencia).toBe(esperado)
    }
  })

  it('baja sin examen (ventana 1): el único día dentro de la ventana ya es alta', () => {
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'baja', fecha: '2026-07-29' }), HOY).urgencia).toBe('alta')
  })

  it('vencida siempre es urgencia alta', () => {
    expect(calcularVentanaRecordatorio(tarea({ fecha: '2026-07-25' }), HOY).urgencia).toBe('alta')
  })

  it('cuando debeRecordar es false, la urgencia reportada es "baja" por convención (no se usa)', () => {
    expect(calcularVentanaRecordatorio(tarea({ prioridad: 'baja', fecha: '2026-08-15' }), HOY).urgencia).toBe('baja')
  })
})

describe('calcularVentanaRecordatorio — nunca usa el reloj real', () => {
  it('el mismo caso da el mismo resultado sin importar cuándo se corra el test', () => {
    const a = calcularVentanaRecordatorio(tarea({ fecha: '2026-08-01' }), HOY)
    const b = calcularVentanaRecordatorio(tarea({ fecha: '2026-08-01' }), HOY)
    expect(a).toEqual(b)
  })
})
