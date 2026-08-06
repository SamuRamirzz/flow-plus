import type { Session } from '@supabase/supabase-js'
import { supabaseServer } from './supabaseServer'
import { clavesCifrado } from './clavesCifrado'
import { cifrar, descifrar, kidDelSobre, ErrorCifrado } from '@/lib/integraciones/cifrado'
import { URL_TOKEN_GOOGLE, construirCuerpoRefresco, interpretarRespuestaRefresco, tokenVencido } from '@/lib/integraciones/oauthGoogle'

// Sprint Archivos / Fase 0 — la costura con I/O del refresh token de Google.
// Toda la lógica testeable vive en lib/integraciones/{cifrado,oauthGoogle}.ts
// (puros, sin red); acá solo queda hablar con Supabase y con Google.

const PROVEEDOR = 'google'
const TABLA = 'integraciones_externas'
/** El callback hace `await` de esto antes de redirigir: un login lento es malo, uno colgado es peor. */
const LIMITE_GUARDADO_MS = 3_000
const LIMITE_REFRESCO_MS = 10_000
/** El access token de Google vive 1h; se guarda con margen para no apurar el borde. */
const VIDA_ACCESS_TOKEN_MS = 55 * 60_000

const contextoRefresh = (userId: string) => `${PROVEEDOR}:refresh:${userId}`
const contextoAccess = (userId: string) => `${PROVEEDOR}:access:${userId}`

/**
 * Guarda (o actualiza) la vinculación con Google tras un login OAuth.
 *
 * ⚠️ NUNCA LANZA Y NUNCA BLOQUEA EL LOGIN. Mismo criterio defensivo que
 * `resolverIcono` (lib/server/materias.ts) y `resolverCamposExamen`
 * (lib/server/examen.ts): si algo falla, se registra y se sigue. Un fallo acá
 * cuesta que el usuario tenga que volver a entrar para vincular Drive; una
 * excepción costaría que NO PUEDA ENTRAR — y este código vive dentro de
 * app/auth/callback/route.ts, que acaba de tener un bug de ruteo en producción.
 *
 * Se autorepara solo: app/login/page.tsx manda `prompt: 'consent'` en cada
 * login, así que el siguiente intento vuelve a traer un refresh token nuevo.
 *
 * Devuelve `void` a propósito: el llamador no tiene ninguna decisión que tomar
 * con el resultado.
 */
export async function guardarVinculacionGoogle(session: Session | null): Promise<void> {
  try {
    if (!session?.user) return

    // Solo Google. El magic link (/auth/confirm) no pasa por acá, pero si algún
    // día se añade otro proveedor OAuth, esto evita guardar su token como si
    // fuera de Drive. Se mira también `providers` porque un usuario con
    // identidades enlazadas puede tener `provider` en otro valor.
    const meta = session.user.app_metadata as { provider?: unknown; providers?: unknown } | undefined
    const proveedores = Array.isArray(meta?.providers) ? meta.providers : []
    const esGoogle = meta?.provider === PROVEEDOR || proveedores.includes(PROVEEDOR)
    if (!esGoogle) return

    const refreshToken = session.provider_refresh_token
    if (!refreshToken) {
      // No es un error por sí solo: Google solo devuelve refresh_token cuando se
      // pide con prompt=consent. Se registra porque si empieza a pasar SIEMPRE,
      // significa que alguien quitó los queryParams de app/login/page.tsx y esta
      // fase dejó de funcionar en silencio.
      console.warn('[integracionGoogle] login de Google sin provider_refresh_token — ¿se perdió prompt=consent?')
      return
    }

    const userId = session.user.id
    const claves = clavesCifrado()

    const tieneAccess = typeof session.provider_token === 'string' && session.provider_token.length > 0

    const fila = {
      user_id: userId,
      proveedor: PROVEEDOR,
      refresh_token_cifrado: cifrar(refreshToken, contextoRefresh(userId), claves),
      refresh_token_kid: claves[0].kid,
      // Se aprovecha el access token de este mismo canje (vale ~1h) para que la
      // primera operación de Drive no gaste un refresco.
      access_token_cifrado: tieneAccess ? cifrar(session.provider_token as string, contextoAccess(userId), claves) : null,
      access_token_expira_en: tieneAccess ? new Date(Date.now() + VIDA_ACCESS_TOKEN_MS).toISOString() : null,
      // `scope` queda sin tocar acá a propósito: el tipo `Session` de
      // @supabase/auth-js no expone el scope OAuth concedido en ningún campo —
      // verificado contra su .d.ts. Se autocompleta solo en el primer refresco
      // (interpretarRespuestaRefresco sí lee `scope` de la respuesta de
      // Google), no en la captura inicial. No es un bug, es lo único que hay
      // disponible en este punto sin gastar una llamada extra a Google dentro
      // del callback de login.
      cuenta_email: session.user.email ?? null,
      // Volver a vincular limpia cualquier estado de revocación previo.
      revocada_en: null,
      ultimo_error: null,
      updated_at: new Date().toISOString(),
    }

    // upsert y no insert: el usuario inicia sesión muchas veces. `onConflict`
    // usa el índice único (user_id, proveedor) de la migración, así que es
    // idempotente y sin carrera aunque entre en dos pestañas a la vez.
    const { error } = await supabaseServer
      .from(TABLA)
      .upsert(fila, { onConflict: 'user_id,proveedor' })
      .abortSignal(AbortSignal.timeout(LIMITE_GUARDADO_MS))

    if (error) console.error('[integracionGoogle] no se pudo guardar la vinculación:', error.message)
  } catch (error) {
    // Deliberado y total — ver el comentario de la cabecera.
    console.error('[integracionGoogle] excepción al guardar la vinculación:', error)
  }
}

