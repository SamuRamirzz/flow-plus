import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { descargarArchivoStream, borrarArchivo } from '@/lib/server/googleDrive'
import { estadoHttpParaClase } from '@/lib/integraciones/googleDrive'
import { ok, errorJson } from '@/lib/server/respuestas'

// `params` es una Promise en esta versión de Next.js (App Router) — ver el
// mismo comentario en app/api/tareas/[id]/route.ts.
type Contexto = { params: Promise<{ id: string }> }

type FilaArchivo = {
  id: string
  nombre: string
  mime_type: string | null
  drive_file_id: string | null
}

/**
 * RFC 5987: `filename*` además de `filename` — un nombre con tildes se
 * corrompe sin el segundo.
 *
 * `inline` vs `attachment` (Fase 7): con `attachment` el navegador SIEMPRE
 * descarga, lo que impide previsualizar un PDF en un `<iframe>`/`<embed>`
 * directo. Con `?inline=1` se sirve como `inline` para que la UI de
 * Archivos pueda mostrar la vista previa sin bajar el archivo. El default
 * sigue siendo `attachment` — quien pide `?descargar=1` a secas quiere
 * descargar, y cambiarle el comportamiento habría roto ese contrato.
 */
function headerContentDisposition(nombre: string, inline: boolean): string {
  const ascii = nombre.replace(/[^\x20-\x7E]/g, '_')
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`
}

export async function GET(request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId
  const { id } = await params

  // `select('*')` desde Fase 7: la fila ganó las columnas de análisis
  // (resumen_ia, tipo_documento, tareas_detectadas, analizado_en,
  // analisis_error, ultima_apertura_en) y el panel de detalle las necesita
  // todas. Listarlas a mano solo garantizaba olvidarse de una al agregar la
  // siguiente.
  const { data, error } = await supabaseServer.from('archivos').select('*').eq('id', id).eq('user_id', userId).maybeSingle<FilaArchivo>()

  if (error) return errorJson(error.message, 500)
  if (!data) return errorJson('Archivo no encontrado', 404)

  const { searchParams } = new URL(request.url)
  const descargar = searchParams.get('descargar') === '1'
  const inline = searchParams.get('inline') === '1'

  // Registrar la apertura es best-effort y NUNCA bloquea la respuesta: es
  // metadata de conveniencia (la columna "Última apertura" de la tabla), no
  // un dato por el que valga la pena fallar una descarga.
  if (descargar || inline) {
    const { error: errorApertura } = await supabaseServer
      .from('archivos')
      .update({ ultima_apertura_en: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
    if (errorApertura) console.warn('[api/archivos/[id]] no se pudo registrar ultima_apertura_en:', errorApertura.message)
  }

  if (!descargar && !inline) {
    return ok({ archivo: data })
  }

  if (!data.drive_file_id) {
    return errorJson('Este archivo no tiene contenido en Drive todavía', 404)
  }

  const descarga = await descargarArchivoStream(userId, data.drive_file_id)
  if (!descarga.ok) return errorJson(`No se pudo descargar el archivo de Drive: ${descarga.detalle}`, estadoHttpParaClase(descarga.clase))

  return new Response(descarga.datos.cuerpo, {
    status: 200,
    headers: {
      'content-type': descarga.datos.mimeType ?? data.mime_type ?? 'application/octet-stream',
      'content-disposition': headerContentDisposition(data.nombre, inline),
    },
  })
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId
  const { id } = await params

  const { data, error } = await supabaseServer
    .from('archivos')
    .select('id, drive_file_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<{ id: string; drive_file_id: string | null }>()

  if (error) return errorJson(error.message, 500)
  if (!data) return errorJson('Archivo no encontrado', 404)

  // Orden Drive-primero, Postgres-después: si Drive tiene éxito pero el
  // DELETE de Postgres falla más abajo, un reintento de este mismo endpoint
  // es seguro (borrarArchivo trata un 404 de Drive como éxito). En el orden
  // inverso, un fallo de Drive dejaría el archivo huérfano ahí sin forma de
  // volver a alcanzarlo desde esta API (la fila ya no existiría).
  if (data.drive_file_id) {
    const borrado = await borrarArchivo(userId, data.drive_file_id)
    if (!borrado.ok) return errorJson(`No se pudo borrar el archivo de Drive: ${borrado.detalle}`, estadoHttpParaClase(borrado.clase))
  }

  const { data: fila, error: errorDelete } = await supabaseServer.from('archivos').delete().eq('id', id).eq('user_id', userId).select().maybeSingle()
  if (errorDelete) return errorJson(errorDelete.message, 500)

  return ok({ eliminado: true, archivo: fila })
}
