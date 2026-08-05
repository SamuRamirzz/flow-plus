import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Sprint Archivos / Fase 0 — cifrado en reposo del refresh_token de Google.
//
// PURO: sin I/O, sin process.env, sin Date.now(). Recibe las claves ya
// parseadas y devuelve/acepta strings. Igual criterio que lib/horario/diff.ts
// o lib/ai/memory/mapeo.ts — se prueba entero en el entorno `node` de Vitest
// sin red, sin base de datos y sin mocks. Quien lee la variable de entorno es
// lib/server/clavesCifrado.ts.
//
// ───────────────────────────────────────────────────────────────────────────
// POR QUÉ EN LA APLICACIÓN Y NO CON pgcrypto
// ───────────────────────────────────────────────────────────────────────────
// Con pgcrypto la clave viaja en el texto de cada consulta: acaba en los logs
// de Postgres, en el request HTTP a PostgREST y en cualquier traza de error.
// Cifrando acá, el material de clave nunca entra al proceso de la base — un
// dump de `integraciones_externas` sin INTEGRACIONES_CIFRADO_CLAVE no sirve
// para nada.
//
// ───────────────────────────────────────────────────────────────────────────
// EL FORMATO DEL SOBRE: v1.<kid>.<iv>.<tag>.<ciphertext>
// ───────────────────────────────────────────────────────────────────────────
// Todo en base64url (alfabeto A-Za-z0-9-_), separado por puntos — ningún
// segmento puede contener el separador, así que el parseo es inequívoco.
//
// El `kid` es la decisión central del diseño. Va EN CLARO dentro del sobre y
// además duplicado en su propia columna, y eso convierte el fallo más
// probable de esta feature —"la clave de Vercel no es la de local", que es
// literalmente el incidente que acaba de costar una investigación con
// GEMINI_API_KEY— en un error nombrado y accionable (CLAVE_DESCONOCIDA, con
// los kids de ambos lados en el mensaje) en vez de un fallo de autenticación
// genérico, indistinguible de un token corrupto o de un usuario que revocó el
// acceso. Distinguirlos importa: uno se arregla poniendo bien una variable,
// el otro exige que el usuario vuelva a vincular su cuenta.

export const VERSION_FORMATO = 'v1'

const ALGORITMO = 'aes-256-gcm'
const LARGO_CLAVE = 32 // AES-256
const LARGO_IV = 12 // tamaño nominal de GCM (NIST SP 800-38D)
const LARGO_TAG = 16
const LARGO_KID = 8
const SEGMENTOS_SOBRE = 5

export type CodigoCifrado =
  | 'CLAVE_AUSENTE'
  | 'CLAVE_INVALIDA'
  | 'TEXTO_VACIO'
  | 'FORMATO_INVALIDO'
  | 'VERSION_DESCONOCIDA'
  | 'CLAVE_DESCONOCIDA'
  | 'AUTENTICACION_FALLIDA'

export class ErrorCifrado extends Error {
  readonly codigo: CodigoCifrado
  constructor(codigo: CodigoCifrado, mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje)
    this.codigo = codigo
    this.name = 'ErrorCifrado'
    if (opciones?.cause !== undefined) this.cause = opciones.cause
  }
}

/** Una clave lista para usar. `kid` SIEMPRE deriva de `bytes` — nunca se configura aparte. */
export type ClaveCifrado = { readonly kid: string; readonly bytes: Buffer }

export type MotivoClaveInvalida = 'ausente' | 'formato' | 'longitud' | 'duplicada'

export type ResultadoClaves =
  | { ok: true; claves: ClaveCifrado[] }
  | { ok: false; motivo: MotivoClaveInvalida; mensaje: string }

// 64 hex = 32 bytes. Se comprueba ANTES que base64 porque una cadena de 64
// caracteres hex también encaja en el alfabeto base64.
const RE_HEX_32 = /^[0-9a-fA-F]{64}$/
// Alfabeto base64 y base64url juntos (+/ y -_), con relleno opcional.
const RE_BASE64 = /^[A-Za-z0-9+/\-_]+={0,2}$/
const RE_KID = /^[0-9a-f]{8}$/
const RE_VERSION = /^v\d+$/

/**
 * Huella pública de una clave: 8 hex del sha256 de su material.
 *
 * Es seguro loguearla y guardarla en la base — es un hash truncado con
 * resistencia a preimagen, no revela nada de la clave. Su función es
 * diagnóstica: permite responder "¿este sobre se cifró con la clave que este
 * entorno tiene cargada?" sin intentar descifrar nada.
 */
