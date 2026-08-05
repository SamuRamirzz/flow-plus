// Wrapper mínimo sobre fetch para las mutaciones que van a los Route
// Handlers — un solo lugar que sabe parsear la forma { error: string } que
// devuelven todos ellos (lib/server/respuestas.ts), en vez de repetir
// `await res.json()` + chequear `res.ok` en cada función de lib/tasks.ts.
export type ApiResultado<T> = { ok: true; data: T } | { ok: false; error: string }

async function llamar<T>(input: RequestInfo, init: RequestInit): Promise<ApiResultado<T>> {
  let res: Response
  try {
    res = await fetch(input, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } })
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor.' }
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // Una respuesta sin body (ej. 204) no es un error.
  }

  if (!res.ok) {
    const mensaje = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : `Error ${res.status}`
    return { ok: false, error: mensaje }
  }

  return { ok: true, data: body as T }
}

export function apiPost<T>(url: string, body: unknown): Promise<ApiResultado<T>> {
  return llamar<T>(url, { method: 'POST', body: JSON.stringify(body) })
}

export function apiPatch<T>(url: string, body: unknown): Promise<ApiResultado<T>> {
  return llamar<T>(url, { method: 'PATCH', body: JSON.stringify(body) })
}

export function apiDelete<T>(url: string): Promise<ApiResultado<T>> {
  return llamar<T>(url, { method: 'DELETE' })
}
