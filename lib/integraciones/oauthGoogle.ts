// Sprint Archivos / Fase 0 — refresco del access token de Google.
//
// PURO: sin fetch, sin Date.now(), sin process.env. Todo el criterio de "¿hay
// que refrescar?" y "¿qué significa esta respuesta?" vive acá para poder
// probarlo sin red; el fetch real y la escritura en la base están en
// lib/server/integracionGoogle.ts. Mismo corte que lib/ai/agents/calendar/
// validar.ts (puro) frente a lib/server/materias.ts (I/O).

export const URL_TOKEN_GOOGLE = 'https://oauth2.googleapis.com/token'

/** Margen para no entregar un token que caduca a mitad de la petición a Drive. */
export const MARGEN_EXPIRACION_MS = 120_000

/** Google siempre manda `expires_in`; esto es solo red de seguridad. */
const VIDA_POR_DEFECTO_S = 3600

/**
 * PURA. ¿Hace falta refrescar este access token?
 *
 * Devuelve `true` también cuando la fecha falta o es ilegible: ante la duda se
 * refresca, que cuesta un round-trip, en vez de mandar a Drive un token muerto
 * y llevarse un 401 a mitad de una subida.
 */
export function tokenVencido(expiraEnIso: string | null | undefined, ahoraMs: number, margenMs: number = MARGEN_EXPIRACION_MS): boolean {
  if (!expiraEnIso) return true
  const t = Date.parse(expiraEnIso)
  if (Number.isNaN(t)) return true
  return t - margenMs <= ahoraMs
}

/** PURA. Cuerpo `x-www-form-urlencoded` del grant `refresh_token` (RFC 6749 §6). */
export function construirCuerpoRefresco(input: { clientId: string; clientSecret: string; refreshToken: string }): string {
  // URLSearchParams y no concatenación a mano: un client_secret con `+` o `/`
  // (habituales en los que genera Google) se rompería sin percent-encoding.
  return new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: 'refresh_token',
  }).toString()
}

export type RespuestaRefresco =
  | { ok: true; accessToken: string; expiraEnMs: number; scope: string | null; refreshTokenNuevo: string | null }
  /** `invalid_grant`: el usuario revocó el acceso o el token caducó. Irrecuperable sin volver a vincular. */
  | { ok: false; clase: 'revocado'; error: string; descripcion: string | null }
  /** Credenciales de cliente mal puestas. Es NUESTRA configuración, no el usuario. NO tocar su token. */
  | { ok: false; clase: 'configuracion'; error: string; descripcion: string | null }
  /** 5xx, 429, red caída, JSON ilegible. Reintentable. */
  | { ok: false; clase: 'transitorio'; detalle: string }

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null
}

/**
 * PURA. Traduce la respuesta HTTP de Google a una decisión.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUÉ HAY UNA CLASE 'configuracion' SEPARADA DE 'revocado'
 * ───────────────────────────────────────────────────────────────────────────
 * Es la distinción más importante de este archivo. Un `invalid_client`
 * (client_secret mal puesto en un entorno — exactamente el tipo de fallo que
 * ya costó un incidente con GEMINI_API_KEY) devuelve 401 igual que muchos
 * errores de usuario. Si se tratara como "revocado", el llamador marcaría a
 * TODOS los usuarios como revocados y borraría TODOS los refresh tokens en
 * una tarde — un fallo de configuración de 30 segundos convertido en pérdida
 * de datos irreversible para todo el mundo.
 *
 * Solo `invalid_grant` significa que el usuario revocó de verdad.
 */
export function interpretarRespuestaRefresco(estadoHttp: number, cuerpo: unknown, ahoraMs: number): RespuestaRefresco {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    // HTML de un proxy, texto suelto, o el body no se pudo parsear.
    return { ok: false, clase: 'transitorio', detalle: `Respuesta no interpretable de Google (HTTP ${estadoHttp})` }
  }

  const obj = cuerpo as Record<string, unknown>

  if (estadoHttp === 200) {
    const accessToken = texto(obj.access_token)
    if (!accessToken) {
      return { ok: false, clase: 'transitorio', detalle: 'Google respondió 200 pero sin access_token' }
    }
    const expiresIn = typeof obj.expires_in === 'number' && Number.isFinite(obj.expires_in) ? obj.expires_in : VIDA_POR_DEFECTO_S
    return {
      ok: true,
      accessToken,
      expiraEnMs: ahoraMs + expiresIn * 1000,
      scope: texto(obj.scope),
      // Google normalmente NO rota el refresh token, pero si algún día lo
      // hace, descartarlo dejaría al usuario revocado semanas después sin
      // causa aparente. Capturarlo cuesta una línea.
      refreshTokenNuevo: texto(obj.refresh_token),
    }
  }

  if (estadoHttp === 429 || estadoHttp >= 500) {
    return { ok: false, clase: 'transitorio', detalle: `Google respondió HTTP ${estadoHttp}` }
  }

  const error = texto(obj.error) ?? `http_${estadoHttp}`
  const descripcion = texto(obj.error_description)

  if (error === 'invalid_grant') {
    return { ok: false, clase: 'revocado', error, descripcion }
  }

  return { ok: false, clase: 'configuracion', error, descripcion }
}
