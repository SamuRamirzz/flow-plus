import { describe, expect, it } from 'vitest'
import { tokenVencido, construirCuerpoRefresco, interpretarRespuestaRefresco, MARGEN_EXPIRACION_MS } from '../oauthGoogle'

const AHORA = Date.parse('2026-08-05T12:00:00.000Z')
const iso = (offsetMs: number) => new Date(AHORA + offsetMs).toISOString()

describe('tokenVencido', () => {
  it('token que caduca dentro de una hora → no vencido', () => {
    expect(tokenVencido(iso(60 * 60_000), AHORA)).toBe(false)
  })

  it('token ya caducado → vencido', () => {
    expect(tokenVencido(iso(-1000), AHORA)).toBe(true)
  })

  it('token que caduca DENTRO del margen → vencido (no se entrega algo que muere a mitad de la subida)', () => {
    expect(tokenVencido(iso(MARGEN_EXPIRACION_MS - 1000), AHORA)).toBe(true)
  })

  it('token que caduca justo después del margen → no vencido', () => {
    expect(tokenVencido(iso(MARGEN_EXPIRACION_MS + 1000), AHORA)).toBe(false)
  })

  it('sin fecha o con fecha ilegible → vencido (ante la duda, refrescar)', () => {
    expect(tokenVencido(null, AHORA)).toBe(true)
    expect(tokenVencido(undefined, AHORA)).toBe(true)
    expect(tokenVencido('', AHORA)).toBe(true)
    expect(tokenVencido('no-es-una-fecha', AHORA)).toBe(true)
  })

  it('margen 0 explícito respeta el instante exacto', () => {
    expect(tokenVencido(iso(1000), AHORA, 0)).toBe(false)
    expect(tokenVencido(iso(-1000), AHORA, 0)).toBe(true)
  })
})

describe('construirCuerpoRefresco', () => {
  it('incluye los 4 campos del grant refresh_token', () => {
    const cuerpo = construirCuerpoRefresco({ clientId: 'id-123', clientSecret: 'secreto', refreshToken: 'rt-abc' })
    const params = new URLSearchParams(cuerpo)
    expect(params.get('client_id')).toBe('id-123')
    expect(params.get('client_secret')).toBe('secreto')
    expect(params.get('refresh_token')).toBe('rt-abc')
    expect(params.get('grant_type')).toBe('refresh_token')
  })

  it('escapa caracteres especiales del secret (regresión clásica de armar el body a mano)', () => {
    // Los secrets de Google traen `-` y `_` a menudo, y un token puede traer `/` o `+`.
    const secret = 'a+b/c=d&e'
    const cuerpo = construirCuerpoRefresco({ clientId: 'id', clientSecret: secret, refreshToken: 'rt' })
    expect(cuerpo).not.toContain('a+b/c=d&e')
    expect(new URLSearchParams(cuerpo).get('client_secret')).toBe(secret)
  })
})

describe('interpretarRespuestaRefresco', () => {
  it('200 con access_token → ok, con expiración calculada desde `ahora`', () => {
    const r = interpretarRespuestaRefresco(200, { access_token: 'at-1', expires_in: 3600, scope: 'drive.file' }, AHORA)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.accessToken).toBe('at-1')
      expect(r.expiraEnMs).toBe(AHORA + 3_600_000)
      expect(r.scope).toBe('drive.file')
      expect(r.refreshTokenNuevo).toBeNull()
    }
  })

  it('200 sin expires_in → cae a 1 hora', () => {
    const r = interpretarRespuestaRefresco(200, { access_token: 'at-1' }, AHORA)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.expiraEnMs).toBe(AHORA + 3_600_000)
  })

  it('200 con refresh_token nuevo → se propaga (Google rara vez rota, pero si lo hace hay que guardarlo)', () => {
    const r = interpretarRespuestaRefresco(200, { access_token: 'at-1', refresh_token: 'rt-nuevo' }, AHORA)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.refreshTokenNuevo).toBe('rt-nuevo')
  })

  it('200 sin access_token (o vacío) → transitorio, no éxito', () => {
    for (const cuerpo of [{}, { access_token: '' }, { access_token: 123 }]) {
      const r = interpretarRespuestaRefresco(200, cuerpo, AHORA)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.clase).toBe('transitorio')
    }
  })

  it('400 invalid_grant → revocado (el ÚNICO caso que destruye el token)', () => {
    const r = interpretarRespuestaRefresco(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, AHORA)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.clase).toBe('revocado')
      if (r.clase === 'revocado') expect(r.descripcion).toContain('revoked')
    }
  })

  it('401 invalid_client → configuracion, NUNCA revocado', () => {
    // El caso que, mal clasificado, borraría el token de todos los usuarios
    // por un client_secret mal puesto en un entorno.
    const r = interpretarRespuestaRefresco(401, { error: 'invalid_client' }, AHORA)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.clase).toBe('configuracion')
  })

  it('otros errores 4xx → configuracion', () => {
    for (const error of ['unauthorized_client', 'invalid_request', 'algo_nuevo_de_google']) {
      const r = interpretarRespuestaRefresco(400, { error }, AHORA)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.clase).toBe('configuracion')
    }
  })

  it('4xx sin campo error → configuracion con un código sintético', () => {
    const r = interpretarRespuestaRefresco(403, {}, AHORA)
    expect(r.ok).toBe(false)
    if (!r.ok && r.clase === 'configuracion') expect(r.error).toBe('http_403')
  })

  it('429 y 5xx → transitorio', () => {
    for (const estado of [429, 500, 502, 503]) {
      const r = interpretarRespuestaRefresco(estado, {}, AHORA)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.clase).toBe('transitorio')
    }
  })

  it('cuerpo no interpretable (null, string, array de HTML) → transitorio', () => {
    for (const cuerpo of [null, 'algo', undefined, 42]) {
      const r = interpretarRespuestaRefresco(200, cuerpo, AHORA)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.clase).toBe('transitorio')
    }
  })
})
