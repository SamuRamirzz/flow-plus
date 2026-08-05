import { apiPost, apiPatch, apiDelete } from '@/lib/api/cliente'
import { esInvitado } from '@/lib/invitado/estado'
import { crearBloqueHorarioInvitado, actualizarBloqueHorarioInvitado, eliminarBloqueHorarioInvitado } from '@/lib/invitado/datos'
import type { BloqueHorario, DiaSemana } from './tipos'
import { filaABloqueHorario, type FilaHorario } from './mapear'

export type NuevoBloqueInput = {
  materiaId: string
  diaSemana: DiaSemana
  horaInicio: string | null
  horaFin: string | null
}

export async function crearBloqueHorario(input: NuevoBloqueInput): Promise<{ ok: true; bloque: BloqueHorario } | { ok: false; error: string }> {
  if (await esInvitado()) return crearBloqueHorarioInvitado(input)
  const resultado = await apiPost<FilaHorario>('/api/horario', input)
  if (!resultado.ok) return { ok: false, error: resultado.error }
  return { ok: true, bloque: filaABloqueHorario(resultado.data) }
}

export async function eliminarBloqueHorario(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await esInvitado()) return eliminarBloqueHorarioInvitado(id)
  const resultado = await apiDelete(`/api/horario/${id}`)
  if (!resultado.ok) return { ok: false, error: resultado.error }
  return { ok: true }
}

export type CambiosBloqueHorario = {
  activo?: boolean
  materiaId?: string
  horaInicio?: string | null
  horaFin?: string | null
  aula?: string | null
  profesor?: string | null
}

// Sub-sprint 8.2 — ahora devuelve el bloque actualizado (el endpoint ya lo
// devolvía, solo faltaba mapearlo) para que la edición inline pueda
// reemplazar el bloque en el estado local sin recargar toda la grilla.
export async function actualizarBloqueHorario(
  id: string,
  cambios: CambiosBloqueHorario
): Promise<{ ok: true; bloque: BloqueHorario } | { ok: false; error: string }> {
  if (await esInvitado()) return actualizarBloqueHorarioInvitado(id, cambios)
  const resultado = await apiPatch<FilaHorario>(`/api/horario/${id}`, cambios)
  if (!resultado.ok) return { ok: false, error: resultado.error }
  return { ok: true, bloque: filaABloqueHorario(resultado.data) }
}