export type AccessTokenGoogle =
  | { estado: 'ok'; accessToken: string; expiraEn: Date }
  /** No hay fila: nunca vinculó Drive (p. ej. entró por magic link). UI: "Conectar Drive". */
  | { estado: 'sin_vinculacion' }
  /** `invalid_grant`: el usuario revocó el acceso. UI: "Vuelve a conectar Drive". */
  | { estado: 'revocada'; detalle: string }
  /** Transitorio o de configuración. UI: "Problema temporal". NO se borra nada. */
  | { estado: 'error'; detalle: string }

type FilaIntegracion = {
  refresh_token_cifrado: string | null
  refresh_token_kid: string | null
  access_token_cifrado: string | null
  access_token_expira_en: string | null
  revocada_en: string | null
}

/**
 * Devuelve un access token de Google válido para `userId`, refrescándolo contra
 * `oauth2.googleapis.com` si hace falta. Sin intervención del usuario.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUÉ 4 ESTADOS Y NO 3
 * ───────────────────────────────────────────────────────────────────────────
 * `revocada` y `error` NO se pueden fusionar. Solo `invalid_grant` significa que
 * el usuario revocó de verdad; un `invalid_client` (client_secret mal puesto en
 * un entorno — el mismo tipo de fallo que ya costó un incidente con
 * GEMINI_API_KEY) marcaría, fusionados, a TODOS los usuarios como revocados y
 * borraría TODOS los refresh tokens en una tarde. Por el mismo motivo, un
 * ErrorCifrado (clave distinta en este entorno) mapea a `error`, JAMÁS a
 * `revocada`.
 */
