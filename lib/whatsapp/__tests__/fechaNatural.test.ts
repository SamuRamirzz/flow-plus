import { describe, it, expect } from 'vitest'
import { resolverFechaNatural, diaSemanaDeTexto, normalizar } from '../fechaNatural'

// 2026-08-19 es un MIÉRCOLES — se fija como "hoy" en todos los tests para
// que las pruebas de nombres de día tengan un ancla verificable a mano.
const HOY = '2026-08-19'

describe('normalizar', () => {
  it('quita acentos, baja a minúsculas y colapsa espacios', () => {
    expect(normalizar('  MAÑANA  ')).toBe('manana')
    expect(normalizar('Miércoles')).toBe('miercoles')
    expect(normalizar('el   viernes')).toBe('el viernes')
  })
})

describe('resolverFechaNatural — relativas', () => {
  it('resuelve hoy', () => {
    expect(resolverFechaNatural('hoy', HOY)).toBe('2026-08-19')
    expect(resolverFechaNatural('HOY', HOY)).toBe('2026-08-19')
  })

  it('resuelve mañana con y sin acento', () => {
    expect(resolverFechaNatural('mañana', HOY)).toBe('2026-08-20')
    expect(resolverFechaNatural('manana', HOY)).toBe('2026-08-20')
    expect(resolverFechaNatural('  Mañana ', HOY)).toBe('2026-08-20')
  })

  it('resuelve pasado mañana', () => {
    expect(resolverFechaNatural('pasado mañana', HOY)).toBe('2026-08-21')
  })
})

describe('resolverFechaNatural — nombres de día', () => {
  it('resuelve el próximo viernes desde un miércoles', () => {
    expect(resolverFechaNatural('viernes', HOY)).toBe('2026-08-21')
    expect(resolverFechaNatural('el viernes', HOY)).toBe('2026-08-21')
    expect(resolverFechaNatural('próximo viernes', HOY)).toBe('2026-08-21')
  })

  it('el mismo día de la semana significa el de la semana que viene, no hoy', () => {
    // Hoy es miércoles: "el miércoles" debe ser dentro de 7 días.
    expect(resolverFechaNatural('miércoles', HOY)).toBe('2026-08-26')
  })

  it('resuelve un día ya pasado en la semana saltando a la siguiente', () => {
    // Lunes ya pasó (hoy miércoles) → el lunes que viene.
    expect(resolverFechaNatural('lunes', HOY)).toBe('2026-08-24')
  })

  it('cubre los 7 días', () => {
    const esperado: Record<string, string> = {
      lunes: '2026-08-24',
      martes: '2026-08-25',
      miercoles: '2026-08-26',
      jueves: '2026-08-20',
      viernes: '2026-08-21',
      sabado: '2026-08-22',
      domingo: '2026-08-23',
    }
    for (const [dia, fecha] of Object.entries(esperado)) {
      expect(resolverFechaNatural(dia, HOY), dia).toBe(fecha)
    }
  })
})

describe('resolverFechaNatural — formatos explícitos', () => {
  it('acepta ISO válida', () => {
    expect(resolverFechaNatural('2026-12-01', HOY)).toBe('2026-12-01')
  })

  it('rechaza una ISO con forma correcta pero fecha inexistente', () => {
    expect(resolverFechaNatural('2026-02-31', HOY)).toBeNull()
    expect(resolverFechaNatural('2026-13-01', HOY)).toBeNull()
  })

  it('acepta día/mes en orden español y asume el año en curso', () => {
    expect(resolverFechaNatural('25/8', HOY)).toBe('2026-08-25')
    expect(resolverFechaNatural('25-08', HOY)).toBe('2026-08-25')
  })

  it('si el día/mes sin año ya pasó, asume el año siguiente', () => {
    expect(resolverFechaNatural('3/1', HOY)).toBe('2027-01-03')
  })

  it('respeta el año explícito aunque ya haya pasado', () => {
    expect(resolverFechaNatural('03/01/2026', HOY)).toBe('2026-01-03')
  })

  it('interpreta día/mes, nunca mes/día', () => {
    // 5/3 es 5 de marzo, no 3 de mayo.
    expect(resolverFechaNatural('5/3', HOY)).toBe('2027-03-05')
  })

  it('rechaza día/mes imposible', () => {
    expect(resolverFechaNatural('31/2', HOY)).toBeNull()
  })
})

describe('resolverFechaNatural — no reconocido', () => {
  it('devuelve null en vez de adivinar', () => {
    expect(resolverFechaNatural('la semana que viene', HOY)).toBeNull()
    expect(resolverFechaNatural('cuando pueda', HOY)).toBeNull()
    expect(resolverFechaNatural('', HOY)).toBeNull()
    expect(resolverFechaNatural('   ', HOY)).toBeNull()
    expect(resolverFechaNatural('Biología', HOY)).toBeNull()
  })
})

describe('diaSemanaDeTexto', () => {
  it('mapea nombres a la convención ISO 1=lunes', () => {
    expect(diaSemanaDeTexto('lunes')).toBe(1)
    expect(diaSemanaDeTexto('Miércoles')).toBe(3)
    expect(diaSemanaDeTexto('el domingo')).toBe(7)
  })

  it('devuelve null para lo que no es un día', () => {
    expect(diaSemanaDeTexto('hoy')).toBeNull()
    expect(diaSemanaDeTexto('')).toBeNull()
  })
})
