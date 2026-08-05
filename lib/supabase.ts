import { createBrowserClient } from '@supabase/ssr'

// Cliente del NAVEGADOR.
//
// Sprint Auth — pasa de `createClient` (@supabase/supabase-js) a
// `createBrowserClient` (@supabase/ssr). No es cosmético: el `createClient`
// normal guarda la sesión en localStorage, donde el servidor no la puede ver.
// `createBrowserClient` la guarda en COOKIES, que es lo que permite que
// `proxy.ts` y los Route Handlers lean la misma sesión que tiene el navegador.
// Sin este cambio, el usuario estaría "conectado" en el cliente y anónimo en
// el servidor.
//
// La firma pública no cambia (`export const supabase`), así que los 5 puntos
// que lo importan (lib/tasks.ts, lib/horario/cargar.ts, lib/storage.ts,
// app/ai/page.tsx) siguen igual.
//
// Sigue usando NEXT_PUBLIC_SUPABASE_ANON_KEY: verificado contra la
// documentación de Supabase que la clave `anon` heredada sigue siendo válida
// (la nueva `publishable` es el mismo tipo de clave con otro nombre, y las
// heredadas "keep working" hasta su deprecación a fines de 2026). Cuando se
// migre, es cambiar el valor de esta variable, nada más.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
