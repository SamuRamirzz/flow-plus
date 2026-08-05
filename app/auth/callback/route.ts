import { NextResponse, type NextRequest } from 'next/server'
import { clienteDeSesion } from '@/lib/server/sesion'
import { destinoSeguro } from '@/lib/onboarding/saludo'
import { RUTA_APP } from '@/lib/rutas'

// Sprint Auth / Fase 6 — donde aterriza el flujo OAuth de Google.
//
// `@supabase/ssr` usa PKCE por defecto, así que Google devuelve un `code` de un
// solo uso que hay que canjear por la sesión con `exchangeCodeForSession`. Ese
// canje escribe las cookies de sesión — y este es un Route Handler, uno de los
// pocos contextos donde Next SÍ permite escribir cookies (ver el try/catch de
// lib/server/sesion.ts para el caso contrario).
//
// Esta ruta está en RUTAS_PUBLICAS de proxy.ts: tiene que ser alcanzable sin
// sesión, porque su trabajo es precisamente crearla.
//
// ⚠️ La URL de esta ruta debe estar registrada como "Redirect URL" autorizada
// en el dashboard de Supabase (Authentication → URL Configuration), y el
// callback de Supabase (`https://<proyecto>.supabase.co/auth/v1/callback`) en
// los "Authorized redirect URIs" del cliente OAuth de Google Cloud Console.
// Son dos sitios distintos y se confunden con facilidad — ver
// docs/SPRINT-AUTH-configuracion.md.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  // Google devuelve `error`/`error_description` si el usuario canceló en la
  // pantalla de consentimiento. No es un fallo de la app — se le manda de
  // vuelta al login con el motivo, sin ruido de error 500.
  const errorProveedor = searchParams.get('error_description') ?? searchParams.get('error')
  if (errorProveedor) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorProveedor)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('No llegó el código de autorización')}`)
  }

  const supabase = await clienteDeSesion()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  // `volverA` es la ruta que el usuario intentaba ver cuando el proxy lo mandó
  // al login. Se valida que sea una ruta interna: sin esto, un `volverA` con
  // una URL absoluta sería un open redirect (mandar al usuario a un dominio
  // ajeno justo después de autenticarse, que es el peor momento posible).
  // La validación vive en `destinoSeguro` desde el Sprint Onboarding — antes
  // estaba duplicada acá y en /auth/confirm, y una regla de seguridad
  // copiada en dos sitios es una que tarde o temprano se arregla en uno solo.
  const destino = destinoSeguro(searchParams.get('volverA'))

  // Sprint Onboarding — no se va directo al destino: se pasa por
  // /bienvenida, que decide contra la base si toca el saludo de "primera
  // vez" (y el carrusel) o el de "de vuelta". Esa decisión NO se toma acá a
  // propósito: este handler ya tiene bastante con canjear el código, y
  // mandarla por la URL la volvería falsificable.
  const bienvenida = new URL('/bienvenida', origin)
  if (destino !== RUTA_APP) bienvenida.searchParams.set('volverA', destino)

  return NextResponse.redirect(bienvenida)
}
