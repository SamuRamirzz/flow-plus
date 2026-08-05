import { describe, expect, it } from 'vitest'
import { normalizarCamposExamen, normalizarFormato, normalizarPeso, normalizarTemario, tieneAlgunCampo } from '../normalizar'

describe('normalizarFormato', () => {
  it('acepta los cuatro valores cerrados tal cual', () => {
    for (const f of ['oral', 'escrito', 'proyecto', 'mixto']) {
      expect(normalizarFormato(f)).toBe(f)
    }
  })

  it('es insensible a mayúsculas y espacios', () => {
    expect(normalizarFormato('  ORAL  ')).toBe('oral')
  })

  it('mapea sinónimos del español académico', () => {
    expect(normalizarFormato('exposición')).toBe('oral')
    expect(normalizarFormato('presentacion')).toBe('oral')
    expect(normalizarFormato('teórico')).toBe('escrito')
    expect(normalizarFormato('opción múltiple')).toBe('escrito')
    expect(normalizarFormato('laboratorio')).toBe('proyecto')
    expect(normalizarFormato('combinado')).toBe('mixto')
  })

  it('funciona con y sin acentos (mismo resultado)', () => {
    expect(normalizarFormato('teorico')).toBe(normalizarFormato('teórico'))
    expect(normalizarFormato('exposicion')).toBe(normalizarFormato('exposición'))
  })

  it('encuentra el formato dentro de una frase', () => {
    expect(normalizarFormato('examen escrito de química')).toBe('escrito')
    expect(normalizarFormato('es una exposición en grupo')).toBe('oral')
  })

  it('no confunde una palabra contenida en otra ("lab" dentro de "elaborar")', () => {
    expect(normalizarFormato('hay que elaborar un informe')).toBeNull()
  })

  it('lo que no reconoce cae en null — nunca adivina un formato', () => {
    expect(normalizarFormato('vaya usted a saber')).toBeNull()
    expect(normalizarFormato('')).toBeNull()
    expect(normalizarFormato('   ')).toBeNull()
  })

  it('entradas que no son string nunca lanzan', () => {
    expect(normalizarFormato(null)).toBeNull()
    expect(normalizarFormato(undefined)).toBeNull()
    expect(normalizarFormato(42)).toBeNull()
    expect(normalizarFormato({})).toBeNull()
  })
})

describe('normalizarPeso', () => {
  it('acepta un número entero de porcentaje', () => {
    expect(normalizarPeso(30)).toBe(30)
  })

  it('acepta el porcentaje como string, con y sin símbolo', () => {
    expect(normalizarPeso('30')).toBe(30)
    expect(normalizarPeso('30%')).toBe(30)
  })

  it('extrae el número de una frase', () => {
    expect(normalizarPeso('vale el 40% de la nota final')).toBe(40)
  })

  it('convierte fracción a porcentaje solo por debajo de 1 (es inequívoco)', () => {
    expect(normalizarPeso(0.3)).toBe(30)
    expect(normalizarPeso('0,3')).toBe(30) // coma decimal
  })

  it('1 se toma literal (un examen puede valer el 1%), no como 100%', () => {
    expect(normalizarPeso(1)).toBe(1)
  })

  it('acepta el extremo 100', () => {
    expect(normalizarPeso(100)).toBe(100)
  })

  it('rechaza fuera de rango y no-positivos', () => {
    expect(normalizarPeso(101)).toBeNull()
    expect(normalizarPeso(0)).toBeNull() // 0 es el centinela de "no lo dijo"
    expect(normalizarPeso(-5)).toBeNull()
  })

  it('redondea a dos decimales', () => {
    expect(normalizarPeso(33.3333)).toBe(33.33)
  })

  it('entradas basura nunca lanzan', () => {
    expect(normalizarPeso('sin número')).toBeNull()
    expect(normalizarPeso(null)).toBeNull()
    expect(normalizarPeso(NaN)).toBeNull()
    expect(normalizarPeso(Infinity)).toBeNull()
    expect(normalizarPeso({})).toBeNull()
  })
})

describe('normalizarTemario', () => {
  it('conserva el texto limpio', () => {
    expect(normalizarTemario('Capítulos 4 al 7')).toBe('Capítulos 4 al 7')
  })

  it('colapsa saltos de línea y espacios repetidos (el modelo devuelve listas)', () => {
    expect(normalizarTemario('Cap 1\n\nCap 2\n  Cap 3')).toBe('Cap 1 Cap 2 Cap 3')
  })

  it('vacío o solo espacios → null', () => {
    expect(normalizarTemario('')).toBeNull()
    expect(normalizarTemario('   \n  ')).toBeNull()
  })

  it('no-string → null, nunca lanza', () => {
    expect(normalizarTemario(null)).toBeNull()
    expect(normalizarTemario(123)).toBeNull()
  })
})

describe('normalizarCamposExamen', () => {
  it('normaliza los tres campos a la vez', () => {
    expect(normalizarCamposExamen({ temario: '  Cap 1 y 2 ', formato: 'exposición', peso: '25%' })).toEqual({
      temario: 'Cap 1 y 2',
      formato: 'oral',
      peso: 25,
    })
  })

  it('un objeto vacío da los tres en null (no lanza)', () => {
    expect(normalizarCamposExamen({})).toEqual({ temario: null, formato: null, peso: null })
  })

  it('normaliza lo que entiende y deja en null lo que no, sin descartar todo', () => {
    expect(normalizarCamposExamen({ temario: 'Todo el libro', formato: 'ininteligible', peso: 'nada' })).toEqual({
      temario: 'Todo el libro',
      formato: null,
      peso: null,
    })
  })
})

describe('tieneAlgunCampo', () => {
  it('false cuando los tres están vacíos', () => {
    expect(tieneAlgunCampo({ temario: null, formato: null, peso: null })).toBe(false)
  })

  it('true con cualquiera de los tres, incluso peso (que es numérico)', () => {
    expect(tieneAlgunCampo({ temario: 'algo', formato: null, peso: null })).toBe(true)
    expect(tieneAlgunCampo({ temario: null, formato: 'oral', peso: null })).toBe(true)
    expect(tieneAlgunCampo({ temario: null, formato: null, peso: 10 })).toBe(true)
  })
})
