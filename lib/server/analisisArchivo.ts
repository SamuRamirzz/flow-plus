import { aiOrchestrator } from '@/lib/ai'
import { bootstrapAI } from '@/lib/ai/bootstrap'
import { createId } from '@/lib/ai/utils'
import { ANALISIS_ARCHIVO_AGENT_ID, type AnalisisArchivoAgentOutput } from '@/lib/ai/agents/analisisArchivo'
import type { AdjuntoIA } from '@/lib/ai/providers/gemini'
import { supabaseServer } from './supabaseServer'
import { descargarArchivoStream } from './googleDrive'

// Sprint Archivos / Fase 7 — la costura con I/O del análisis de archivos:
// baja el contenido real desde Drive, se lo pasa al agente, y persiste el
// resultado como metadata del archivo. La decisión de QUÉ significa cada
// resultado vive en el agente (lib/ai/agents/analisisArchivo/), acá solo
// queda el I/O.

/** Tope de intentos — mismo criterio que `conversaciones_ia.resumen_intentos`. */
const MAX_INTENTOS = 3

// Gemini cobra por token de entrada y tiene límites de request. El bucket de
// staging permite hasta 50MB, pero mandar un PDF de 40MB a analizar es caro
// y probablemente falle igual. Se corta antes, con un motivo legible en vez
// de un error críptico del proveedor.
const MAX_BYTES_ANALISIS = 15 * 1024 * 1024

const MIME_IMAGEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MIME_TEXTO = ['text/plain', 'text/markdown', 'text/csv']
const MIME_PDF = 'application/pdf'

// Office (Word/PowerPoint/Excel) — verificado contra Gemini real, no
// asumido: se probaron los 3 formatos (un PPTX real ya subido por el
// usuario, y un DOCX/XLSX generados para la prueba) enviados como
// `type:'document'`, exactamente el mismo camino binario que ya usa PDF.
// Gemini 3.5 Flash-Lite los lee de forma NATIVA — resumen correcto, fechas
// correctas, tabla de un XLSX correctamente entendida — sin ningún paso de
// extracción de texto de por medio.
//
// Esto contradice la suposición de que "son ZIPs de XML, el modelo no los
// lee como texto" que este mismo archivo tenía documentada — era cierta
// para un parser de texto ingenuo, pero el modelo multimodal no necesita
// texto plano: lee el binario directamente, igual que ya hace con PDF. Por
// eso NO se agregó ninguna librería de extracción (`mammoth`, `xlsx`, un
// parser de pptx): habría sido una dependencia nueva para resolver un
// problema que no existe.
const MIME_WORD = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const MIME_POWERPOINT = ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
const MIME_EXCEL = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']

export type ResultadoAnalisis =
  | { ok: true; resumen: string | null; tipoDocumento: string; tareas: unknown[] }
  | { ok: false; motivo: string; reintentable: boolean }

type FilaArchivoAnalisis = {
  id: string
  nombre: string
  mime_type: string | null
  tamano_bytes: number | null
  drive_file_id: string | null
  analisis_intentos: number
}

/**
 * PURA. ¿Este tipo de archivo se puede analizar, y cómo hay que mandárselo
 * al modelo? Separada del I/O para poder probar la política de formatos sin
 * red — es la parte con criterio real, el resto es fontanería.
 *
 * Word/PowerPoint/Excel van por la misma vía `'documento'` que PDF —
 * verificado contra Gemini real que lo lee nativamente (ver el comentario
 * de las constantes MIME_WORD/POWERPOINT/EXCEL arriba). `.zip` y otros
 * binarios sin verificar quedan fuera: no se agrega un formato a esta
 * función sin haberlo probado contra el modelo real primero.
 */
export function politicaDeAnalisis(mimeType: string | null, tamanoBytes: number | null): { analizable: false; motivo: string } | { analizable: true; via: 'imagen' | 'documento' | 'texto' } {
  if (tamanoBytes !== null && tamanoBytes > MAX_BYTES_ANALISIS) {
    return { analizable: false, motivo: `El archivo supera el límite de ${Math.round(MAX_BYTES_ANALISIS / 1024 / 1024)} MB para análisis automático` }
  }
  if (!mimeType) return { analizable: false, motivo: 'El archivo no tiene un tipo reconocible' }
  if (MIME_IMAGEN.includes(mimeType)) return { analizable: true, via: 'imagen' }
  if (mimeType === MIME_PDF) return { analizable: true, via: 'documento' }
  if (MIME_WORD.includes(mimeType) || MIME_POWERPOINT.includes(mimeType) || MIME_EXCEL.includes(mimeType)) return { analizable: true, via: 'documento' }
  if (MIME_TEXTO.includes(mimeType)) return { analizable: true, via: 'texto' }
  return { analizable: false, motivo: `El formato ${mimeType} todavía no se puede analizar automáticamente` }
}

