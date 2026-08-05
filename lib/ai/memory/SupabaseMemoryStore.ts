import { supabaseServer } from '@/lib/server/supabaseServer'
import type { MemoryEntry, MemoryScope, MemoryStore } from '@/lib/ai/types'
import { filaAMemoryEntry, memoryEntryAFila, type FilaMemoria } from './mapeo'

// Primera implementación real de MemoryStore (hasta el Sprint 9 era solo la
// interfaz). Memoria PERSISTENTE entre sesiones y días — capa distinta de la
// memoria de sesión del Sub-sprint 7.2 (los turnos del overlay, que viven en
// estado de React y desaparecen al cerrarlo). Ninguna sustituye a la otra.
//
// Toda la traducción de forma (snake_case ⇄ camelCase, timestamptz ⇄ epoch)
// vive en mapeo.ts, que es puro y está probado sin red; acá solo queda el
// I/O contra Supabase.
export class SupabaseMemoryStore implements MemoryStore {
  async get(userId: string, scope: MemoryScope): Promise<MemoryEntry[]> {
    // El filtro de caducidad va en la CONSULTA, no en el cliente: una
    // entrada vencida no debe salir de la base aunque siga en la tabla
    // (el barrido de vencidas es del cron del Sprint 11). `expires_at` nulo
    // significa "no caduca", por eso el `or`.
    const { data, error } = await supabaseServer
      .from('memoria')
      .select('*')
      .eq('user_id', userId)
      .eq('scope', scope)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`No se pudo leer la memoria (${scope}): ${error.message}`)
    return (data as FilaMemoria[] | null)?.map(filaAMemoryEntry) ?? []
  }

  async write(entrada: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<MemoryEntry> {
    const { data, error } = await supabaseServer.from('memoria').insert(memoryEntryAFila(entrada)).select().single()
    if (error) throw new Error(`No se pudo guardar en memoria (${entrada.scope}): ${error.message}`)
    return filaAMemoryEntry(data as FilaMemoria)
  }

  async forget(userId: string, scope: MemoryScope, entryId: string): Promise<void> {
    // Se filtra por los tres campos, no solo por id: así un id de otro
    // usuario o de otro scope no puede borrar nada aunque se acierte el
    // uuid (hoy RLS es permisiva, así que esta es la única barrera real).
    const { error } = await supabaseServer.from('memoria').delete().eq('id', entryId).eq('user_id', userId).eq('scope', scope)
    if (error) throw new Error(`No se pudo olvidar la entrada de memoria: ${error.message}`)
  }
}
