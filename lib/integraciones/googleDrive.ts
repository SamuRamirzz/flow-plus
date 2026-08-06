// Sprint Archivos / Fase 2 — cliente de Google Drive API v3.
//
// PURO: sin fetch, sin acceso a la base. Toda la interpretación de errores y
// construcción de payloads vive acá para poder probarla sin red; el fetch
// real (con el access token de obtenerAccessTokenValido) está en
// lib/server/googleDrive.ts. Mismo corte que lib/integraciones/oauthGoogle.ts
// frente a lib/server/integracionGoogle.ts.

export const MIME_TYPE_CARPETA = 'application/vnd.google-apps.folder'
export const BASE_DRIVE_API = 'https://www.googleapis.com/drive/v3'
export const BASE_DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export type ClaseErrorDrive =
  /** El archivo/carpeta ya no existe en Drive. Al borrar, esto es éxito, no error. */
  | 'no_encontrado'
  /** 403 con un motivo que no es cuota — el usuario no tiene permiso sobre ese recurso. */
  | 'permisos'
  /** 403 storageQuotaExceeded — el Drive del usuario está lleno, no un problema nuestro. */
  | 'cuota_excedida'
  /** 401 — el access token dejó de servir a mitad de operación. El llamador debe invalidar el caché y reintentar UNA vez. */
  | 'token_invalido'
  /** 429 o 5xx o red caída — reintentable sin cambiar nada. */
  | 'transitorio'
  /** Otro 4xx — algo en lo que armamos la petición está mal, no es culpa del usuario. */
  | 'configuracion'

export type ResultadoDrive<T> = { ok: true; datos: T } | { ok: false; clase: ClaseErrorDrive; detalle: string }

function mensajeDeError(cuerpo: unknown): string | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const error = (cuerpo as Record<string, unknown>).error
  if (typeof error !== 'object' || error === null) return null
  const mensaje = (error as Record<string, unknown>).message
  return typeof mensaje === 'string' && mensaje.length > 0 ? mensaje : null
}

function primerMotivo(cuerpo: unknown): string | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const error = (cuerpo as Record<string, unknown>).error
  if (typeof error !== 'object' || error === null) return null
  const errores = (error as Record<string, unknown>).errors
  if (!Array.isArray(errores) || errores.length === 0) return null
  const primero = errores[0]
  if (typeof primero !== 'object' || primero === null) return null
  const motivo = (primero as Record<string, unknown>).reason
  return typeof motivo === 'string' ? motivo : null
}

/**
 * PURA. Traduce una respuesta HTTP de Drive API v3 (forma real:
 * `{ error: { code, message, errors: [{ reason, message }] } }`) a una
 * decisión sobre qué hacer, no solo qué pasó.
 *
 * `storageQuotaExceeded` y un 403 genérico (p. ej. `insufficientPermissions`)
 * comparten el mismo código HTTP pero exigen respuestas completamente
 * distintas (avisar que el Drive está lleno vs. que la vinculación no
 * alcanza) — por eso la clasificación mira `error.errors[0].reason`, no solo
 * `estadoHttp`.
 */
export function interpretarErrorDrive(estadoHttp: number, cuerpo: unknown): { clase: ClaseErrorDrive; detalle: string } {
  const detalle = mensajeDeError(cuerpo) ?? `Drive respondió HTTP ${estadoHttp}`

  if (estadoHttp === 404) return { clase: 'no_encontrado', detalle }
  if (estadoHttp === 401) return { clase: 'token_invalido', detalle }
  if (estadoHttp === 429 || estadoHttp >= 500) return { clase: 'transitorio', detalle }

  if (estadoHttp === 403) {
    const motivo = primerMotivo(cuerpo)
    if (motivo === 'storageQuotaExceeded') return { clase: 'cuota_excedida', detalle }
    return { clase: 'permisos', detalle }
  }

  return { clase: 'configuracion', detalle }
}

/**
 * PURA. El código de estado HTTP que ESTE backend le devuelve al cliente de
 * Flow+ — deliberadamente distinto del que devolvió Drive. Un 401 de Drive
 * con el reintento ya agotado no es un 401 nuestro: el usuario SÍ tiene una
 * sesión válida en Flow+, el problema está en la integración con Google, así
 * que se traduce a 502 (bad gateway), no a "no estás autenticado".
 */
export function estadoHttpParaClase(clase: ClaseErrorDrive): number {
  switch (clase) {
    case 'no_encontrado':
      return 404
    case 'permisos':
      return 403
    case 'cuota_excedida':
      return 507
    case 'token_invalido':
      return 502
    case 'transitorio':
      return 503
    case 'configuracion':
      return 500
  }
}

/** PURA. Body JSON de `POST /files` (metadata, sin el binario). */
export function construirMetadataArchivo(input: { nombre: string; mimeType?: string; carpetaId?: string; descripcion?: string }): Record<string, unknown> {
  const metadata: Record<string, unknown> = { name: input.nombre }
  if (input.mimeType) metadata.mimeType = input.mimeType
  if (input.carpetaId) metadata.parents = [input.carpetaId]
  if (input.descripcion) metadata.description = input.descripcion
  return metadata
}

/**
 * PURA. Escapa un valor para interpolar en `q=` del lenguaje de consulta de
 * Drive (https://developers.google.com/drive/api/guides/search-files): `\` y
 * `'` deben escaparse con `\`, en ese orden — escapar la comilla primero
 * duplicaría el backslash que la propia regla acaba de introducir.
 */
export function escaparValorConsultaDrive(valor: string): string {
  return valor.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * PURA. Parsea `GET /about?fields=storageQuota`. `limit` viene AUSENTE para
 * cuentas Workspace con espacio ilimitado — se modela como `null`, nunca
 * como `0` (que leería como "sin espacio") ni `Infinity` (no serializable).
 */
export function parsearEspacioUsado(cuerpo: unknown): { usadoBytes: number; totalBytes: number | null } | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const cuota = (cuerpo as Record<string, unknown>).storageQuota
  if (typeof cuota !== 'object' || cuota === null) return null
  const { usage, limit } = cuota as Record<string, unknown>
  if (typeof usage !== 'string') return null
  const usadoBytes = Number(usage)
  if (!Number.isFinite(usadoBytes)) return null
  const totalBytes = typeof limit === 'string' && limit.length > 0 ? Number(limit) : null
  return { usadoBytes, totalBytes: totalBytes !== null && Number.isFinite(totalBytes) ? totalBytes : null }
}
