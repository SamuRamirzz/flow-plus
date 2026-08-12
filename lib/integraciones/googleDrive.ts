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

// ═══════════════════════════════════════════════════════════════════════════
// Upload resumable (archivos grandes) — protocolo verificado contra la
// documentación real de Google
// (developers.google.com/workspace/drive/api/guides/manage-uploads), no
// adivinado:
//   1. POST a `${BASE_DRIVE_UPLOAD}/files?uploadType=resumable` con headers
//      `X-Upload-Content-Type`/`X-Upload-Content-Length` → la respuesta trae
//      un header `Location` con la URI de sesión (válida 1 semana).
//   2. PUT a esa URI por cada chunk, con `Content-Range: bytes A-B/total`.
//      `308` = seguir subiendo, `200`/`201` = completo.
//   3. Reanudar tras un corte: PUT vacío con `Content-Range: bytes */total`;
//      el header `Range` de la respuesta (`bytes=0-N`) dice cuánto se
//      recibió — hay que seguir desde el byte N+1.
//
// Todo lo de acá abajo es PURO: construye headers/URLs e interpreta
// respuestas, sin hacer ningún fetch. El I/O real (que sí necesita el
// access token) vive en lib/server/googleDrive.ts.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Múltiplo de 256KB recomendado por Google ("Create chunks in multiples of
 * 256 KB... keep the chunk size as large as possible so the upload is
 * efficient"). 8MB: bastante grande para que el overhead de latencia de
 * cada PUT no domine el tiempo total (crítico dentro de un
 * `maxDuration` acotado), sin ser tan grande como para arriesgar un buffer
 * enorme en memoria del lado servidor a la vez.
 */
export const TAMANO_CHUNK_RESUMABLE = 8 * 1024 * 1024

/** PURA. Body/headers para iniciar una sesión resumable. */
export function construirInicioResumable(input: { nombre: string; mimeType: string; tamanoBytes: number; carpetaId: string }): {
  url: string
  headers: Record<string, string>
  body: string
} {
  return {
    url: `${BASE_DRIVE_UPLOAD}/files?uploadType=resumable&fields=id,webViewLink,size`,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': input.mimeType,
      'X-Upload-Content-Length': String(input.tamanoBytes),
    },
    body: JSON.stringify(construirMetadataArchivo({ nombre: input.nombre, mimeType: input.mimeType, carpetaId: input.carpetaId })),
  }
}

/**
 * PURA. Header `Content-Range` para un chunk — formato exacto documentado:
 * `bytes {inicio}-{fin}/{total}` (fin INCLUSIVE, a diferencia de cómo
 * `slice()` de JS trata sus límites — quien arma el chunk de bytes debe
 * restar 1 al índice de corte que use acá).
 */
export function construirContentRange(inicio: number, fin: number, total: number): string {
  return `bytes ${inicio}-${fin}/${total}`
}

/** PURA. Igual que arriba, pero para la consulta de estado (PUT vacío) — sin rango conocido todavía. */
export function construirContentRangeConsulta(total: number): string {
  return `bytes */${total}`
}

export type ResultadoChunk =
  | { estado: 'incompleto'; siguienteByte: number }
  | { estado: 'completo'; driveFileId: string; webViewLink: string | null; tamanoBytes: number }
  | { estado: 'error'; clase: ClaseErrorDrive; detalle: string }

/**
 * PURA. Interpreta la respuesta de un PUT de chunk — separada del fetch
 * para poder probar los 3 desenlaces (308/200/error) sin red.
 *
 * `308` es Drive diciendo "seguí" — el header `Range` (`bytes=0-N`) indica
 * el ÚLTIMO byte confirmado; el siguiente chunk debe empezar en N+1. Si el
 * header falta (no debería, pero la red es la red), se asume que no se
 * confirmó nada y se reintenta desde `finEsperado + 1` como mejor esfuerzo.
 */
export function interpretarRespuestaChunk(estadoHttp: number, headerRange: string | null, cuerpo: unknown, finEsperado: number): ResultadoChunk {
  if (estadoHttp === 308) {
    const match = headerRange ? /bytes=\d+-(\d+)/.exec(headerRange) : null
    const ultimoConfirmado = match ? Number(match[1]) : finEsperado
    return { estado: 'incompleto', siguienteByte: ultimoConfirmado + 1 }
  }
  if (estadoHttp === 200 || estadoHttp === 201) {
    const c = (cuerpo ?? {}) as Record<string, unknown>
    const id = typeof c.id === 'string' ? c.id : null
    if (!id) return { estado: 'error', clase: 'configuracion', detalle: 'Drive respondió éxito pero sin id de archivo' }
    return {
      estado: 'completo',
      driveFileId: id,
      webViewLink: typeof c.webViewLink === 'string' ? c.webViewLink : null,
      tamanoBytes: typeof c.size === 'string' ? Number(c.size) : finEsperado + 1,
    }
  }
  const { clase, detalle } = interpretarErrorDrive(estadoHttp, cuerpo)
  return { estado: 'error', clase, detalle }
}

/**
 * PURA. ¿Dónde reanudar según el header `Range` de una consulta de estado
 * (la que se hace con `construirContentRangeConsulta`)? Sin header `Range`
 * en la respuesta, Drive no recibió ningún byte todavía — se reanuda desde 0.
 */
export function siguienteByteDesdeConsulta(headerRange: string | null): number {
  if (!headerRange) return 0
  const match = /bytes=\d+-(\d+)/.exec(headerRange)
  return match ? Number(match[1]) + 1 : 0
}