export async function obtenerAccessTokenValido(userId: string): Promise<AccessTokenGoogle> {
  try {
    const { data, error } = await supabaseServer
      .from(TABLA)
      .select('refresh_token_cifrado, refresh_token_kid, access_token_cifrado, access_token_expira_en, revocada_en')
      .eq('user_id', userId)
      .eq('proveedor', PROVEEDOR)
      .maybeSingle<FilaIntegracion>()

    if (error) return { estado: 'error', detalle: `No se pudo leer la vinculación: ${error.message}` }
    if (!data) return { estado: 'sin_vinculacion' }
    if (data.revocada_en) return { estado: 'revocada', detalle: 'El acceso a Google Drive fue revocado' }
    if (!data.refresh_token_cifrado) return { estado: 'sin_vinculacion' }

    const claves = clavesCifrado()
    const ahora = Date.now()

    // 1) ¿Sirve el access token cacheado? Si falla el descifrado NO se aborta:
    //    es una caché desechable, se sigue al refresco.
    if (data.access_token_cifrado && !tokenVencido(data.access_token_expira_en, ahora)) {
      try {
        const accessToken = descifrar(data.access_token_cifrado, contextoAccess(userId), claves)
        return { estado: 'ok', accessToken, expiraEn: new Date(data.access_token_expira_en as string) }
      } catch (e) {
        console.warn('[integracionGoogle] access token cacheado ilegible, se refresca:', e instanceof Error ? e.message : e)
      }
    }

    // 2) Refrescar. Acá el descifrado SÍ es crítico.
    let refreshToken: string
    try {
      refreshToken = descifrar(data.refresh_token_cifrado, contextoRefresh(userId), claves)
    } catch (e) {
      const detalle = e instanceof ErrorCifrado ? `${e.codigo}: ${e.message}` : String(e)
      console.error('[integracionGoogle] no se pudo descifrar el refresh token:', detalle)
      // 'error', nunca 'revocada' — ver la cabecera. Esto es lo que impide que
      // una clave desactualizada en un entorno se lea como "todos revocaron".
      return { estado: 'error', detalle }
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      console.error('[integracionGoogle] CONFIGURACIÓN: faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET')
      return { estado: 'error', detalle: 'Faltan las credenciales de cliente de Google en este entorno' }
    }

    let estadoHttp: number
    let cuerpo: unknown
    try {
      const res = await fetch(URL_TOKEN_GOOGLE, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: construirCuerpoRefresco({ clientId, clientSecret, refreshToken }),
        signal: AbortSignal.timeout(LIMITE_REFRESCO_MS),
      })
      estadoHttp = res.status
      cuerpo = await res.json().catch(() => null)
    } catch (e) {
      return { estado: 'error', detalle: `No se pudo contactar con Google: ${e instanceof Error ? e.message : String(e)}` }
    }

    const resultado = interpretarRespuestaRefresco(estadoHttp, cuerpo, Date.now())

    if (!resultado.ok) {
      if (resultado.clase === 'revocado') {
        // Único camino que destruye el token. Se conserva la fila (con
        // revocada_en) para poder distinguir "nunca conectó" de "se cayó".
        await supabaseServer
          .from(TABLA)
          .update({
            revocada_en: new Date().toISOString(),
            refresh_token_cifrado: null,
            refresh_token_kid: null,
            access_token_cifrado: null,
            access_token_expira_en: null,
            ultimo_error: `${resultado.error}: ${resultado.descripcion ?? ''}`.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('proveedor', PROVEEDOR)
        return { estado: 'revocada', detalle: resultado.descripcion ?? resultado.error }
      }

      const detalle =
        resultado.clase === 'configuracion' ? `${resultado.error}: ${resultado.descripcion ?? ''}`.trim() : resultado.detalle
      if (resultado.clase === 'configuracion') {
        // Prefijo distinto a propósito: esto es un problema del despliegue, no
        // del usuario, y quien lea los logs debe poder separarlos de un vistazo.
        console.error('[integracionGoogle] CONFIGURACIÓN:', detalle)
      }
      await registrarUltimoError(userId, detalle)
      return { estado: 'error', detalle }
    }

    // 3) Éxito: guardar el access token nuevo. De paso, RE-CIFRADO OPORTUNISTA:
    //    si el sobre está en una generación de clave vieja, se re-cifra con la
    //    activa, así una rotación se completa sola sin script de migración.
    const expiraEn = new Date(resultado.expiraEnMs)
    const cambios: Record<string, unknown> = {
      access_token_cifrado: cifrar(resultado.accessToken, contextoAccess(userId), claves),
      access_token_expira_en: expiraEn.toISOString(),
      ultimo_refresco_en: new Date().toISOString(),
      ultimo_error: null,
      updated_at: new Date().toISOString(),
    }

    const tokenAGuardar = resultado.refreshTokenNuevo ?? refreshToken
    const kidActual = kidDelSobre(data.refresh_token_cifrado)
    if (resultado.refreshTokenNuevo || kidActual !== claves[0].kid) {
      cambios.refresh_token_cifrado = cifrar(tokenAGuardar, contextoRefresh(userId), claves)
      cambios.refresh_token_kid = claves[0].kid
    }
    if (resultado.scope) cambios.scope = resultado.scope

    const { error: errorUpdate } = await supabaseServer.from(TABLA).update(cambios).eq('user_id', userId).eq('proveedor', PROVEEDOR)
    // Que no se pueda cachear el token no invalida el token: se devuelve igual.
    if (errorUpdate) console.error('[integracionGoogle] no se pudo cachear el access token:', errorUpdate.message)

    return { estado: 'ok', accessToken: resultado.accessToken, expiraEn }
  } catch (error) {
    console.error('[integracionGoogle] excepción al obtener el access token:', error)
    return { estado: 'error', detalle: error instanceof Error ? error.message : String(error) }
  }
}

async function registrarUltimoError(userId: string, detalle: string): Promise<void> {
  const { error } = await supabaseServer
    .from(TABLA)
    .update({ ultimo_error: detalle, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('proveedor', PROVEEDOR)
  if (error) console.error('[integracionGoogle] no se pudo registrar ultimo_error:', error.message)
}
