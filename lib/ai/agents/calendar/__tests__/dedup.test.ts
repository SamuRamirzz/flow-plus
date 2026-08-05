import { describe, expect, it } from 'vitest'
import { resolverAvisoDedup } from '../dedup'
import type { ResultadoDedup } from '../types'

const MATERIA = { id: 'mat-1', nombre: 'Cálculo II' }

function resultado(overrides: Partial<ResultadoDedup> = {}): ResultadoDedup {
  return { hayDuplicado: true, materiaExistente: MATERIA, confianza: 0.8, ...overrides }
}

describe('resolverAvisoDedup — sin duplicado', () => {
  it('hayDuplicado=false siempre da null, sin importar confianza', () => {
    expect(resolverAvisoDedup(resultado({ hayDuplicado: false, materiaExistente: null, confianza: 0.9 }))).toBeNull()
  })

  it('materiaExistente=null da null aunque hayDuplicado sea true (defensivo)', () => {
    expect(resolverAvisoDedup(resultado({ materiaExistente: null }))).toBeNull()
  })
})

describe('resolverAvisoDedup — umbral de mostrar (0.35)', () => {
  it('confianza por debajo de 0.35 no muestra nada — es ruido, no un aviso discreto', () => {
    expect(resolverAvisoDedup(resultado({ confianza: 0.34 }))).toBeNull()
    expect(resolverAvisoDedup(resultado({ confianza: 0.1 }))).toBeNull()
    expect(resolverAvisoDedup(resultado({ confianza: 0 }))).toBeNull()
  })

  it('confianza exactamente en 0.35 sí se muestra (el umbral es inclusive)', () => {
    expect(resolverAvisoDedup(resultado({ confianza: 0.35 }))).not.toBeNull()
  })
})

describe('resolverAvisoDedup — umbral de autonomía (0.7), vía decidirAutonomia real', () => {
  it('confianza alta (>=0.7) → autonomia "autonomo", aviso prominente', () => {
    const r = resolverAvisoDedup(resultado({ confianza: 0.85 }))
    expect(r?.autonomia).toBe('autonomo')
  })

  it('confianza media (0.35-0.69) → autonomia "requiere_revision", aviso discreto', () => {
    const r = resolverAvisoDedup(resultado({ confianza: 0.5 }))
    expect(r?.autonomia).toBe('requiere_revision')
  })

  it('el borde exacto 0.7 cae del lado "autonomo" (umbral es el mínimo aceptable)', () => {
    expect(resolverAvisoDedup(resultado({ confianza: 0.7 }))?.autonomia).toBe('autonomo')
  })
})

describe('resolverAvisoDedup — forma del resultado', () => {
  it('propaga materiaId/nombre/confianza tal cual del modelo', () => {
    const r = resolverAvisoDedup(resultado({ confianza: 0.6 }))
    expect(r).toEqual({ materiaId: 'mat-1', nombre: 'Cálculo II', confianza: 0.6, autonomia: 'requiere_revision' })
  })
})
