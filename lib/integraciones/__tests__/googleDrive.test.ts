import { describe, expect, it } from 'vitest'
import {
  interpretarErrorDrive,
  estadoHttpParaClase,
  construirMetadataArchivo,
  escaparValorConsultaDrive,
  parsearEspacioUsado,
  MIME_TYPE_CARPETA,
} from '../googleDrive'

describe('interpretarErrorDrive', () => {
  it('404 → no_encontrado', () => {
    const r = interpretarErrorDrive(404, { error: { code: 404, message: 'File not found.' } })
    expect(r.clase).toBe('no_encontrado')
    expect(r.detalle).toBe('File not found.')
  })

  it('401 → token_invalido', () => {
    const r = interpretarErrorDrive(401, { error: { code: 401, message: 'Invalid Credentials' } })
    expect(r.clase).toBe('token_invalido')
  })

  it('403 storageQuotaExceeded → cuota_excedida (no permisos)', () => {
    const cuerpo = {
      error: {
        code: 403,
        message: 'The user has exceeded their Drive storage quota.',
        errors: [{ domain: 'usageLimits', reason: 'storageQuotaExceeded', message: 'The user has exceeded their Drive storage quota.' }],
      },
    }
    const r = interpretarErrorDrive(403, cuerpo)
    expect(r.clase).toBe('cuota_excedida')
  })

  it('403 con otro motivo (insufficientPermissions) → permisos, distinto de cuota_excedida', () => {
    const cuerpo = {
      error: {
        code: 403,
        message: 'The user does not have sufficient permissions for this file.',
        errors: [{ domain: 'global', reason: 'insufficientFilePermissions', message: '...' }],
      },
    }
    const r = interpretarErrorDrive(403, cuerpo)
    expect(r.clase).toBe('permisos')
  })

  it('403 sin array de errores → permisos por defecto, no cuota', () => {
    const r = interpretarErrorDrive(403, { error: { code: 403, message: 'Forbidden' } })
    expect(r.clase).toBe('permisos')
  })

  it('429 → transitorio', () => {
    expect(interpretarErrorDrive(429, {}).clase).toBe('transitorio')
  })

  it('5xx → transitorio', () => {
    for (const estado of [500, 502, 503]) {
      expect(interpretarErrorDrive(estado, {}).clase).toBe('transitorio')
    }
  })

  it('otro 4xx (400) → configuracion', () => {
    expect(interpretarErrorDrive(400, { error: { code: 400, message: 'Bad Request' } }).clase).toBe('configuracion')
  })

  it('cuerpo no interpretable → detalle sintético con el código HTTP', () => {
    const r = interpretarErrorDrive(500, null)
    expect(r.detalle).toContain('500')
  })
})

describe('estadoHttpParaClase', () => {
  it('mapea cada clase a su código HTTP propio, no al de Drive', () => {
    expect(estadoHttpParaClase('no_encontrado')).toBe(404)
    expect(estadoHttpParaClase('permisos')).toBe(403)
    expect(estadoHttpParaClase('cuota_excedida')).toBe(507)
    expect(estadoHttpParaClase('token_invalido')).toBe(502)
    expect(estadoHttpParaClase('transitorio')).toBe(503)
    expect(estadoHttpParaClase('configuracion')).toBe(500)
  })
})

describe('construirMetadataArchivo', () => {
  it('solo nombre → metadata mínima', () => {
    expect(construirMetadataArchivo({ nombre: 'apuntes.pdf' })).toEqual({ name: 'apuntes.pdf' })
  })

  it('con carpeta → parents es un array de un elemento', () => {
    const m = construirMetadataArchivo({ nombre: 'x.pdf', carpetaId: 'carpeta-1' })
    expect(m.parents).toEqual(['carpeta-1'])
  })

  it('con mimeType y descripcion → los incluye', () => {
    const m = construirMetadataArchivo({ nombre: 'x', mimeType: MIME_TYPE_CARPETA, descripcion: 'd' })
    expect(m.mimeType).toBe(MIME_TYPE_CARPETA)
    expect(m.description).toBe('d')
  })
})

describe('escaparValorConsultaDrive', () => {
  it('escapa comillas simples', () => {
    expect(escaparValorConsultaDrive("Álgebra's notes")).toBe("Álgebra\\'s notes")
  })

  it('escapa backslashes ANTES que comillas, para no duplicar el escape recién introducido', () => {
    expect(escaparValorConsultaDrive("a\\b'c")).toBe("a\\\\b\\'c")
  })

  it('sin caracteres especiales → se devuelve igual', () => {
    expect(escaparValorConsultaDrive('Cálculo II')).toBe('Cálculo II')
  })
})

describe('parsearEspacioUsado', () => {
  it('con limit → usadoBytes y totalBytes numéricos', () => {
    const r = parsearEspacioUsado({ storageQuota: { usage: '12345', limit: '1073741824' } })
    expect(r).toEqual({ usadoBytes: 12345, totalBytes: 1073741824 })
  })

  it('sin limit (Workspace ilimitado) → totalBytes null, no 0 ni Infinity', () => {
    const r = parsearEspacioUsado({ storageQuota: { usage: '999' } })
    expect(r).toEqual({ usadoBytes: 999, totalBytes: null })
  })

  it('cuerpo sin storageQuota → null', () => {
    expect(parsearEspacioUsado({})).toBeNull()
    expect(parsearEspacioUsado(null)).toBeNull()
  })

  it('usage no numérico → null', () => {
    expect(parsearEspacioUsado({ storageQuota: { usage: 'no-es-numero' } })).toBeNull()
  })
})
