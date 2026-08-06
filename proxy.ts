import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Sprint Auth / Fase 5 — refresco de sesión + puerta de las páginas.
//
// ⚠️ SE LLAMA `proxy.ts`, NO `middleware.ts`. No es una preferencia: en Next 16
// el convenio `middleware` está deprecado y renombrado a `proxy` (verificado
// contra los docs empaquetados en node_modules/next/dist/docs/ — el archivo
// `middleware.md` ya no existe, y proxy.md dice textualmente "The `middleware`
// file convention is deprecated and has been renamed to `proxy`").
//
// Corre en el runtime de Node.js por defecto desde v16.0.0, y la opción
// `runtime` NO está disponible acá (ponerla lanza error) — así que el SDK de
// servidor de Supabase corre sin las restricciones del runtime Edge.
//
// ───────────────────────────────────────────────────────────────────────────
// LAS DOS RESPONSABILIDADES, y por qué el orden importa
// ───────────────────────────────────────────────────────────────────────────
// 1. REFRESCAR el token. Es la razón principal de que este archivo exista,
//    incluso más que la redirección: la documentación de @supabase/ssr advierte
//    que sin un middleware que escriba las cookies refrescadas, aparecen
//    "random logouts, early session termination... increased refresh token
//    requests". El token refrescado se escribe en DOS sitios (ambos, no uno):
//    en `request.cookies` para que los Server Components de este mismo render
//    ya vean el token nuevo, y en `response.cookies` para que el navegador se
//    quede con él.
// 2. REDIRIGIR a /login si no hay sesión.
//
// ───────────────────────────────────────────────────────────────────────────
// DECISIÓN: las rutas /api NO se protegen acá
// ───────────────────────────────────────────────────────────────────────────
// El encargo pedía evaluarlo y documentarlo. Se protegen en cada Route Handler
// vía `requerirUsuario()` (Fase 4), no en el proxy, por tres razones:
//
//   a) Los propios docs de Next lo exigen: "Always verify authentication and
//      authorization inside each Server Function rather than relying on Proxy
//      alone" — y explican por qué: un cambio de `matcher` o mover una función
//      a otra ruta "can silently remove Proxy coverage". Un 401 que depende de
//      una expresión regular es un 401 frágil.
//   b) Un handler necesita el `userId` de todos modos para filtrar sus
//      consultas. `requerirUsuario()` lo devuelve y lo valida en el mismo paso,
//      así que la verificación no es trabajo extra: es el trabajo.
//   c) Una API debe responder 401 con JSON, no redirigir a una pantalla HTML.
//      Un cliente `fetch` no sabe qué hacer con un 307 a /login.
//
// El proxy igual atraviesa /api (para refrescar el token), pero no bloquea:
// esa decisión es del handler.
//
// El cron (`/api/cron/*`) usa su propio guard `Bearer $CRON_SECRET` y no tiene
// sesión de usuario — otra razón para no bloquear /api acá, o el cron dejaría
// de funcionar.

// Rutas que deben ser accesibles SIN sesión. Sin esto se crea un bucle de
// redirección: /login redirige a /login redirige a /login...
// `/auth/confirm`: confirmación del magic link de email (Sprint Auth, ajuste
// por retirar el teléfono del alcance) — mismo criterio que /auth/callback.
// `/legal`: Términos de Servicio y Política de Privacidad — Google Cloud
// Console exige URLs públicas y accesibles sin sesión para poder publicar
// la app fuera de modo Testing; además cualquier visitante (con cuenta o
// sin ella) tiene que poder leerlas.
const RUTAS_PUBLICAS = ['/login', '/auth/callback', '/auth/confirm', '/legal']

// Modo invitado — /agenda y /horario funcionan sin sesión (datos en
// localStorage, ver lib/invitado/). El resto de la app (Home, /ai,
// Ajustes) sigue exigiendo sesión real: son las únicas dos pantallas cuyas
// mutaciones ya son "isomórficas" (lib/tasks.ts, lib/horario/mutar.ts
// resuelven solos si van a Supabase o a localStorage). Esta lista NO
// reemplaza esa guarda — solo evita el redirect a /login; la decisión real
// de qué camino de datos usar sigue viviendo en cada función.
const RUTAS_INVITADO = ['/agenda', '/horario']

function esRutaInvitado(pathname: string): boolean {
  return RUTAS_INVITADO.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))
}

function esRutaPublica(pathname: string): boolean {
  // Sprint Landing — `/` deja de estar protegida. No es que se abra la app a
  // cualquiera: `app/page.tsx` es un Server Component que decide, con la
  // sesión en la mano, si renderiza la landing pública o la agenda. Sin esta
  // excepción el proxy mandaría a /login a todo visitante anónimo y la
  // landing sería inalcanzable — que es justo lo contrario de lo que se
  // quiere de la página que recibe el tráfico externo.
  if (pathname === '/') return true
  return RUTAS_PUBLICAS.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))
}

