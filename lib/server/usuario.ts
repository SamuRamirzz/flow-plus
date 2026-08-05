import { clienteDeSesion } from './sesion'
import { errorNoAutenticado } from './respuestas'

// Identidad del usuario — ÚNICA costura de autenticación del lado del servidor.
//
// Sprint Auth: `getUserId()` dejó de devolver la constante `USUARIO_SIN_AUTH` y
// ahora lee la sesión real. La constante se eliminó por completo: mientras
// existiera, cualquier código nuevo podía importarla "temporalmente" y volver a
// abrir el agujero.
//
// El diseño desde el Sprint 5 era que este archivo fuera lo único que cambiara,
// y se cumplió casi del todo: los 11 puntos que llaman acá solo tuvieron que
// añadir `await`. La excepción es `lib/storage.ts`, que corre en el NAVEGADOR y
// nunca pudo usar esta función (ver el comentario allá).
//
// ⚠️ ES ASÍNCRONA, y no es opcional: `cookies()` de next/headers es async en
// esta versión de Next, y `getClaims()` también.

export class ErrorNoAutenticado extends Error {
  readonly codigo = 'NO_AUTENTICADO'
  constructor() {
    super('No hay sesión activa')
    this.name = 'ErrorNoAutenticado'
  }
}

// Devuelve el uuid del usuario autenticado, o LANZA. Que lance (en vez de
// devolver null) es deliberado: obliga a cada Route Handler a decidir qué
// responder sin sesión, y hace imposible el bug de "userId undefined" colándose
// hasta un `.eq('user_id', undefined)` que devolvería datos de nadie... o de
// todos.
//
// Usa `getClaims()`, NO `getSession()` ni `getUser()`:
//   · `getSession()` — la documentación de Supabase es explícita: "Never trust
//     supabase.auth.getSession() inside server code". Lee la cookie sin
//     revalidarla, y una cookie se puede falsificar.
//   · `getUser()` — seguro, pero va a la red en cada llamada.
//   · `getClaims()` — verifica la firma del JWT contra las llaves públicas
//     publicadas del proyecto (cacheadas), así que es seguro Y local. Es el
//     que la propia guía de SSR recomienda para proteger datos.
export async function getUserId(): Promise<string> {
  const supabase = await clienteDeSesion()
  const { data, error } = await supabase.auth.getClaims()

  const sub = data?.claims?.sub
  if (error || typeof sub !== 'string' || sub.length === 0) {
    throw new ErrorNoAutenticado()
  }
  return sub
}

// Variante que no lanza, para los pocos sitios donde "sin sesión" es un estado
// normal y no un error (ej. decidir si mostrar el botón de login). No usar en
// una consulta de datos: ahí se quiere que lance.
export async function getUserIdOpcional(): Promise<string | null> {
  try {
    return await getUserId()
  } catch {
    return null
  }
}

// Puerta de entrada estándar de un Route Handler. Devuelve una unión
// discriminada en vez de lanzar, para que cada handler use el mismo patrón de
// 2 líneas sin repetir un try/catch:
//
//   const auth = await requerirUsuario()
//   if (!auth.ok) return auth.respuesta
//   ... auth.userId
//
// Por qué acá y no un middleware que inyecte el usuario: los docs de Next son
// explícitos en que `proxy.ts` NO alcanza como única defensa ("Always verify
// authentication and authorization inside each Server Function rather than
// relying on Proxy alone"). Este helper es esa verificación por handler, y
// además hace que el 401 sea imposible de olvidar: sin llamarlo no se tiene
// `userId`, y sin `userId` no hay consulta.
export async function requerirUsuario(): Promise<{ ok: true; userId: string } | { ok: false; respuesta: Response }> {
  try {
    return { ok: true, userId: await getUserId() }
  } catch {
    return { ok: false, respuesta: errorNoAutenticado() }
  }
}
