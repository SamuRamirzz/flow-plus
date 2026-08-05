// Contrato en lib/ai/types/memory.ts; implementación real desde el Sprint 9
// (docs/ai-architecture/05-contexto-y-memoria.md, Parte 8).
export type { MemoryScope, MemoryEntry, MemoryStore } from '@/lib/ai/types'
export { SupabaseMemoryStore } from './SupabaseMemoryStore'
export { filaAMemoryEntry, memoryEntryAFila, estaViva, esMemoryScope, aEpochMs, aISO } from './mapeo'
export type { FilaMemoria } from './mapeo'