// `/api/*` atraviesa el proxy (para que el token se refresque) pero NUNCA se
// redirige — cada Route Handler responde su propio 401 JSON vía
// `requerirUsuario()`.
//
// Esta función existe porque la primera versión de este archivo NO la tenía: el
// comentario de arriba declaraba la decisión, pero el código caía en la rama de
// redirección igual, y las rutas de API devolvían el HTML del login con un 200
// (tras seguir el 307) en vez de un 401. Un `fetch` no sabe qué hacer con eso.
// Peor: el cron quedaba inalcanzable, porque se lo tragaba el redirect antes de
// llegar a su propio guard de CRON_SECRET. Encontrado probando las 3 rutas de
// verdad en el navegador, no leyendo el archivo.
function esRutaDeApi(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // Los dos destinos, como exige la guía de Supabase: el request (para
        // este render) y la response (para el navegador).
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // getClaims() y no getSession(): la propia documentación dice "Never trust
  // supabase.auth.getSession() inside server code such as Proxy. It isn't
  // guaranteed to revalidate the Auth token". getClaims() verifica la firma del
  // JWT contra las llaves públicas del proyecto, y de paso dispara el refresco
  // que es el punto 1 de arriba.
  //
  // ⚠️ `haySesionCookie` (ANTES de llamar a getClaims) es lo que distingue
  // "nunca inició sesión" de "tenía sesión y se perdió" — la segunda es un
  // fallo real que vale la pena contarle al usuario (ver el query param
  // `motivo` más abajo), la primera es un visitante anónimo normal, sin nada
  // que avisar.
  const haySesionCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

  const { data } = await supabase.auth.getClaims()
  const haySesion = typeof data?.claims?.sub === 'string'

  const { pathname } = request.nextUrl

  // Sin sesión en una ruta de PÁGINA protegida → al login, recordando a dónde
  // iba para devolverlo ahí después de entrar. Las rutas de API se excluyen a
  // propósito: responden 401 JSON por su cuenta (ver esRutaDeApi).
  if (!haySesion && !esRutaPublica(pathname) && !esRutaDeApi(pathname) && !esRutaInvitado(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('volverA', pathname)
    // Sprint Home / Parte 4 — solo si HABÍA una cookie de sesión que falló
    // (no en un primer visitante anónimo): /login la lee y avisa con un
    // toast, en vez de dejar al usuario sin ninguna explicación de por qué
    // de repente está viendo la pantalla de login.
    if (haySesionCookie) url.searchParams.set('motivo', 'sesion_perdida')
    return redirigirConCookies(url, response)
  }

  // Con sesión en /login no tiene sentido quedarse ahí.
  //
  // 🐛 Bug real (2026-08-05): esto mandaba a `/` (la landing pública), no a
  // la app. Eso convertía cualquier llegada accidental a /login CON sesión
  // —incluido el bucle real reportado: /bienvenida no ve la sesión todavía
  // (por el motivo que sea) y redirige a /login, que un instante después SÍ
  // la ve— en un callejón sin salida: el usuario quedaba varado en la
  // landing, con la sesión ya reconocida (el botón decía "Ir a mi agenda")
  // pero SIN pasar nunca por /bienvenida, así que ni el saludo ni el gate de
  // onboarding/completar-perfil se disparaban — tenía que hacer clic manual.
  // Redirigir a /bienvenida en vez de `/` cierra ese agujero: es el MISMO
  // punto de decisión que ya usa un login fresco (ver app/auth/callback),
  // así que cualquier camino que termine en "sesión + /login" se resuelve
  // igual (saltar directo si ya completó todo, mostrar el saludo/onboarding
  // si no). No hay riesgo de bucle infinito: si /bienvenida vuelve a no ver
  // la sesión y rebota a /login, este mismo redirect ya refrescó las
  // cookies (`redirigirConCookies` copia lo que `getClaims()` haya
  // renovado), así que cada vuelta deja el estado más consistente, no menos.
  if (haySesion && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/bienvenida'
    url.search = ''
    return redirigirConCookies(url, response)
  }

  return response
}

// Sprint Home / Parte 3 — bug real de persistencia de sesión, encontrado
// leyendo el código, no adivinado: `NextResponse.redirect(url)` construye una
// respuesta COMPLETAMENTE NUEVA. Las dos ramas de arriba que redirigen creaban
// esa respuesta nueva y la devolvían directo — sin copiarle las cookies
// refrescadas que `supabase.auth.getClaims()` acababa de escribir en
// `response` (vía el `setAll` de arriba). El comentario de este mismo archivo
// ya citaba la consecuencia exacta ("random logouts, early session
// termination") sin que el código de verdad la evitara en la rama de
// redirect.
//
// Cuándo importa de verdad: alguien con una sesión válida-pero-con-el-access-
// token-vencido visita una ruta que redirige (ej. entra a /login teniendo ya
// sesión, o —con refresh token rotation activa, confirmada en
// supabase/config.toml— cualquier momento en que el refresco ocurre justo en
// un request que termina en redirect). El refresh token NUEVO nunca llegaba
// al navegador; el navegador se quedaba con el viejo, que la rotación ya
// había invalidado. La próxima vez que hiciera falta refrescar (ocurre
// naturalmente pasado `jwt_expiry` — 1 hora por defecto — que es exactamente
// la escala de tiempo de "cerré el navegador y lo volví a abrir más tarde"), el
// refresco fallaba con un token ya usado, y la sesión se perdía sin que el
// usuario hubiera cerrado sesión nunca.
//
// El fix: toda redirección se construye copiando las cookies YA escritas en
// `response` (si `getClaims()` refrescó algo en este mismo request, están
// ahí) antes de devolverla.
function redirigirConCookies(destino: URL, response: NextResponse): NextResponse {
  const redireccion = NextResponse.redirect(destino)
  response.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie))
  return redireccion
}

export const config = {
  // Sin `matcher`, el proxy corre en CADA petición, incluidos los estáticos y
  // las imágenes — los propios docs advierten que eso puede "unintentionally
  // block CSS, JS, or images from loading". Se excluyen:
  //   · _next/static y _next/image — assets generados
  //   · favicon y archivos con extensión de imagen
  // `/api` NO se excluye a propósito: tiene que pasar para que el token se
  // refresque, pero el proxy no lo bloquea (ver la decisión de arriba).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
