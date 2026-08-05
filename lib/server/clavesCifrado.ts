import { parsearClaves, ErrorCifrado, type ClaveCifrado } from '@/lib/integraciones/cifrado'

// Sprint Archivos / Fase 0 — el único punto que lee la clave de cifrado del
// entorno. lib/integraciones/cifrado.ts es puro y nunca toca process.env; esta
// es su costura con el mundo real, igual que lib/server/supabaseServer.ts lo es
// para Supabase.

export const NOMBRE_VAR_CLAVE = 'INTEGRACIONES_CIFRADO_CLAVE'

const COMO_GENERARLA = `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

let cache: ClaveCifrado[] | null = null
let yaAnunciado = false

/**
 * Claves de cifrado del entorno. Lanza `ErrorCifrado` si falta o está mal.
 *
 * PEREZOSA y memoizada, por el mismo motivo exacto que `supabaseServer` usa un
 * `Proxy` (ver ese archivo): si leyera process.env al importar el módulo,
 * cualquier archivo que lo tuviera en su cadena de imports exigiría la variable
 * para poder correr en Vitest — aunque el test no cifrara nada.
 */
export function clavesCifrado(): ClaveCifrado[] {
  if (cache) return cache

  const resultado = parsearClaves(process.env[NOMBRE_VAR_CLAVE])
  if (!resultado.ok) {
    throw new ErrorCifrado(
      resultado.motivo === 'ausente' ? 'CLAVE_AUSENTE' : 'CLAVE_INVALIDA',
      `${NOMBRE_VAR_CLAVE} ${resultado.mensaje}. Genérala con: ${COMO_GENERARLA} — y ponla en .env.local Y en Vercel ` +
        `(Project Settings → Environment Variables) con el MISMO valor. Si difieren, los tokens ya guardados no se podrán descifrar.`
    )
  }

  // Una línea por proceso, visible en Vercel → Function Logs. Comparar este
  // kid entre local y producción es la forma barata de detectar que los dos
  // entornos tienen claves distintas — que es exactamente el fallo que costó
  // un incidente con GEMINI_API_KEY. El kid es un hash truncado: publicarlo no
  // compromete nada.
  if (!yaAnunciado) {
    yaAnunciado = true
    console.warn(`[cifrado] ${NOMBRE_VAR_CLAVE} activa — kids=[${resultado.claves.map((c) => c.kid).join(', ')}]`)
  }

  cache = resultado.claves
  return cache
}

export type EstadoClaves = { configurada: boolean; kids: string[]; motivo: string | null }

/**
 * Variante que NO lanza, para diagnóstico y health checks.
 * Nunca devuelve material de clave: solo los kids (hashes truncados).
 */
export function estadoClavesCifrado(): EstadoClaves {
  const resultado = parsearClaves(process.env[NOMBRE_VAR_CLAVE])
  return resultado.ok
    ? { configurada: true, kids: resultado.claves.map((c) => c.kid), motivo: null }
    : { configurada: false, kids: [], motivo: resultado.mensaje }
}
