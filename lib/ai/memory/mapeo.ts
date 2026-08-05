import type { MemoryEntry, MemoryScope } from '@/lib/ai/types'

// Forma de una fila de `public.memoria` tal como la devuelve Supabase.
// snake_case y timestamptz (ISO 8601), frente al camelCase y epoch en
// milisegundos de MemoryEntry.
export type FilaMemoria = {
  id: string
  user_id: string
  scope: string
  content: unknown
  created_at: string
  expires_at: string | null
}

const SCOPES: MemoryScope[] = ['immediate', 'daily', 'weekly', 'permanent', 'academic', 'contextual']

export function esMemoryScope(valor: unknown): valor is MemoryScope {
  return typeof valor === 'string' && (SCOPES as string[]).includes(valor)
}

// PURO. timestamptz ISO → epoch ms. Una fecha ilegible devuelve null en vez
// de NaN: NaN se propaga en silencio por cualquier comparación posterior
// (`NaN > Date.now()` es false, y una entrada caducada parecería viva).
export function aEpochMs(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/** PURO. epoch ms → ISO para timestamptz. `undefined` → null (no caduca). */
export function aISO(epochMs: number | undefined): string | null {
  if (epochMs === undefined || !Number.isFinite(epochMs)) return null
  return new Date(epochMs).toISOString()
}

// PURO. Fila de Supabase → MemoryEntry.
//
// `expires_at` null (la entrada no caduca) se mapea a la CLAVE AUSENTE, no a
// `expiresAt: undefined` explícito: `MemoryEntry.expiresAt` es opcional, y
// dejar la clave puesta con undefined hace que `'expiresAt' in entry` sea
// true y que un JSON.stringify del round-trip no coincida. Ver el test.
export function filaAMemoryEntry(fila: FilaMemoria): MemoryEntry {
  const base = {
    id: fila.id,
    userId: fila.user_id,
    // El check de la migración ya impide guardar un scope desconocido; si
    // aun así llegara uno (base tocada a mano), se cae a 'contextual' —el
    // scope más inocuo— en vez de romper toda la lectura de memoria.
    scope: esMemoryScope(fila.scope) ? fila.scope : ('contextual' as MemoryScope),
    content: fila.content,
    createdAt: aEpochMs(fila.created_at) ?? 0,
  }
  const expiresAt = aEpochMs(fila.expires_at)
  return expiresAt === null ? base : { ...base, expiresAt }
}

/** PURO. Lo que se inserta en Supabase para una entrada nueva. `id` y
 *  `createdAt` los pone la base (default), por eso no viajan. */
export function memoryEntryAFila(entrada: Omit<MemoryEntry, 'id' | 'createdAt'>): {
  user_id: string
  scope: MemoryScope
  content: unknown
  expires_at: string | null
} {
  return {
    user_id: entrada.userId,
    scope: entrada.scope,
    content: entrada.content,
    expires_at: aISO(entrada.expiresAt),
  }
}

/** PURO. ¿La entrada sigue viva en el instante `ahora`? Sin `expiresAt`,
 *  no caduca nunca. `ahora` se inyecta — nada de Date.now() aquí dentro. */
export function estaViva(entrada: MemoryEntry, ahora: number): boolean {
  return entrada.expiresAt === undefined || entrada.expiresAt > ahora
}
