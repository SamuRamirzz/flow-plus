import { NextResponse, type NextRequest } from 'next/server'
import { clienteDeSesion } from '@/lib/server/sesion'
import { destinoSeguro } from '@/lib/onboarding/saludo'
import { RUTA_APP } from '@/lib/rutas'

// Sprint Auth — confirmación del magic link de email.
//
// ⚠️ REESCRITO — la primera versión asumía `?token_hash=&type=` (lo que dice
// la guía genérica de Supabase para SSR) y JAMÁS funcionó contra este
// proyecto. Diagnosticado con evidencia real, no otra suposición de
// configuración:
//
// 1. `admin.generateLink({type:'magiclink'})` contra el proyecto real
//    devuelve un `action_link` que apunta a
//    `https://<proyecto>.supabase.co/auth/v1/verify?token=...&redirect_to=...`
//    — es decir, la plantilla de email SIGUE siendo la de por defecto
//    (`{{ .ConfirmationURL }}`). Todo magic link pasa PRIMERO por el propio
//    `/verify` de Supabase; esta ruta nunca recibe `token_hash`/`type`
//    directamente (eso solo pasaría si la plantilla se customizara para
//    apuntar acá de una, cosa que no se hizo).
// 2. Siguiendo ese `action_link` real con `redirect: 'manual'`, Supabase
//    devuelve un 303 con la sesión completa en el FRAGMENTO de la URL
//    (`#access_token=...&refresh_token=...`) — pero esa prueba usó el admin
//    API, que no pasa por el registro PKCE que sí usa el navegador real.
// 3. `select * from auth.flow_state` en la base real mostró filas YA
//    existentes (intentos reales previos del usuario) con
//    `authentication_method:'magiclink'` y `code_challenge` poblado — prueba
//    directa de que el flujo real (`signInWithOtp` desde `app/login/page.tsx`,
//    con `flowType:'pkce'` en `lib/supabase.ts`) SÍ registra PKCE. Eso
//    significa que el `/verify` de Supabase, para un click real, redirige acá
//    con `?code=...` — el mismo mecanismo que ya usa
//    app/auth/callback/route.ts para Google, no con `token_hash` ni con el
//    fragmento de la prueba #2 (que solo ocurre cuando NO hay PKCE
//    registrado, algo que este proyecto no hace para el flujo real).
//
// Por eso esta ruta ahora sigue el mismo patrón que app/auth/callback —
// `exchangeCodeForSession(code)` — en vez de `verifyOtp`.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const destino = destinoSeguro(searchParams.get('volverA'))

  if (code) {
    const supabase = await clienteDeSesion()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Sprint Onboarding — mismo desvío que /auth/callback: /bienvenida
      // decide contra la base si toca el saludo de primera vez o el de
      // vuelta. Los dos caminos de entrada (Google y magic link) tienen que
      // pasar por ahí o el saludo solo aparecería en uno.
      const bienvenida = new URL('/bienvenida', origin)
      if (destino !== RUTA_APP) bienvenida.searchParams.set('volverA', destino)
      return NextResponse.redirect(bienvenida)
    }
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('El enlace no es válido o ya expiró. Pide uno nuevo.')}`)
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('El enlace de acceso no es válido.')}`)
}
