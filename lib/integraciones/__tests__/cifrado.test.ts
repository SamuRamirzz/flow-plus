import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { cifrar, descifrar, parsearClaves, huellaClave, kidDelSobre, ErrorCifrado, VERSION_FORMATO, type ClaveCifrado } from '../cifrado'

// Sin red, sin base de datos, sin mocks: `node:crypto` viene en el runtime, y
// el módulo es puro. Mismo criterio que lib/ai/memory/__tests__/mapeo.test.ts.

const claveB64 = (n = 32) => randomBytes(n).toString('base64')

function claves(valor: string): ClaveCifrado[] {
  const r = parsearClaves(valor)
  if (!r.ok) throw new Error(`setup falló: ${r.mensaje}`)
  return r.claves
}

const USUARIO = '11111111-1111-4111-8111-111111111111'
const CTX = `google:refresh:${USUARIO}`
const TOKEN = '1//0eXaMpLe-Refresh_Token.con.puntos-y_guiones'

/** Devuelve el `codigo` del ErrorCifrado que lanzó `fn`, o un centinela. */
function codigo(fn: () => unknown): string {
  try {
    fn()
    return 'NO_LANZO'
  } catch (e) {
    return e instanceof ErrorCifrado ? e.codigo : `OTRO:${e instanceof Error ? e.name : typeof e}`
  }
}

/** Cambia un carácter de un segmento del sobre, conservando el formato. */
function manipularSegmento(sobre: string, indice: number): string {
  const partes = sobre.split('.')
  const seg = partes[indice]
  const primero = seg[0] === 'A' ? 'B' : 'A'
  partes[indice] = primero + seg.slice(1)
  return partes.join('.')
}

describe('parsearClaves', () => {
  it('sin valor / vacío / solo espacios → ausente', () => {
    for (const v of [undefined, null, '', '   ']) {
      const r = parsearClaves(v)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.motivo).toBe('ausente')
    }
  })

  it('clave de 16 bytes → longitud, con el tamaño esperado en el mensaje', () => {
    const r = parsearClaves(randomBytes(16).toString('base64'))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('longitud')
      expect(r.mensaje).toContain('32')
    }
  })

  it('texto con caracteres fuera del alfabeto → formato (no cuela como base64)', () => {
    // Este es el caso que hace falta validar el alfabeto a mano: Buffer.from
    // con 'base64' ignoraría los '!' y devolvería basura de largo arbitrario.
    const r = parsearClaves('clave-secreta-de-produccion!!')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('formato')
  })

  it('32 bytes en base64 → ok, con kid de 8 hex', () => {
    const r = parsearClaves(claveB64())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.claves).toHaveLength(1)
      expect(r.claves[0].kid).toMatch(/^[0-9a-f]{8}$/)
      expect(r.claves[0].bytes).toHaveLength(32)
    }
  })

  it('el kid es determinista — es lo que hace comparable local vs Vercel', () => {
    const valor = claveB64()
    expect(claves(valor)[0].kid).toBe(claves(valor)[0].kid)
    expect(claves(valor)[0].kid).toBe(huellaClave(Buffer.from(valor, 'base64')))
  })

  it('hex y su equivalente base64 dan los mismos bytes y el mismo kid', () => {
    const bytes = randomBytes(32)
    const desdeHex = claves(bytes.toString('hex'))[0]
    const desdeB64 = claves(bytes.toString('base64'))[0]
    expect(desdeHex.bytes.equals(desdeB64.bytes)).toBe(true)
    expect(desdeHex.kid).toBe(desdeB64.kid)
  })

  it('lista separada por comas: preserva el orden y tolera espacios', () => {
    const k1 = claveB64()
    const k2 = claveB64()
    const lista = claves(`${k1} , ${k2}`)
    expect(lista).toHaveLength(2)
    expect(lista[0].kid).toBe(claves(k1)[0].kid)
    expect(lista[1].kid).toBe(claves(k2)[0].kid)
    expect(lista[0].kid).not.toBe(lista[1].kid)
  })

  it('la misma clave repetida → duplicada (copy-paste de una rotación mal hecha)', () => {
    const k1 = claveB64()
    const r = parsearClaves(`${k1},${k1}`)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('duplicada')
  })
})

describe('cifrar / descifrar — camino feliz', () => {
  it('roundtrip de un refresh token realista', () => {
    const k = claves(claveB64())
    expect(descifrar(cifrar(TOKEN, CTX, k), CTX, k)).toBe(TOKEN)
  })

  it('roundtrip con UTF-8 no ASCII y saltos de línea', () => {
    const k = claves(claveB64())
    const texto = 'áé😀 texto\nmultilínea con ñ'
    expect(descifrar(cifrar(texto, CTX, k), CTX, k)).toBe(texto)
  })

  it('cifrar dos veces el mismo texto da sobres DISTINTOS que descifran igual', () => {
    // El IV es aleatorio por llamada: sin esto, GCM sería inseguro.
    const k = claves(claveB64())
    const a = cifrar(TOKEN, CTX, k)
    const b = cifrar(TOKEN, CTX, k)
    expect(a).not.toBe(b)
    expect(descifrar(a, CTX, k)).toBe(TOKEN)
    expect(descifrar(b, CTX, k)).toBe(TOKEN)
  })

  it('la forma del sobre es v1.<kid>.<iv>.<tag>.<ciphertext>', () => {
    const k = claves(claveB64())
    const partes = cifrar(TOKEN, CTX, k).split('.')
    expect(partes).toHaveLength(5)
    expect(partes[0]).toBe(VERSION_FORMATO)
    expect(partes[1]).toBe(k[0].kid)
  })

  it('kidDelSobre lee el kid sin descifrar, y da null con basura', () => {
    const k = claves(claveB64())
    expect(kidDelSobre(cifrar(TOKEN, CTX, k))).toBe(k[0].kid)
    expect(kidDelSobre('no-es-un-sobre')).toBeNull()
  })

  it('rotación: descifra con la clave correcta aunque esté en 2ª posición', () => {
    const vieja = claveB64()
    const nueva = claveB64()
    const sobreViejo = cifrar(TOKEN, CTX, claves(vieja))
    // Tras rotar, la nueva cifra y la vieja sigue descifrando lo ya guardado.
    expect(descifrar(sobreViejo, CTX, claves(`${nueva},${vieja}`))).toBe(TOKEN)
  })
})

