import { supabase } from '@/lib/supabase'
import type { Archivo, ActividadIA, EspacioDrive, MensajeArchivo, EstadoDrive, TareaDetectada, TipoDocumento } from './tipos'

// Sprint Archivos / Frontend — el único punto del cliente que habla con los
// endpoints de Archivos. Mismo espíritu que lib/api/cliente.ts: cada pantalla
// llama a estas funciones, ninguna arma un `fetch` a mano con su propio
// manejo de errores.
//
// Todas devuelven un resultado explícito en vez de lanzar: la UI de esta
// sección tiene varios estados de error que se muestran distinto (Drive
// desvinculado, formato no analizable, archivo enorme) y un try/catch por
// llamada convertiría esa distinción en un `catch (e)` genérico.

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

// ═══════════════════════════════════════════════════════════════════════════
// Lectura
// ═══════════════════════════════════════════════════════════════════════════

export async function cargarArchivos(): Promise<Resultado<Archivo[]>> {
  const r = await pedir<{ archivos: Archivo[] }>('/api/archivos')
  return r.ok ? { ok: true, datos: r.datos.archivos } : r
}

export async function cargarEspacio(): Promise<Resultado<EspacioDrive>> {
  return pedir<EspacioDrive>('/api/archivos/espacio')
}

export async function cargarActividad(): Promise<Resultado<ActividadIA[]>> {
  const r = await pedir<{ actividad: ActividadIA[] }>('/api/archivos/actividad')
  return r.ok ? { ok: true, datos: r.datos.actividad } : r
}

export async function obtenerArchivo(id: string): Promise<Resultado<Archivo>> {
  const r = await pedir<{ archivo: Archivo }>(`/api/archivos/${id}`)
  return r.ok ? { ok: true, datos: r.datos.archivo } : r
}

/** URL de contenido. `inline` sirve la vista previa; sin él, descarga. */
export function urlContenido(id: string, modo: 'inline' | 'descargar'): string {
  return `/api/archivos/${id}?${modo === 'inline' ? 'inline=1' : 'descargar=1'}`
}

export async function eliminarArchivo(id: string): Promise<Resultado<{ eliminado: boolean }>> {
  return pedir<{ eliminado: boolean }>(`/api/archivos/${id}`, { method: 'DELETE' })
}

// ═══════════════════════════════════════════════════════════════════════════
// Análisis de IA
// ═══════════════════════════════════════════════════════════════════════════

export type Analisis = { resumen: string | null; tipoDocumento: TipoDocumento; tareas: TareaDetectada[] }

/**
 * Dispara el análisis de un archivo ya subido.
 *
 * El endpoint distingue 422 (no reintentable: formato no soportado, archivo
 * demasiado grande) de 503 (reintentable: red, cuota, modelo caído) — la UI
 * usa esa diferencia para ofrecer "Reintentar" solo cuando tiene sentido,
 * así que el status se propaga tal cual en vez de aplanarse a un booleano.
 */
export async function analizarArchivo(id: string): Promise<Resultado<Analisis>> {
  const r = await pedir<{ analisis: Analisis }>(`/api/archivos/${id}/analizar`, { method: 'POST' })
  return r.ok ? { ok: true, datos: r.datos.analisis } : r
}

export async function cargarConversacionArchivo(id: string): Promise<Resultado<MensajeArchivo[]>> {
  const r = await pedir<{ mensajes: MensajeArchivo[] }>(`/api/archivos/${id}/preguntar`)
  return r.ok ? { ok: true, datos: r.datos.mensajes } : r
}

