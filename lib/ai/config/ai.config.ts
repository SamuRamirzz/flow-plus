export type AIConfig = {
  activeProviderId: string | null
  defaultTimeoutMs: number
  maxConcurrentExecutionsPerUser: number
  maxConcurrentExecutionsGlobal: number
  debug: boolean
  devMode: boolean
  geminiApiKey: string | null
  /** Modelo por defecto de toda llamada que no pida otro (metadata.model). */
  modeloLigero: string
  /** Modelo para entender imágenes (Sprint 8). Ver nota de verificación abajo. */
  modeloVision: string
}

const DEFAULTS = {
  timeoutMs: 30_000,
  // Cierre de Fase 1 — era 3. `resolverOCrearMateria` dispara 2 ejecuciones
  // concurrentes por sí solo (ícono + dedup, vía Promise.all) para una sola
  // materia nueva. Verificado empíricamente: con 3, crear 2-3 materias nuevas
  // en la misma ventana de unos segundos (multi-tab, envíos rápidos, o una
  // materia nueva mientras /ai ya tiene una llamada en curso) agotaba el cupo
  // y tanto el ícono como el aviso de duplicado caían al valor por defecto SIN
  // ningún error visible (agent.execute devuelve status:'error' con code
  // AI_CONCURRENCY_LIMIT, no lanza — resolverIcono/resolverDedup lo tratan
  // como "no hay resultado", indistinguible de "el modelo no encontró nada").
  // 8 da margen para ~4 materias concurrentes, sin tocar el límite global.
  //
  // Sprint Auth — matiz que cambió: hasta ahora TODA la app compartía un único
  // userId, así que este límite "por usuario" era de hecho el límite global.
  // Con sesiones reales vuelve a ser lo que su nombre dice (por persona), y el
  // que acota el total es `maxConcurrentGlobal`. El valor 8 se deja igual: se
  // eligió por el trabajo concurrente de UN usuario (materia nueva = ícono +
  // dedup), que no cambió.
  maxConcurrentPerUser: 8,
  maxConcurrentGlobal: 20,
} as const

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  return raw === '1' || raw.toLowerCase() === 'true'
}

// Único punto de configuración de todo lib/ai — ningún otro módulo debe leer
// process.env ni definir timeouts/límites por su cuenta (docs/ai-architecture,
// Parte 4). Los valores por defecto son conservadores porque todavía no hay
// ningún proveedor conectado.
export const aiConfig: AIConfig = {
  activeProviderId: process.env.AI_ACTIVE_PROVIDER ?? null,
  defaultTimeoutMs: readIntEnv('AI_TIMEOUT_MS', DEFAULTS.timeoutMs),
  maxConcurrentExecutionsPerUser: readIntEnv('AI_MAX_CONCURRENT_PER_USER', DEFAULTS.maxConcurrentPerUser),
  maxConcurrentExecutionsGlobal: readIntEnv('AI_MAX_CONCURRENT_GLOBAL', DEFAULTS.maxConcurrentGlobal),
  debug: readBoolEnv('AI_DEBUG', process.env.NODE_ENV !== 'production'),
  devMode: process.env.NODE_ENV !== 'production',
  // Server-only — nunca NEXT_PUBLIC_*. Puede faltar en desarrollo; el
  // proveedor que la necesite falla explícito en vez de asumir un valor.
  geminiApiKey: process.env.GEMINI_API_KEY ?? null,

  // Ids de modelo verificados contra la API real (GET /v1beta/models) en el
  // Sprint 8, no contra memoria de entrenamiento ni documentación.
  modeloLigero: process.env.AI_MODELO_LIGERO ?? 'gemini-3.5-flash-lite',

  // Visión: se probó `gemini-3.5-flash-lite` vs `gemini-3.5-flash` con una
  // imagen real de horario (11 bloques de verdad, 5 días) pidiendo salida
  // estructurada en la MISMA llamada. Ambos extrajeron 11/11 bloques
  // correctos (materia + día ISO + hora + aula); flash-lite tardó ~3.3s
  // contra ~6.7s y gastó 1862 tokens contra 2862. Se queda el ligero: mismo
  // acierto, la mitad de latencia y ~35% menos tokens. Si una foto real
  // (torcida, con sombras, manuscrita) degrada el acierto, cambiar esta
  // línea a 'gemini-3.5-flash' es el único cambio necesario — el agente ya
  // pide el modelo por metadata.model.
  modeloVision: process.env.AI_MODELO_VISION ?? 'gemini-3.5-flash-lite',
}