describe('cifrar — errores', () => {
  it('lista de claves vacía → CLAVE_AUSENTE', () => {
    expect(codigo(() => cifrar(TOKEN, CTX, []))).toBe('CLAVE_AUSENTE')
  })

  it('texto vacío → TEXTO_VACIO', () => {
    const k = claves(claveB64())
    expect(codigo(() => cifrar('', CTX, k))).toBe('TEXTO_VACIO')
  })
})

describe('descifrar — errores', () => {
  it('el entorno tiene OTRA clave → CLAVE_DESCONOCIDA, con ambos kids en el mensaje', () => {
    // ← El escenario "actualicé la clave en .env.local pero no en Vercel".
    const kOriginal = claves(claveB64())
    const kOtra = claves(claveB64())
    const sobre = cifrar(TOKEN, CTX, kOriginal)

    expect(codigo(() => descifrar(sobre, CTX, kOtra))).toBe('CLAVE_DESCONOCIDA')
    try {
      descifrar(sobre, CTX, kOtra)
    } catch (e) {
      expect((e as Error).message).toContain(kOriginal[0].kid)
      expect((e as Error).message).toContain(kOtra[0].kid)
    }
  })

  it('lista de claves vacía → CLAVE_AUSENTE', () => {
    const k = claves(claveB64())
    expect(codigo(() => descifrar(cifrar(TOKEN, CTX, k), CTX, []))).toBe('CLAVE_AUSENTE')
  })

  it('ciphertext / tag / iv manipulados → AUTENTICACION_FALLIDA', () => {
    const k = claves(claveB64())
    const sobre = cifrar(TOKEN, CTX, k)
    for (const idx of [2, 3, 4]) {
      expect(codigo(() => descifrar(manipularSegmento(sobre, idx), CTX, k))).toBe('AUTENTICACION_FALLIDA')
    }
  })

  it('el mismo sobre con el contexto de OTRO usuario → AUTENTICACION_FALLIDA', () => {
    // Impide trasplantar el sobre de un usuario a la fila de otro.
    const k = claves(claveB64())
    const sobre = cifrar(TOKEN, CTX, k)
    const otroCtx = 'google:refresh:22222222-2222-4222-8222-222222222222'
    expect(codigo(() => descifrar(sobre, otroCtx, k))).toBe('AUTENTICACION_FALLIDA')
  })

  it('reescribir el kid del sobre al de otra clave válida → AUTENTICACION_FALLIDA', () => {
    // El kid va dentro del AAD, así que no se puede falsificar aunque esté en claro.
    const a = claveB64()
    const b = claveB64()
    const juego = claves(`${a},${b}`)
    const sobre = cifrar(TOKEN, CTX, juego) // cifrado con juego[0]
    const partes = sobre.split('.')
    partes[1] = juego[1].kid
    expect(codigo(() => descifrar(partes.join('.'), CTX, juego))).toBe('AUTENTICACION_FALLIDA')
  })

  it('sobres mal formados → FORMATO_INVALIDO', () => {
    const k = claves(claveB64())
    for (const malo of ['', 'abc', 'v1.aa.bb', 'v1.aa.bb.cc.dd.ee']) {
      expect(codigo(() => descifrar(malo, CTX, k))).toBe('FORMATO_INVALIDO')
    }
  })

  it('kid con formato inválido → FORMATO_INVALIDO', () => {
    const k = claves(claveB64())
    expect(codigo(() => descifrar('v1.NOHEX!!.aa.bb.cc', CTX, k))).toBe('FORMATO_INVALIDO')
  })

  it('IV de largo equivocado → FORMATO_INVALIDO, no una excepción cruda de crypto', () => {
    const k = claves(claveB64())
    const sobre = cifrar(TOKEN, CTX, k).split('.')
    sobre[2] = randomBytes(8).toString('base64url') // 8 bytes en vez de 12
    expect(codigo(() => descifrar(sobre.join('.'), CTX, k))).toBe('FORMATO_INVALIDO')
  })

  it('tag de largo equivocado → FORMATO_INVALIDO', () => {
    const k = claves(claveB64())
    const sobre = cifrar(TOKEN, CTX, k).split('.')
    sobre[3] = randomBytes(8).toString('base64url') // 8 bytes en vez de 16
    expect(codigo(() => descifrar(sobre.join('.'), CTX, k))).toBe('FORMATO_INVALIDO')
  })

  it('sobre de una versión más nueva → VERSION_DESCONOCIDA, no FORMATO_INVALIDO', () => {
    // Distingue "rollback de un despliegue" de "dato corrupto".
    const k = claves(claveB64())
    const sobre = cifrar(TOKEN, CTX, k).replace(/^v1\./, 'v2.')
    expect(codigo(() => descifrar(sobre, CTX, k))).toBe('VERSION_DESCONOCIDA')
  })
})