async function registrarFallo(archivoId: string, userId: string, motivo: string, intentosPrevios: number): Promise<void> {
  const { error } = await supabaseServer
    .from('archivos')
    .update({ analisis_error: motivo, analisis_intentos: intentosPrevios + 1, updated_at: new Date().toISOString() })
    .eq('id', archivoId)
    .eq('user_id', userId)
  if (error) console.error('[analisisArchivo] no se pudo registrar el fallo de análisis:', error.message)
}

/**
 * Analiza un archivo ya subido. NUNCA lanza — cualquier fallo queda
 * registrado en `analisis_error`/`analisis_intentos` y devuelto como
 * `{ok:false}`, sin tocar el archivo en sí (que ya está sano en Drive desde
 * mucho antes de que esto corra). Mismo criterio defensivo que
 * `resolverCamposExamen`/`resolverIcono`.
 */
export async function analizarArchivo(userId: string, archivoId: string): Promise<ResultadoAnalisis> {
  try {
    const { data: archivo, error } = await supabaseServer
      .from('archivos')
      .select('id, nombre, mime_type, tamano_bytes, drive_file_id, analisis_intentos')
      .eq('id', archivoId)
      .eq('user_id', userId)
      .maybeSingle<FilaArchivoAnalisis>()

    if (error) return { ok: false, motivo: `No se pudo leer el archivo: ${error.message}`, reintentable: true }
    if (!archivo) return { ok: false, motivo: 'Archivo no encontrado', reintentable: false }
    if (!archivo.drive_file_id) return { ok: false, motivo: 'El archivo no tiene contenido en Drive todavía', reintentable: false }

    if (archivo.analisis_intentos >= MAX_INTENTOS) {
      return { ok: false, motivo: `Se alcanzó el máximo de ${MAX_INTENTOS} intentos de análisis para este archivo`, reintentable: false }
    }

    const politica = politicaDeAnalisis(archivo.mime_type, archivo.tamano_bytes)
    if (!politica.analizable) {
      // Se registra igual (para que la UI pueda explicar POR QUÉ no hay
      // resumen) pero NO cuenta como intento reintentable: el formato no va
      // a cambiar por reintentar.
      await supabaseServer
        .from('archivos')
        .update({ analisis_error: politica.motivo, updated_at: new Date().toISOString() })
        .eq('id', archivoId)
        .eq('user_id', userId)
      return { ok: false, motivo: politica.motivo, reintentable: false }
    }

    const descarga = await descargarArchivoStream(userId, archivo.drive_file_id)
    if (!descarga.ok) {
      await registrarFallo(archivoId, userId, descarga.detalle, archivo.analisis_intentos)
      return { ok: false, motivo: descarga.detalle, reintentable: true }
    }

    const bytes = Buffer.from(await new Response(descarga.datos.cuerpo).arrayBuffer())
    const mimeType = archivo.mime_type ?? 'application/octet-stream'

    // Texto plano va como `input` (mandar un .txt como binario base64 es
    // desperdiciar tokens); PDF/imagen van como adjunto binario.
    const esTexto = politica.via === 'texto'
    const adjuntos: AdjuntoIA[] = esTexto ? [] : [{ tipo: politica.via === 'imagen' ? 'imagen' : 'documento', datosBase64: bytes.toString('base64'), mimeType }]

    bootstrapAI()
    const resultado = await aiOrchestrator.execute<AnalisisArchivoAgentOutput>(ANALISIS_ARCHIVO_AGENT_ID, {
      id: createId('req'),
      agentId: ANALISIS_ARCHIVO_AGENT_ID,
      userId,
      input: esTexto ? bytes.toString('utf8') : '',
      metadata: { nombreArchivo: archivo.nombre, ...(adjuntos.length > 0 ? { adjuntos } : {}) },
    })

    if (resultado.status !== 'success' || !resultado.output) {
      const motivo = resultado.error?.message ?? `El análisis no tuvo éxito (${resultado.status})`
      await registrarFallo(archivoId, userId, motivo, archivo.analisis_intentos)
      return { ok: false, motivo, reintentable: true }
    }

    const { resumen, tipoDocumento, tareas } = resultado.output
    const { error: errorUpdate } = await supabaseServer
      .from('archivos')
      .update({
        resumen_ia: resumen,
        tipo_documento: tipoDocumento,
        tareas_detectadas: tareas,
        analizado_en: new Date().toISOString(),
        analisis_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', archivoId)
      .eq('user_id', userId)

    if (errorUpdate) {
      console.error('[analisisArchivo] análisis OK pero no se pudo guardar:', errorUpdate.message)
      return { ok: false, motivo: `El análisis se generó pero no se pudo guardar: ${errorUpdate.message}`, reintentable: true }
    }

    return { ok: true, resumen, tipoDocumento, tareas }
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error)
    console.error('[analisisArchivo] excepción analizando el archivo:', error)
    return { ok: false, motivo, reintentable: true }
  }
}
