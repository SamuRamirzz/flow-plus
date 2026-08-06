// Verificación de propiedad de una ruta de Supabase Storage.
//
// `supabaseServer` usa la service_role key y SALTA las políticas RLS de
// Storage (propietario_horarios_*, propietario_tareas_*, propietario_archivos_staging_*)
// — esas políticas solo protegen el camino del navegador con la clave
// anónima. Cualquier Route Handler que reciba una `ruta` del cliente y la
// use con `supabaseServer.storage.*` DEBE llamar esto ANTES de tocar el
// archivo: sin esto, cualquier sesión válida podría leer/procesar el
// archivo de otro usuario adivinando o conociendo su ruta (IDOR).
//
// Convención de ruta en todo el proyecto: `<user_id>/<resto>`
// (lib/storage.ts, subirArchivo) — el primer segmento identifica al dueño.
//
// El `..` se rechaza siempre, no solo cuando el schema de turno ya lo hacía
// (analizarHorarioSchema sí lo excluía; los adjuntos de /api/ai/tareas NO
// tenían ningún control de formato). El almacenamiento real (compatible
// S3) trata las claves como strings opacos, no como rutas de filesystem, así
// que `..` no es un vector de traversal conocido contra Supabase Storage —
// pero rechazarlo igual es gratis y cierra cualquier ambigüedad de una vez
// para las tres rutas que llaman a esta función.
export function esRutaDelUsuario(ruta: string, userId: string): boolean {
  if (ruta.includes('..')) return false
  return ruta.startsWith(`${userId}/`)
}
