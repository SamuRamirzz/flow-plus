import { supabase } from './supabase'

export type ArchivoSubido = { ok: true; ruta: string } | { ok: false; error: string }

// Sprint 8 tenía esto en línea dentro de lib/horario/importarFoto.ts;
// Sub-sprint 7.3 lo necesita también para adjuntos de tareas — se extrae
// acá para que ningún flujo de subida reimplemente el esquema de ruta.
//
// ─────────────────────────────────────────────────────────────────────────
// SEGUNDA COSTURA DE IDENTIDAD (Sprint Auth)
// ─────────────────────────────────────────────────────────────────────────
// Este archivo era el único punto que IGNORABA `getUserId()`: importaba la
// constante `USUARIO_SIN_AUTH` directamente. No era descuido — corre en el
// NAVEGADOR, y `getUserId()` es server-only (usa `cookies()` de next/headers).
// El comentario de `lib/server/usuario.ts` que decía "este archivo es lo único
// que cambia cuando llegue auth" era, por esto, incompleto.
//
// La solución no es reusar el helper de servidor, es pedirle el usuario al
// cliente del navegador — que desde este sprint comparte la sesión por cookies
// con el servidor (ver lib/supabase.ts).
//
// `<user_id>/<timestamp>-<aleatorio>.<extension>`: ese primer segmento ahora SÍ
// significa algo. Las políticas de Storage de la migración 20260804000000 lo
// comparan contra `auth.uid()` — subir con el uuid de otro es imposible, y leer
// lo de otro también. Hasta este sprint las políticas solo miraban el bucket,
// así que el prefijo era decorativo (hallazgo de la Fase 0).
export async function subirArchivo(bucket: string, blob: Blob, extension: string, contentType: string): Promise<ArchivoSubido> {
  // getClaims() y no getUser(): igual criterio que en el servidor — verifica la
  // firma del JWT localmente en vez de ir a la red en cada subida.
  const { data, error: errorSesion } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  if (errorSesion || typeof userId !== 'string' || userId.length === 0) {
    // Mensaje en español y accionable: si la sesión venció a mitad de una
    // sesión de trabajo, el usuario necesita saber que tiene que volver a
    // entrar, no ver "error desconocido".
    return { ok: false, error: 'Tu sesión expiró — vuelve a iniciar sesión para subir archivos.' }
  }

  const ruta = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(ruta, blob, { contentType, upsert: false })
  if (error) return { ok: false, error: `No se pudo subir el archivo: ${error.message}` }
  return { ok: true, ruta }
}