export function huellaClave(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, LARGO_KID)
}

function decodificarClave(crudo: string): Buffer | null {
  // `Buffer.from(x, 'base64')` ignora en silencio los caracteres inválidos:
  // "clave-secreta!!" decodificaría a basura de largo arbitrario en vez de
  // fallar. Por eso se valida el alfabeto ANTES de decodificar.
  if (RE_HEX_32.test(crudo)) return Buffer.from(crudo, 'hex')
  if (!RE_BASE64.test(crudo)) return null
  const bytes = Buffer.from(crudo, 'base64')
  return bytes.length > 0 ? bytes : null
}

/**
 * PURA. Parsea el valor crudo de la variable de entorno.
 *
 * Acepta base64, base64url o hex, y una LISTA separada por comas: la primera
 * clave es la que cifra, todas descifran. Aceptar la lista desde el día uno
 * (aunque hoy solo haya una) deja la rotación futura resuelta sin tocar ni el
 * parser ni el formato del sobre — solo el valor de la variable.
 */
export function parsearClaves(valorCrudo: string | undefined | null): ResultadoClaves {
  const texto = (valorCrudo ?? '').trim()
  if (texto.length === 0) {
    return { ok: false, motivo: 'ausente', mensaje: 'no está definida' }
  }

  const partes = texto
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (partes.length === 0) {
    return { ok: false, motivo: 'ausente', mensaje: 'no está definida' }
  }

  const claves: ClaveCifrado[] = []
  const vistos = new Set<string>()

  for (const parte of partes) {
    const bytes = decodificarClave(parte)
    if (!bytes) {
      return { ok: false, motivo: 'formato', mensaje: 'no es base64, base64url ni hex válido' }
    }
    if (bytes.length !== LARGO_CLAVE) {
      return {
        ok: false,
        motivo: 'longitud',
        mensaje: `debe decodificar a ${LARGO_CLAVE} bytes (AES-256), no ${bytes.length}`,
      }
    }
    const kid = huellaClave(bytes)
    // Repetir la misma clave casi siempre es un copy-paste mal hecho durante
    // una rotación. Fallar es mejor que ignorarlo en silencio y creer que hay
    // dos generaciones activas cuando solo hay una.
    if (vistos.has(kid)) {
      return { ok: false, motivo: 'duplicada', mensaje: `contiene la misma clave dos veces (kid=${kid})` }
    }
    vistos.add(kid)
    claves.push({ kid, bytes })
  }

  return { ok: true, claves }
}

/**
 * Datos adicionales autenticados (AAD). No son secretos, pero cualquier
 * cambio en ellos invalida el sobre.
 *
 * Incluye la versión y el kid para que no se pueda degradar la cabecera ni
 * falsificar el kid, y el `contexto` del llamador —`google:refresh:<userId>`—
 * para atar el sobre A SU FILA. Sin eso, alguien con escritura en la base
 * podría copiar el sobre de otro usuario a su propia fila y quedarse con su
 * Drive: el sobre descifraría perfecto, porque la clave es la misma.
 */
function construirAad(kid: string, contexto: string): Buffer {
  return Buffer.from(`${VERSION_FORMATO}|${kid}|${contexto}`, 'utf8')
}

/**
 * Cifra `textoPlano` con la PRIMERA clave de la lista (la activa).
 *
 * No es determinista a propósito: el IV es aleatorio en cada llamada. Nunca
 * se expone un parámetro para fijarlo, ni siquiera "para tests" — reutilizar
 * un IV con la misma clave en GCM rompe la confidencialidad y permite forjar
 * tags.
 */
export function cifrar(textoPlano: string, contexto: string, claves: readonly ClaveCifrado[]): string {
  const clave = claves[0]
  if (!clave) {
    throw new ErrorCifrado('CLAVE_AUSENTE', 'No hay ninguna clave de cifrado cargada')
  }
  if (textoPlano.length === 0) {
    // Un refresh token vacío nunca es válido; guardarlo cifrado solo
    // escondería el problema hasta el primer refresco.
    throw new ErrorCifrado('TEXTO_VACIO', 'No se cifra una cadena vacía')
  }

  const iv = randomBytes(LARGO_IV)
  const cipher = createCipheriv(ALGORITMO, clave.bytes, iv)
  cipher.setAAD(construirAad(clave.kid, contexto))
  const cifrado = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [VERSION_FORMATO, clave.kid, iv.toString('base64url'), tag.toString('base64url'), cifrado.toString('base64url')].join('.')
}