export async function preguntarSobreArchivo(id: string, pregunta: string): Promise<Resultado<{ respuesta: string; mensajes: MensajeArchivo[] }>> {
  return pedir<{ respuesta: string; mensajes: MensajeArchivo[] }>(`/api/archivos/${id}/preguntar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pregunta }),
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Vinculación con Drive
// ═══════════════════════════════════════════════════════════════════════════

export async function estadoDrive(): Promise<Resultado<EstadoDrive>> {
  return pedir<EstadoDrive>('/api/integraciones/google-drive')
}

export async function desvincularDrive(): Promise<Resultado<unknown>> {
  return pedir<unknown>('/api/integraciones/google-drive', { method: 'DELETE' })
}

// ═══════════════════════════════════════════════════════════════════════════
// Subida
// ═══════════════════════════════════════════════════════════════════════════

const BUCKET_STAGING = 'archivos-staging'

/**
 * Fases de la subida. Son etapas realmente distintas (dos peticiones, cada
 * una con su propio progreso real), así que la UI las nombra por separado
 * en vez de mostrar una sola barra que se queda clavada en el 100% mientras
 * Drive procesa.
 *
 * `subiendo_drive` es nueva (Sprint Upload resumable): antes de esto, la
 * fase "registrando" cubría TODA la subida a Drive de una sola vez, sin
 * progreso — el servidor respondía cuando terminaba, sin nada intermedio.
 * Ahora, para archivos por encima del umbral resumable, el servidor
 * transmite el porcentaje real chunk a chunk (ver `POST /api/archivos`),
 * así que esta fase sí tiene un `porcentaje` que se mueve de verdad, no un
 * 100% fijo desde el principio.
 */
export type FaseSubida = 'preparando' | 'subiendo' | 'registrando' | 'subiendo_drive' | 'analizando'

export type ProgresoSubida = { fase: FaseSubida; porcentaje: number }

/**
 * Sube el binario al bucket de staging con progreso REAL de bytes.
 *
 * Se usa XMLHttpRequest y no `supabase.storage.upload()` a propósito: el SDK
 * de Supabase no expone eventos de progreso de subida (usa fetch por dentro,
 * que no tiene `upload.onprogress`), así que con él lo único posible sería
 * una barra indeterminada. XHR contra el mismo endpoint REST de Storage da
 * el porcentaje de bytes real, que es lo que pide la referencia.
 *
 * `signal` es opcional y, a diferencia de `fetch`, XHR no acepta un
 * `AbortSignal` de forma nativa — se traduce a mano (`signal.addEventListener
 * ('abort', () => xhr.abort())`), incluido el caso borde de que ya venga
 * abortado ANTES de que este código corra.
 */
function subirAStaging(archivo: File, onProgreso: (porcentaje: number) => void, signal?: AbortSignal): Promise<Resultado<string>> {
  return (async () => {
    const { data: sesion } = await supabase.auth.getSession()
    const token = sesion.session?.access_token
    const userId = sesion.session?.user?.id

    if (!token || !userId) {
      return { ok: false, error: 'Tu sesión expiró — vuelve a iniciar sesión para subir archivos.', status: 401 } as const
    }

    const extension = archivo.name.includes('.') ? archivo.name.split('.').pop()! : 'bin'
    // Mismo esquema de ruta que lib/storage.ts — el prefijo `<user_id>/` es lo
    // que comparan tanto las políticas RLS de Storage como `esRutaDelUsuario()`
    // en el servidor. No es decorativo.
    const ruta = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!base) return { ok: false, error: 'Falta la configuración de Supabase en el cliente', status: 0 } as const

    return new Promise<Resultado<string>>((resolver) => {
      if (signal?.aborted) {
        resolver({ ok: false, error: 'Subida cancelada', status: 0 })
        return
      }

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${base}/storage/v1/object/${BUCKET_STAGING}/${ruta}`)
      xhr.setRequestHeader('authorization', `Bearer ${token}`)
      xhr.setRequestHeader('x-upsert', 'false')
      if (archivo.type) xhr.setRequestHeader('content-type', archivo.type)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgreso((e.loaded / e.total) * 100)
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolver({ ok: true, datos: ruta })
        let mensaje = `No se pudo subir el archivo (${xhr.status})`
        try {
          const cuerpo = JSON.parse(xhr.responseText) as { message?: string; error?: string }
          mensaje = cuerpo.message ?? cuerpo.error ?? mensaje
        } catch {
          /* respuesta sin JSON: se queda el mensaje genérico con el status */
        }
        resolver({ ok: false, error: mensaje, status: xhr.status })
      }
      xhr.onerror = () => resolver({ ok: false, error: 'Error de red al subir el archivo', status: 0 })
      xhr.onabort = () => resolver({ ok: false, error: 'Subida cancelada', status: 0 })

      signal?.addEventListener('abort', () => xhr.abort())

      xhr.send(archivo)
    })
  })()
}

/** Forma de cada línea NDJSON que transmite `POST /api/archivos` — espejo del tipo `EventoSubida` del servidor. */
type EventoSubidaServidor =
  | { fase: 'registrando' }
  | { fase: 'subiendo_drive'; porcentaje: number }
  | { fase: 'completo'; archivo: Archivo }
  | { fase: 'error'; mensaje: string; status: number }

