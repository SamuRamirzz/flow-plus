import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Cliente de Supabase ATADO A LA SESIÓN del request actual (Sprint Auth).
//
// Es distinto de los otros dos clientes del proyecto, y los tres coexisten a
// propósito:
//   · lib/supabase.ts        → navegador, clave anónima, sesión en cookies.
//   · lib/server/sesion.ts   → ESTE. Servidor, clave anónima, lee la cookie de
//                              sesión del request. Sirve para saber QUIÉN pide.
//   · lib/server/supabaseServer.ts → servidor, service_role, SALTA RLS. Sirve
//                              para operar sobre datos ya autorizados, y para
//                              el cron (que legítimamente cruza usuarios).
//
// ⚠️ NUNCA compartir un cliente de estos entre requests: lleva la sesión de
// UNA persona. Se crea uno nuevo en cada llamada, a propósito — la propia
// documentación de @supabase/ssr lo exige ("Always create a new client with
// this function for each server render — never share a client across
// requests").
export async function clienteDeSesion(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // En un Route Handler o Server Component, `cookies()` puede ser de solo
      // lectura: Next lanza si se intenta escribir fuera de una Server Action
      // o un Route Handler. El try/catch es el patrón que documenta Supabase
      // para ese caso — quien refresca de verdad el token es `proxy.ts`, que
      // sí puede escribir en la respuesta, así que perder una escritura acá
      // no deja la sesión obsoleta.
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Sin efecto: el refresco real lo hace el proxy.
        }
      },
    },
  })
}
