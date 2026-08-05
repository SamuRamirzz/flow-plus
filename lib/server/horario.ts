import { supabaseServer } from './supabaseServer'
import type { BloqueHorario } from '@/lib/horario/tipos'
import { filaABloqueHorario, type FilaHorario } from '@/lib/horario/mapear'

// Versión servidor de lib/horario/cargar.ts — usada por POST /api/tareas
// para tener el horario disponible antes de llamar a inferirFechaEntrega.
// Mismo mapeo de filas (lib/horario/mapear.ts), cliente de Supabase
// distinto porque corre en el servidor.
export async function cargarHorarioServidor(userId: string): Promise<BloqueHorario[]> {
  const { data, error } = await supabaseServer
    .from('horario')
    .select('*')
    .eq('user_id', userId)
    .eq('activo', true)
    .order('dia_semana')

  if (error || !data) return []
  return (data as FilaHorario[]).map(filaABloqueHorario)
}