/**
 * Registra el archivo (ya en staging) en Drive + Postgres, leyendo el
 * stream NDJSON de `POST /api/archivos` para progreso real de la subida a
 * Drive — ver ese Route Handler para el detalle completo del protocolo.
 *
 * `signal`: si se aborta, el `fetch` en curso se corta y el servidor lo
 * detecta vía `request.signal` — verificado en vivo contra un `next dev`
 * real (no asumido) que esto SÍ dispara el evento `abort` del lado
 * servidor, deteniendo el loop de chunks a Drive de inmediato.
 */
async function registrarEnDrive(
  ruta: string,
  nombre: string,
  opciones: Pick<OpcionesSubida, 'materiaId' | 'tareaId'>,
  onProgreso: (p: ProgresoSubida) => void,
  signal?: AbortSignal,
): Promise<Resultado<Archivo>> {
  let res: Response
  try {
    res = await fetch('/api/archivos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ruta, nombre, materiaId: opciones.materiaId ?? null, tareaId: opciones.tareaId ?? null }),
      signal,
    })
  } catch (e) {
    if (signal?.aborted) return { ok: false, error: 'Subida cancelada', status: 0 }
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red', status: 0 }
  }

  if (!res.ok) {
    // Falló ANTES de empezar a transmitir (validación, ruta ajena, staging
    // no encontrado) — el servidor todavía responde JSON plano en esos
    // casos, ver el comentario de `POST /api/archivos`.
    const cuerpo = await res.json().catch(() => null)
    const mensaje = (cuerpo as { error?: string } | null)?.error ?? `Error ${res.status}`
    return { ok: false, error: mensaje, status: res.status }
  }

  if (!res.body) return { ok: false, error: 'El servidor no devolvió contenido', status: 0 }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let archivoFinal: Archivo | null = null
  let errorFinal: { mensaje: string; status: number } | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lineas = buffer.split('\n')
    buffer = lineas.pop() ?? '' // la última puede venir incompleta a mitad de un chunk de red
    for (const linea of lineas) {
      if (linea.trim().length === 0) continue
      const evento = JSON.parse(linea) as EventoSubidaServidor
      if (evento.fase === 'registrando') onProgreso({ fase: 'registrando', porcentaje: 100 })
      else if (evento.fase === 'subiendo_drive') onProgreso({ fase: 'subiendo_drive', porcentaje: evento.porcentaje })
      else if (evento.fase === 'completo') archivoFinal = evento.archivo
      else if (evento.fase === 'error') errorFinal = { mensaje: evento.mensaje, status: evento.status }
    }
  }

  if (errorFinal) return { ok: false, error: errorFinal.mensaje, status: errorFinal.status }
  if (!archivoFinal) return { ok: false, error: 'La subida terminó sin confirmación del servidor', status: 0 }
  return { ok: true, datos: archivoFinal }
}

export type OpcionesSubida = {
  materiaId?: string | null
  tareaId?: string | null
  /** Dispara el análisis de IA tras registrar el archivo. Best-effort: si falla, el archivo ya está sano. */
  analizar?: boolean
}

/**
 * Flujo completo de subida: staging (progreso real) → registro en Drive
 * (progreso real, resumable si el archivo es grande) → análisis opcional.
 *
 * El análisis va SEPARADO y después, tal como lo diseñó el backend: es una
 * llamada de visión que duplicaría la espera de la subida, y es reintentable
 * por sí sola. Si falla, la subida NO se considera fallida — el archivo ya
 * está en Drive y en Postgres.
 *
 * `signal` cancela CUALQUIERA de las dos fases de red en curso — no solo la
 * UI, el servidor también se entera (ver `registrarEnDrive`).
 */
export async function subirArchivoCompleto(
  archivo: File,
  opciones: OpcionesSubida,
  onProgreso: (p: ProgresoSubida) => void,
  signal?: AbortSignal,
): Promise<Resultado<Archivo>> {
  onProgreso({ fase: 'preparando', porcentaje: 0 })

  const staging = await subirAStaging(archivo, (pct) => onProgreso({ fase: 'subiendo', porcentaje: pct }), signal)
  if (!staging.ok) return staging

  const registro = await registrarEnDrive(staging.datos, archivo.name, opciones, onProgreso, signal)
  if (!registro.ok) return registro

  if (opciones.analizar) {
    onProgreso({ fase: 'analizando', porcentaje: 100 })
    // Deliberadamente sin propagar el fallo: un archivo que no se pudo
    // analizar sigue siendo una subida exitosa. El motivo queda en
    // `analisis_error` y la UI lo muestra en el panel de detalle.
    await analizarArchivo(registro.datos.id)
  }

  return { ok: true, datos: registro.datos }
}
