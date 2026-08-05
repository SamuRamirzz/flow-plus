import { supabase } from '@/lib/supabase'
import type { BloqueHorario } from './tipos'
import { filaABloqueHorario, type FilaHorario } from './mapear'

// Lectura directa a Supabase desde el cliente — mismo criterio que
// cargarMaterias/cargarTareas (lib/tasks.ts): RLS ya protege, no hay nada
// que validar en un GET, así que no hace falta pasar por un Route Handler.
// Solo trae bloques activos: uno inactivo es una versión vieja de un
// horario que cambió (Class Schedule Agent, Sprint 8) y no debe entrar en
// la inferencia de fecha.
export async function cargarHorario(): Promise<BloqueHorario[]> {
  const { data, error } = await supabase.from('horario').select('*').eq('activo', true).order('dia_semana')
  if (error || !data) return []
  return (data as FilaHorario[]).map(filaABloqueHorario)
}
