import { describe, expect, it } from 'vitest'
import { inferirFechaEntrega } from '../inferirFecha'
import type { BloqueHorario } from '../tipos'

// 2026-07-27 es lunes de verdad (ver __tests__/dias.test.ts).
const LUNES = '2026-07-27'
const MATEMATICAS = 'materia-mate'
const HISTORIA = 'materia-historia'

function bloque(overrides: Partial<BloqueHorario> = {}): BloqueHorario {
  return { id: 'b1', materiaId: MATEMATICAS, diaSemana: 1, horaInicio: null, horaFin: null, aula: null, profesor: null, ...overrides }
}

const base = {
  fechaExplicita: null as string | null,
  origenExplicita: 'usuario' as const,
  materiaId: MATEMATICAS as string | null,
  horario: [] as BloqueHorario[],
  hoy: LUNES,
}

describe('inferirFechaEntrega — fecha explícita siempre gana', () => {
  it('fecha explícita del usuario se devuelve verbatim, aunque haya horario', () => {
    const r = inferirFechaEntrega({
      ...base,
      fechaExplicita: '2026-09-01',
      horario: [bloque({ diaSemana: 3 })],
    })
    expect(r).toEqual({ fecha: '2026-09-01', origen: 'explicita_usuario', motivo: null, bloqueUsadoId: null })
  })

  it('fecha explícita de la IA se devuelve verbatim y con el origen correcto', () => {
    const r = inferirFechaEntrega({ ...base, fechaExplicita: '2026-09-01', origenExplicita: 'ia' })
    expect(r.origen).toBe('explicita_ia')
    expect(r.fecha).toBe('2026-09-01')
  })

  it('una fecha explícita en el pasado también se respeta — no es trabajo de esta función juzgar plausibilidad', () => {
    const r = inferirFechaEntrega({ ...base, fechaExplicita: '2020-01-01' })
    expect(r.fecha).toBe('2020-01-01')
  })
})

describe('inferirFechaEntrega — sin materia, nunca se adivina', () => {
  it('materiaId null → sin_fecha, aunque haya horario cargado', () => {
    const r = inferirFechaEntrega({ ...base, materiaId: null, horario: [bloque()] })
    expect(r).toEqual({ fecha: null, origen: 'sin_fecha', motivo: null, bloqueUsadoId: null })
  })
})

describe('inferirFechaEntrega — materia sin bloques de horario', () => {
  it('la materia no tiene ningún bloque → sin_fecha', () => {
    const r = inferirFechaEntrega({ ...base, horario: [bloque({ materiaId: HISTORIA })] })
    expect(r.origen).toBe('sin_fecha')
    expect(r.fecha).toBeNull()
  })

  it('horario vacío del todo → sin_fecha', () => {
    const r = inferirFechaEntrega({ ...base, horario: [] })
    expect(r.origen).toBe('sin_fecha')
  })
})

describe('inferirFechaEntrega — un solo bloque', () => {
  it('infiere la próxima ocurrencia de ese día', () => {
    const r = inferirFechaEntrega({ ...base, horario: [bloque({ id: 'b1', diaSemana: 3 })] }) // miércoles
    expect(r.fecha).toBe('2026-07-29')
    expect(r.origen).toBe('inferida_horario')
    expect(r.bloqueUsadoId).toBe('b1')
  })

  it('motivo trae una frase en español, no vacía', () => {
    const r = inferirFechaEntrega({ ...base, horario: [bloque({ diaSemana: 3 })] })
    expect(r.motivo).toBe('Se dicta los miércoles')
  })
})

describe('inferirFechaEntrega — varios bloques, elige el más próximo', () => {
  it('con dos días (miércoles y viernes) desde un lunes, elige el miércoles', () => {
    const r = inferirFechaEntrega({
      ...base,
      horario: [bloque({ id: 'mie', diaSemana: 3 }), bloque({ id: 'vie', diaSemana: 5 })],
    })
    expect(r.bloqueUsadoId).toBe('mie')
    expect(r.fecha).toBe('2026-07-29')
  })

  it('con un bloque hoy mismo (lunes) y otro el miércoles, sin incluirHoy elige el miércoles (el lunes ya pasó esta semana)', () => {
    const r = inferirFechaEntrega({
      ...base,
      horario: [bloque({ id: 'lun', diaSemana: 1 }), bloque({ id: 'mie', diaSemana: 3 })],
    })
    expect(r.bloqueUsadoId).toBe('mie')
  })

  it('con incluirHoy=true, el bloque de hoy gana sobre cualquier otro día', () => {
    const r = inferirFechaEntrega({
      ...base,
      incluirHoy: true,
      horario: [bloque({ id: 'lun', diaSemana: 1 }), bloque({ id: 'mie', diaSemana: 3 })],
    })
    expect(r.bloqueUsadoId).toBe('lun')
    expect(r.fecha).toBe(LUNES)
  })

  it('empate de día (dos bloques el mismo día de otra materia no aplica, pero dos bloques dobles) desempata por horaInicio', () => {
    const r = inferirFechaEntrega({
      ...base,
      horario: [
        bloque({ id: 'tarde', diaSemana: 3, horaInicio: '14:00' }),
        bloque({ id: 'manana', diaSemana: 3, horaInicio: '08:00' }),
      ],
    })
    expect(r.bloqueUsadoId).toBe('manana')
  })

  it('empate total (mismo día, misma hora) desempata por id — resultado determinista', () => {
    const horario = [
      bloque({ id: 'zzz', diaSemana: 3, horaInicio: '08:00' }),
      bloque({ id: 'aaa', diaSemana: 3, horaInicio: '08:00' }),
    ]
    const r1 = inferirFechaEntrega({ ...base, horario })
    const r2 = inferirFechaEntrega({ ...base, horario: [...horario].reverse() })
    expect(r1.bloqueUsadoId).toBe('aaa')
    expect(r2.bloqueUsadoId).toBe('aaa')
  })

  it('ignora bloques de otras materias al elegir', () => {
    const r = inferirFechaEntrega({
      ...base,
      horario: [bloque({ id: 'otro', materiaId: HISTORIA, diaSemana: 2 }), bloque({ id: 'mio', diaSemana: 4 })],
    })
    expect(r.bloqueUsadoId).toBe('mio')
  })
})

describe('inferirFechaEntrega — nunca devuelve una fecha pasada', () => {
  it('para cualquier día de la semana como único bloque, la fecha inferida es hoy o futuro', () => {
    for (let dia = 1; dia <= 7; dia++) {
      const r = inferirFechaEntrega({ ...base, horario: [bloque({ diaSemana: dia as 1 | 2 | 3 | 4 | 5 | 6 | 7 })] })
      expect(r.fecha! >= LUNES).toBe(true)
    }
  })
})

describe('inferirFechaEntrega — motivo no nulo si y solo si origen es inferida_horario', () => {
  it.each([
    [{ ...base, fechaExplicita: '2026-08-01' }, 'explicita_usuario'],
    [{ ...base, materiaId: null }, 'sin_fecha'],
    [{ ...base, horario: [bloque({ diaSemana: 5 })] }, 'inferida_horario'],
  ])('origen %o', (input, origenEsperado) => {
    const r = inferirFechaEntrega(input)
    expect(r.origen).toBe(origenEsperado)
    expect(r.motivo !== null).toBe(origenEsperado === 'inferida_horario')
  })
})
