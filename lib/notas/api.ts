import type { Nota } from './tipos'

// Sprint Sistema de Notas Unificado — reemplaza las 4 funciones
// hardcodeadas-a-archivo que vivían en lib/archivos/api.ts
// (cargarNotasDeArchivo/crearNotaDeArchivo/actualizarNota/eliminarNota).
// Mismo patrón de Resultado<T> explícito que el resto del proyecto
// (lib/archivos/api.ts, lib/api/cliente.ts) — nunca lanza, la UI decide qué
// mostrar por tipo de error.
export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string; status: number }

async function pedir<T>(url: string, init?: RequestInit): Promise<Resultado<T>> {
  try {
    const respuesta = await fetch(url, init)
    const cuerpo = await respuesta.json().catch(() => null)
    if (!respuesta.ok) {
      const mensaje = (cuerpo as { error?: string } | null)?.error ?? `Error ${respuesta.status}`
      return { ok: false, error: mensaje, status: respuesta.status }
    }
    return { ok: true, datos: cuerpo as T }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red', status: 0 }
  }
}

// Une los 4 posibles anclas de creación/lectura en un único tipo — el
// componente genérico (components/notas/SeccionNotas.tsx) recibe UNA de
// estas 4 formas y no necesita saber el nombre exacto del query param o del
// campo del body, eso lo resuelve este módulo.
export type AnclaNota =
  | { tipo: 'tarea'; id: string }
  | { tipo: 'bloque_horario'; id: string }
  | { tipo: 'archivo'; id: string }
  | { tipo: 'materia'; id: string }

const QUERY_PARAM: Record<AnclaNota['tipo'], string> = {
  tarea: 'tareaId',
  bloque_horario: 'bloqueHorarioId',
  archivo: 'archivoId',
  materia: 'materiaId',
}

export async function cargarNotas(ancla: AnclaNota): Promise<Resultado<Nota[]>> {
  const r = await pedir<{ notas: Nota[] }>(`/api/notas?${QUERY_PARAM[ancla.tipo]}=${ancla.id}`)
  return r.ok ? { ok: true, datos: r.datos.notas } : r
}

export async function crearNota(ancla: AnclaNota, contenido: string): Promise<Resultado<Nota>> {
  const body: Record<string, string> = { contenido }
  body[QUERY_PARAM[ancla.tipo]] = ancla.id
  const r = await pedir<{ nota: Nota }>('/api/notas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.ok ? { ok: true, datos: r.datos.nota } : r
}

export async function actualizarNota(id: string, contenido: string): Promise<Resultado<Nota>> {
  const r = await pedir<{ nota: Nota }>(`/api/notas/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contenido }),
  })
  return r.ok ? { ok: true, datos: r.datos.nota } : r
}

export async function eliminarNota(id: string): Promise<Resultado<{ eliminado: boolean }>> {
  return pedir<{ eliminado: boolean }>(`/api/notas/${id}`, { method: 'DELETE' })
}

// Parte C — vista unificada: TODAS las notas del usuario, sin filtrar por
// ancla. GET /api/notas sin ningún query param ya devuelve exactamente eso
// (confirmado leyendo el endpoint: sin filtros, la query no aplica ningún
// .eq()/.is() y trae todas las filas del usuario).
export async function cargarTodasLasNotas(): Promise<Resultado<Nota[]>> {
  const r = await pedir<{ notas: Nota[] }>('/api/notas')
  return r.ok ? { ok: true, datos: r.datos.notas } : r
}
