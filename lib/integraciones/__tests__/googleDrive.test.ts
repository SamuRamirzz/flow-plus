import { describe, expect, it } from 'vitest'
import {
  interpretarErrorDrive,
  estadoHttpParaClase,
  construirMetadataArchivo,
  escaparValorConsultaDrive,
  parsearEspacioUsado,
  MIME_TYPE_CARPETA,
  construirInicioResumable,
  construirContentRange,
  construirContentRangeConsulta,
  interpretarRespuestaChunk,
  siguienteByteDesdeConsulta,
  TAMANO_CHUNK_RESUMABLE,
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

describe('construirInicioResumable', () => {
  it('arma la URL, headers y body exactos que pide el protocolo documentado de Google', () => {
    const r = construirInicioResumable({ nombre: 'clase.mp3', mimeType: 'audio/mpeg', tamanoBytes: 123456, carpetaId: 'carpeta-1' })
    expect(r.url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink,size')
    expect(r.headers['X-Upload-Content-Type']).toBe('audio/mpeg')
    expect(r.headers['X-Upload-Content-Length']).toBe('123456')
    expect(JSON.parse(r.body)).toEqual({ name: 'clase.mp3', mimeType: 'audio/mpeg', parents: ['carpeta-1'] })
  })
})

describe('construirContentRange / construirContentRangeConsulta', () => {
  it('formato exacto "bytes {inicio}-{fin}/{total}"', () => {
    expect(construirContentRange(0, 8388607, 20000000)).toBe('bytes 0-8388607/20000000')
  })

  it('consulta de estado usa "*" en vez de un rango — Drive dice cuánto recibió', () => {
    expect(construirContentRangeConsulta(20000000)).toBe('bytes */20000000')
  })
})

describe('interpretarRespuestaChunk', () => {
  it('308 con header Range → sigue desde el byte confirmado + 1', () => {
    const r = interpretarRespuestaChunk(308, 'bytes=0-8388607', null, 8388607)
    expect(r).toEqual({ estado: 'incompleto', siguienteByte: 8388608 })
  })

  it('308 SIN header Range (la red es la red) → mejor esfuerzo desde finEsperado + 1', () => {
    const r = interpretarRespuestaChunk(308, null, null, 8388607)
    expect(r).toEqual({ estado: 'incompleto', siguienteByte: 8388608 })
  })

  it('200/201 con id → completo, con webViewLink y tamaño reales', () => {
    const cuerpo = { id: 'drive-id-1', webViewLink: 'https://drive.google.com/x', size: '20000000' }
    expect(interpretarRespuestaChunk(200, null, cuerpo, 19999999)).toEqual({
      estado: 'completo',
      driveFileId: 'drive-id-1',
      webViewLink: 'https://drive.google.com/x',
      tamanoBytes: 20000000,
    })
    expect(interpretarRespuestaChunk(201, null, cuerpo, 19999999).estado).toBe('completo')
  })

  it('200 sin id → error de configuración, no un crash ni un id inventado', () => {
    const r = interpretarRespuestaChunk(200, null, {}, 100)
    expect(r).toEqual({ estado: 'error', clase: 'configuracion', detalle: 'Drive respondió éxito pero sin id de archivo' })
  })

  it('un error real (403/404/5xx) se interpreta con la misma lógica que el resto de Drive', () => {
    const r = interpretarRespuestaChunk(404, null, { error: { code: 404, message: 'File not found.' } }, 100)
    expect(r).toEqual({ estado: 'error', clase: 'no_encontrado', detalle: 'File not found.' })
  })
})

describe('siguienteByteDesdeConsulta', () => {
  it('con header Range → byte siguiente al último confirmado', () => {
    expect(siguienteByteDesdeConsulta('bytes=0-41')).toBe(42)
  })

  it('sin header (Drive no recibió nada todavía) → reanuda desde 0', () => {
    expect(siguienteByteDesdeConsulta(null)).toBe(0)
  })
})

describe('TAMANO_CHUNK_RESUMABLE', () => {
  it('es múltiplo de 256KB, como exige la documentación de Google', () => {
    expect(TAMANO_CHUNK_RESUMABLE % (256 * 1024)).toBe(0)
  })
})
