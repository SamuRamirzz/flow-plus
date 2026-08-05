import { describe, expect, it } from 'vitest'
import { aEpochMs, aISO, esMemoryScope, estaViva, filaAMemoryEntry, memoryEntryAFila, type FilaMemoria } from '../mapeo'
import type { MemoryEntry } from '@/lib/ai/types'

const CREADA_ISO = '2026-07-28T10:00:00.000Z'
const CREADA_MS = Date.parse(CREADA_ISO)
const VENCE_ISO = '2026-07-29T10:00:00.000Z'
const VENCE_MS = Date.parse(VENCE_ISO)

function fila(overrides: Partial<FilaMemoria> = {}): FilaMemoria {
  return {
    id: 'mem-1',
    user_id: 'user-1',
    scope: 'permanent',
    content: { nota: 'prefiere estudiar de noche' },
    created_at: CREADA_ISO,
    expires_at: null,
    ...overrides,
  }
}

describe('aEpochMs / aISO', () => {
  it('convierte ISO a epoch ms', () => {
    expect(aEpochMs(CREADA_ISO)).toBe(CREADA_MS)
  })

  it('null devuelve null', () => {
    expect(aEpochMs(null)).toBeNull()
  })

  it('una fecha ilegible devuelve null, NUNCA NaN', () => {
    const r = aEpochMs('no es una fecha')
    expect(r).toBeNull()
    expect(Number.isNaN(r as unknown as number)).toBe(false)
  })

  it('epoch ms → ISO', () => {
    expect(aISO(CREADA_MS)).toBe(CREADA_ISO)
  })

  it('undefined → null (la entrada no caduca)', () => {
    expect(aISO(undefined)).toBeNull()
  })
})

describe('esMemoryScope', () => {
  it('acepta los seis scopes reales', () => {
    for (const s of ['immediate', 'daily', 'weekly', 'permanent', 'academic', 'contextual']) {
      expect(esMemoryScope(s)).toBe(true)
    }
  })

  it('rechaza cualquier otro valor', () => {
    expect(esMemoryScope('inventado')).toBe(false)
    expect(esMemoryScope(null)).toBe(false)
    expect(esMemoryScope(3)).toBe(false)
  })
})

describe('filaAMemoryEntry', () => {
  it('traduce snake_case + ISO a camelCase + epoch', () => {
    expect(filaAMemoryEntry(fila())).toEqual({
      id: 'mem-1',
      userId: 'user-1',
      scope: 'permanent',
      content: { nota: 'prefiere estudiar de noche' },
      createdAt: CREADA_MS,
    })
  })

  it('expires_at null NO deja la clave expiresAt presente con undefined', () => {
    const entrada = filaAMemoryEntry(fila({ expires_at: null }))
    expect('expiresAt' in entrada).toBe(false)
    expect(entrada.expiresAt).toBeUndefined()
  })

  it('expires_at con valor sí puebla expiresAt', () => {
    const entrada = filaAMemoryEntry(fila({ expires_at: VENCE_ISO }))
    expect(entrada.expiresAt).toBe(VENCE_MS)
  })

  it('un scope desconocido en la base cae a "contextual" en vez de romper la lectura', () => {
    expect(filaAMemoryEntry(fila({ scope: 'algo_raro' })).scope).toBe('contextual')
  })

  it('una fecha de creación ilegible cae a 0, no a NaN', () => {
    expect(filaAMemoryEntry(fila({ created_at: 'roto' })).createdAt).toBe(0)
  })
})

describe('memoryEntryAFila', () => {
  it('traduce camelCase a snake_case, sin id ni createdAt (los pone la base)', () => {
    const f = memoryEntryAFila({ userId: 'user-1', scope: 'daily', content: { x: 1 } })
    expect(f).toEqual({ user_id: 'user-1', scope: 'daily', content: { x: 1 }, expires_at: null })
    expect('id' in f).toBe(false)
    expect('created_at' in f).toBe(false)
  })

  it('expiresAt definido viaja como ISO', () => {
    const f = memoryEntryAFila({ userId: 'u', scope: 'daily', content: {}, expiresAt: VENCE_MS })
    expect(f.expires_at).toBe(VENCE_ISO)
  })
})

describe('round-trip fila → entrada → fila', () => {
  it('sin caducidad, la ida y vuelta conserva todo lo que viaja', () => {
    const original = fila({ expires_at: null })
    const entrada = filaAMemoryEntry(original)
    const devuelta = memoryEntryAFila(entrada)
    expect(devuelta).toEqual({
      user_id: original.user_id,
      scope: original.scope,
      content: original.content,
      expires_at: null,
    })
  })

  it('con caducidad, la ida y vuelta conserva el instante exacto', () => {
    const original = fila({ expires_at: VENCE_ISO })
    const devuelta = memoryEntryAFila(filaAMemoryEntry(original))
    expect(devuelta.expires_at).toBe(VENCE_ISO)
  })
})

describe('estaViva', () => {
  const base: MemoryEntry = { id: 'm', userId: 'u', scope: 'daily', content: {}, createdAt: CREADA_MS }

  it('sin expiresAt nunca caduca', () => {
    expect(estaViva(base, Number.MAX_SAFE_INTEGER)).toBe(true)
  })

  it('con expiresAt en el futuro está viva', () => {
    expect(estaViva({ ...base, expiresAt: VENCE_MS }, VENCE_MS - 1)).toBe(true)
  })

  it('justo en el instante de caducidad ya no está viva', () => {
    expect(estaViva({ ...base, expiresAt: VENCE_MS }, VENCE_MS)).toBe(false)
  })

  it('pasada la caducidad no está viva', () => {
    expect(estaViva({ ...base, expiresAt: VENCE_MS }, VENCE_MS + 1)).toBe(false)
  })
})
