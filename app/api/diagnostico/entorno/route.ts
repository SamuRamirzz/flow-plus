import { createHash } from 'node:crypto'
import { estadoClavesCifrado } from '@/lib/server/clavesCifrado'
import { ok, errorJson } from '@/lib/server/respuestas'

// Sprint Archivos / Fase 0 — comparar entornos sin exponer ni un secreto.
//
// ───────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// ───────────────────────────────────────────────────────────────────────────
// Este proyecto ya perdió dos veces horas de investigación por variables de
// entorno desincronizadas entre .env.local y Vercel: GEMINI_API_KEY se
// regeneró en local y nunca se actualizó en producción, y el síntoma (un 400
// genérico, sin nada en la consola del navegador) no apuntaba a la causa por
// ningún lado. Con este endpoint eso se responde en dos curls: si la huella de
// una variable difiere entre local y producción, ahí está el problema.
//
// Devuelve HUELLAS (8 hex de sha256), nunca valores. Una huella no permite
// recuperar el secreto, pero sí compararlo entre entornos, que es justo lo que
// hace falta y nada más.
//
// Protegido con el mismo guard `Bearer $CRON_SECRET` que ya usa
// app/api/cron/recordatorios — no se inventa un mecanismo nuevo. No usa
// requerirUsuario() a propósito: hace falta poder llamarlo desde una terminal
// contra producción sin una sesión de navegador.

export const dynamic = 'force-dynamic'

/** Variables cuya coherencia entre entornos importa. Nunca se devuelve su valor. */
const VARIABLES_VIGILADAS = [
  'INTEGRACIONES_CIFRADO_CLAVE',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GEMINI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'CRON_SECRET',
] as const

type EstadoVariable = { presente: boolean; huella: string | null }

function huellaDe(valor: string | undefined): EstadoVariable {
  if (!valor) return { presente: false, huella: null }
  return { presente: true, huella: createHash('sha256').update(valor).digest('hex').slice(0, 8) }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return errorJson('CRON_SECRET no está configurado en el servidor', 500)
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return errorJson('No autorizado', 401)

  const variables: Record<string, EstadoVariable> = {}
  for (const nombre of VARIABLES_VIGILADAS) variables[nombre] = huellaDe(process.env[nombre])

  return ok({
    entorno: process.env.VERCEL_ENV ?? 'local',
    // `kids` es lo mismo que la huella de la clave de cifrado, pero derivado del
    // material decodificado — si local y producción muestran kids distintos, los
    // sobres guardados con uno no se pueden descifrar con el otro.
    cifrado: estadoClavesCifrado(),
    variables,
  })
}