type SobreParseado = { kid: string; iv: Buffer; tag: Buffer; cifrado: Buffer }

function parsearSobre(sobre: string): SobreParseado {
  const partes = sobre.split('.')
  if (partes.length !== SEGMENTOS_SOBRE) {
    throw new ErrorCifrado('FORMATO_INVALIDO', `El sobre debe tener ${SEGMENTOS_SOBRE} segmentos, tiene ${partes.length}`)
  }

  const [version, kid, ivB64, tagB64, cifradoB64] = partes as [string, string, string, string, string]

  if (version !== VERSION_FORMATO) {
    // Se distingue "versión que no entiendo" de "esto no es un sobre": la
    // primera es un sobre escrito por código más nuevo (rollback de un
    // despliegue), la segunda es un dato corrupto. Son incidentes distintos.
    if (RE_VERSION.test(version)) {
      throw new ErrorCifrado('VERSION_DESCONOCIDA', `Formato de sobre "${version}", este código solo entiende "${VERSION_FORMATO}"`)
    }
    throw new ErrorCifrado('FORMATO_INVALIDO', 'El primer segmento no es una versión de formato')
  }
  if (!RE_KID.test(kid)) {
    throw new ErrorCifrado('FORMATO_INVALIDO', 'El kid del sobre está mal formado')
  }

  const iv = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const cifrado = Buffer.from(cifradoB64, 'base64url')

  // Se validan los largos acá para que `crypto` nunca reciba entrada
  // malformada y lance una excepción cruda que no sabríamos clasificar.
  if (iv.length !== LARGO_IV) {
    throw new ErrorCifrado('FORMATO_INVALIDO', `El IV debe tener ${LARGO_IV} bytes, tiene ${iv.length}`)
  }
  if (tag.length !== LARGO_TAG) {
    throw new ErrorCifrado('FORMATO_INVALIDO', `El tag debe tener ${LARGO_TAG} bytes, tiene ${tag.length}`)
  }
  if (cifrado.length === 0) {
    throw new ErrorCifrado('FORMATO_INVALIDO', 'El sobre no contiene datos cifrados')
  }

  return { kid, iv, tag, cifrado }
}

/**
 * Lee el kid de un sobre SIN descifrarlo. Devuelve `null` si está mal formado.
 *
 * Sirve para diagnóstico y para el re-cifrado oportunista durante una
 * rotación de clave (¿este sobre está en la generación activa?).
 */
export function kidDelSobre(sobre: string): string | null {
  try {
    return parsearSobre(sobre).kid
  } catch {
    return null
  }
}

/**
 * Descifra un sobre usando la clave cuyo kid coincida.
 *
 * Si ninguna clave cargada tiene ese kid, lanza CLAVE_DESCONOCIDA SIN
 * intentar descifrar — ese es el caso "el entorno tiene otra clave", y
 * confundirlo con AUTENTICACION_FALLIDA (manipulación) llevaría a tratar un
 * problema de configuración como una brecha de seguridad, o peor, como una
 * revocación del usuario.
 */
export function descifrar(sobre: string, contexto: string, claves: readonly ClaveCifrado[]): string {
  if (claves.length === 0) {
    throw new ErrorCifrado('CLAVE_AUSENTE', 'No hay ninguna clave de cifrado cargada')
  }

  const { kid, iv, tag, cifrado } = parsearSobre(sobre)

  const clave = claves.find((c) => c.kid === kid)
  if (!clave) {
    throw new ErrorCifrado(
      'CLAVE_DESCONOCIDA',
      `El sobre se cifró con kid=${kid} y este entorno solo tiene [${claves.map((c) => c.kid).join(', ')}]`
    )
  }

  try {
    const decipher = createDecipheriv(ALGORITMO, clave.bytes, iv)
    decipher.setAAD(construirAad(clave.kid, contexto))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8')
  } catch (error) {
    // El mensaje original de `crypto` ("Unsupported state or unable to
    // authenticate data") no le dice nada útil a nadie — se cuelga como
    // `cause` y se traduce a algo accionable.
    throw new ErrorCifrado(
      'AUTENTICACION_FALLIDA',
      'El sobre no se pudo autenticar: fue manipulado, está corrupto, o el contexto no es el que se usó al cifrar',
      { cause: error }
    )
  }
}
