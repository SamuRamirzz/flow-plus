// PURA a propósito, en su propio archivo — separada de useRealtimeSync.ts
// (que importa lib/supabase.ts, y ese módulo crea un cliente al cargarse,
// lo que rompe un test que solo quiere esta lógica sin red ni DOM). Mismo
// criterio de separación que ya usa lib/materias/asignarIcono.ts frente a
// components/ui/iconosMateria.tsx.
export type EventoRealtime<T> = { tipo: 'INSERT' | 'UPDATE' | 'DELETE'; fila: T }

// Upsert/remove por `id` — idempotente: el eco de una escritura que el
// propio dispositivo ya aplicó de forma optimista (o ya refrescó con
// `recargar()`) no duplica nada, sin importar en qué orden lleguen los dos.
export function reconciliar<T extends { id: string }>(lista: T[], evento: EventoRealtime<T>): T[] {
  if (evento.tipo === 'DELETE') return lista.filter((item) => item.id !== evento.fila.id)

  const existe = lista.some((item) => item.id === evento.fila.id)
  if (!existe) return [...lista, evento.fila]
  return lista.map((item) => (item.id === evento.fila.id ? evento.fila : item))
}
