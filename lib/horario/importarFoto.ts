import { apiPost } from '@/lib/api/cliente'
import { reducirImagen } from '@/lib/imagen'
import { subirArchivo } from '@/lib/storage'
import type { AgentResult } from '@/lib/ai/types'
import type { ClassScheduleAgentOutput } from '@/lib/ai/agents/classSchedule'
import type { DiffHorario } from './diff'

export type ImportarFotoResultado =
  | { ok: true; salida: ClassScheduleAgentOutput; diff: DiffHorario }
  | { ok: false; error: string }

// Sube la foto (ya reducida) a Storage y pide el análisis. Dos pasos y no
// uno con el archivo en el body a propósito: ver el comentario de
// app/api/ai/horario/route.ts sobre el peso de una foto de celular.
export async function importarHorarioDesdeFoto(archivo: File): Promise<ImportarFotoResultado> {
  let reducida: Blob
  try {
    reducida = await reducirImagen(archivo)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo procesar la imagen' }
  }

  const subida = await subirArchivo('horarios', reducida, 'jpg', 'image/jpeg')
  if (!subida.ok) return subida

  const respuesta = await apiPost<{ resultado: AgentResult<ClassScheduleAgentOutput>; diff: DiffHorario }>('/api/ai/horario', {
    ruta: subida.ruta,
  })
  if (!respuesta.ok) return { ok: false, error: respuesta.error }

  const { resultado, diff } = respuesta.data
  if (resultado.status !== 'success' || !resultado.output) {
    return { ok: false, error: resultado.error?.message ?? 'No se pudo leer el horario de la imagen' }
  }

  return { ok: true, salida: resultado.output, diff }
}
