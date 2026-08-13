import { supabaseServer } from './supabaseServer'
import type { BloqueHorario, TipoBloqueHorario, DiaSemana } from '@/lib/horario/tipos'
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

// Bugs pendientes / Parte 2 — extrae la escritura de `horario` que hasta
// ahora vivía solo dentro de los Route Handlers (`app/api/horario/route.ts`,
// `app/api/horario/[id]/route.ts`) a funciones puntuales reusables, mismo
// patrón que `crearNota()` en lib/server/notas.ts: un único punto de
// escritura consumido tanto por el endpoint HTTP como por
// `app/api/ai/tareas/route.ts` cuando `TaskManagementAgent` resuelve una
// intención de crear/modificar/borrar un bloque — nunca un fetch HTTP
// interno. Los Route Handlers existentes se migran a llamar estas mismas
// funciones (antes tenían el insert/update/delete inline).

export type FilaHorarioServer = {
  id: string
  user_id: string
  tipo: TipoBloqueHorario
  materia_id: string | null
  dia_semana: DiaSemana
  hora_inicio: string | null
  hora_fin: string | null
  aula: string | null
  profesor: string | null
  activo: boolean
}

export async function crearBloque(
  userId: string,
  input: {
    tipo: TipoBloqueHorario
    materiaId: string | null
    // number, no DiaSemana: los llamadores (zod, o el índice 1-7 ya validado
    // por el resolver de la IA) validan el rango 1-7 antes de llegar acá —
    // duplicar ese chequeo con un tipo literal solo forzaría un `as DiaSemana`
    // en cada call site sin ganar seguridad real.
    diaSemana: number
    horaInicio: string | null
    horaFin: string | null
  }
): Promise<{ ok: true; bloque: FilaHorarioServer } | { ok: false; error: string }> {
  const { data, error } = await supabaseServer
    .from('horario')
    .insert({
      user_id: userId,
      tipo: input.tipo,
      materia_id: input.materiaId,
      dia_semana: input.diaSemana,
      hora_inicio: input.horaInicio,
      hora_fin: input.horaFin,
    })
    .select()
    .single<FilaHorarioServer>()

  if (error) return { ok: false, error: error.message }
  return { ok: true, bloque: data }
}

export type CambiosBloqueServer = {
  tipo?: TipoBloqueHorario
  activo?: boolean
  materiaId?: string | null
  horaInicio?: string | null
  horaFin?: string | null
  aula?: string | null
  profesor?: string | null
}

export async function actualizarBloque(
  userId: string,
  bloqueId: string,
  cambios: CambiosBloqueServer
): Promise<{ ok: true; bloque: FilaHorarioServer } | { ok: false; error: string; noEncontrado?: boolean }> {
  const patch: Record<string, unknown> = {}
  if (cambios.tipo !== undefined) patch.tipo = cambios.tipo
  if (cambios.activo !== undefined) patch.activo = cambios.activo
  if (cambios.materiaId !== undefined) patch.materia_id = cambios.materiaId
  if (cambios.horaInicio !== undefined) patch.hora_inicio = cambios.horaInicio
  if (cambios.horaFin !== undefined) patch.hora_fin = cambios.horaFin
  if (cambios.aula !== undefined) patch.aula = cambios.aula
  if (cambios.profesor !== undefined) patch.profesor = cambios.profesor

  const { data, error } = await supabaseServer
    .from('horario')
    .update(patch)
    .eq('id', bloqueId)
    .eq('user_id', userId)
    .select()
    .single<FilaHorarioServer>()

  if (error) return { ok: false, error: error.message, noEncontrado: error.code === 'PGRST116' }
  return { ok: true, bloque: data }
}

export async function borrarBloque(userId: string, bloqueId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseServer.from('horario').delete().eq('id', bloqueId).eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// PURA — sin I/O. Detección de colisión SIMPLE (mismo día, rango horario se
// solapa), distinta a propósito de `detectarConflictosFusion` en
// lib/horario/conflictos.ts: esa función está diseñada para la fusión de un
// horario completo importado por foto (compara por identidad
// materia+día contra un BloquePropuesto sin id, requiere `nombrePorMateriaId`
// como mapa aparte). El caso de uso acá es distinto — "¿este bloque nuevo/
// movido choca con algo que el usuario ya tiene guardado?" — y no necesita
// nada de esa maquinaria. `excluirId` permite que un bloque no choque
// consigo mismo al modificarlo (su propia fila sigue en la base con el
// horario viejo hasta que el UPDATE se aplica).
export function hayColision(
  existentes: { id: string; diaSemana: number; horaInicio: string | null; horaFin: string | null }[],
  candidato: { diaSemana: number; horaInicio: string | null; horaFin: string | null },
  excluirId?: string
): boolean {
  if (!candidato.horaInicio || !candidato.horaFin) return false
  for (const b of existentes) {
    if (excluirId && b.id === excluirId) continue
    if (b.diaSemana !== candidato.diaSemana) continue
    if (!b.horaInicio || !b.horaFin) continue
    // Dos rangos [inicio, fin) se solapan si cada uno empieza antes de que
    // el otro termine.
    if (candidato.horaInicio < b.horaFin && b.horaInicio < candidato.horaFin) return true
  }
  return false
}
