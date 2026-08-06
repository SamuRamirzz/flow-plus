import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { ok, errorJson } from '@/lib/server/respuestas'

// Sprint Archivos / Fase 7 — alimenta la franja "Actividad de IA reciente".
//
// Fuente: la tabla `archivos` (columna `analizado_en`), NO `ai_events`.
// `ai_events` registra ejecuciones de agentes con un payload genérico y sin
// ninguna relación con filas de `archivos` — serviría para depurar el
// pipeline de IA, no para contarle al usuario qué hizo la IA con SUS
// archivos. La consulta va contra el índice parcial
// `archivos_user_analizado_idx` creado en 20260809000400.

const LIMITE = 12

type FilaActividad = {
  id: string
  nombre: string
  mime_type: string | null
  tipo_documento: string | null
  resumen_ia: string | null
  tareas_detectadas: unknown
  analizado_en: string
  materia_id: string | null
}

export async function GET() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  const { data, error } = await supabaseServer
    .from('archivos')
    .select('id, nombre, mime_type, tipo_documento, resumen_ia, tareas_detectadas, analizado_en, materia_id')
    .eq('user_id', auth.userId)
    .not('analizado_en', 'is', null)
    .order('analizado_en', { ascending: false })
    .limit(LIMITE)
    .returns<FilaActividad[]>()

  if (error) return errorJson(error.message, 500)

  // La UI necesita una etiqueta corta por tarjeta ("3 tareas detectadas",
  // "Resumen disponible"). Se deriva ACÁ y no en el cliente para que sea una
  // sola fuente de verdad: son las mismas etiquetas que la columna "IA" de
  // la tabla de archivos tiene que mostrar.
  const actividad = (data ?? []).map((a) => {
    const nTareas = Array.isArray(a.tareas_detectadas) ? a.tareas_detectadas.length : 0
    const etiqueta =
      nTareas > 0
        ? `${nTareas} ${nTareas === 1 ? 'tarea detectada' : 'tareas detectadas'}`
        : a.tipo_documento === 'examen'
          ? 'Examen encontrado'
          : a.tipo_documento === 'horario'
            ? 'Horario analizado'
            : a.resumen_ia
              ? 'Resumen disponible'
              : 'Texto analizado'

    return {
      archivoId: a.id,
      nombre: a.nombre,
      mimeType: a.mime_type,
      materiaId: a.materia_id,
      tipoDocumento: a.tipo_documento,
      resumen: a.resumen_ia,
      tareasDetectadas: nTareas,
      etiqueta,
      analizadoEn: a.analizado_en,
    }
  })

  return ok({ actividad })
}
