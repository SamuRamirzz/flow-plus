export type MemoryScope = 'immediate' | 'daily' | 'weekly' | 'permanent' | 'academic' | 'contextual'

export type MemoryEntry = {
  id: string
  userId: string
  scope: MemoryScope
  content: unknown
  createdAt: number
  expiresAt?: number
}

export interface MemoryStore {
  get(userId: string, scope: MemoryScope): Promise<MemoryEntry[]>
  write(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<MemoryEntry>
  forget(userId: string, scope: MemoryScope, entryId: string): Promise<void>
}
