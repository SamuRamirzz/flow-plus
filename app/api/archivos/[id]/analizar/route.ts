import { requerirUsuario } from '@/lib/server/usuario'
import { consumirLimite } from '@/lib/server/limites'
import { analizarArchivo } from '@/lib/server/analisisArchivo'
import { ok, errorJson } from '@/lib/server/respuestas'

// Sprint Archivos / Fase 7.
//
// Endpoint SEPARADO de `POST /api/archivos` (la subida) a propósito, no por
// comodidad:
//   · La subida ya tarda segundos (staging → Drive); sumarle una llamada de
//     visión a Gemini la volvería notablemente más lenta para algo que el
//     usuario no está esperando en ese instante.
//   · Es reintentable por sí solo: si el análisis falla (red, cuota, modelo),
//     el archivo YA está sano en Drive y solo hace falta volver a llamar acá.
//   · Le da a la UI un estado "Analizando…" real y propio, en vez de un
//     spinner de subida que dura el doble sin explicación.
// Fire-and-forget dentro de la subida NO era opción: en serverless una
// promesa no esperada puede descartarse al devolver la respuesta (mismo
// motivo ya documentado en lib/server/integracionGoogle.ts).

type Contexto = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const { id } = await params

  // Tope de uso (auditoría 2026-08-22): analizar un documento manda su
  // contenido entero a Gemini, de lo más caro por llamada del proyecto.
  const limite = await consumirLimite(auth.userId, 'ia_archivo')
  if (limite) return limite

  const resultado = await analizarArchivo(auth.userId, id)

  if (!resultado.ok) {
    // 422 y no 500 cuando no es reintentable: el formato no se puede
    // analizar (un .docx, un archivo enorme) es una respuesta legítima
    // sobre el CONTENIDO, no un fallo del servidor. La UI las distingue
    // para poder ofrecer "reintentar" solo cuando tiene sentido.
    return errorJson(resultado.motivo, resultado.reintentable ? 503 : 422)
  }

  return ok({ analisis: { resumen: resultado.resumen, tipoDocumento: resultado.tipoDocumento, tareas: resultado.tareas } })
}
