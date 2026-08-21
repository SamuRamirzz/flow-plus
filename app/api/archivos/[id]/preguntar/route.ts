import { aiOrchestrator } from '@/lib/ai'
import { bootstrapAI } from '@/lib/ai/bootstrap'
import { createId } from '@/lib/ai/utils'
import { PREGUNTA_ARCHIVO_AGENT_ID, type PreguntaArchivoAgentOutput } from '@/lib/ai/agents/analisisArchivo'
import type { AdjuntoIA, ConversationTurnInput } from '@/lib/ai/providers/gemini'
import { requerirUsuario } from '@/lib/server/usuario'
import { consumirLimite } from '@/lib/server/limites'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { descargarArchivoStream } from '@/lib/server/googleDrive'
import { politicaDeAnalisis } from '@/lib/server/analisisArchivo'
import { preguntarSobreArchivoSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Sprint Archivos / Fase 7 — "Conversación con IA" sobre UN archivo.
//
// El hilo se persiste en `conversaciones_ia` con `archivo_id` (columna nueva
// de 20260809000400), no en una tabla paralela: es exactamente la misma
// forma de dato que ya guardan las conversaciones de /ai, así que los
// endpoints de historial ya construidos siguen sirviendo sin tocarse.

type Contexto = { params: Promise<{ id: string }> }

type FilaArchivo = { id: string; nombre: string; mime_type: string | null; tamano_bytes: number | null; drive_file_id: string | null }
type MensajeGuardado = { rol: 'usuario' | 'ia'; texto: string; en: string }

/** Últimos N turnos que se le mandan al modelo como contexto del hilo. */
const MAX_TURNOS_CONTEXTO = 10
/** Tope de la conversación persistida — misma obligación que documenta la migración de Fase 1. */
const MAX_MENSAJES_GUARDADOS = 50

export async function POST(request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = preguntarSobreArchivoSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)
  const { pregunta } = parsed.data

  const { data: archivo, error } = await supabaseServer
    .from('archivos')
    .select('id, nombre, mime_type, tamano_bytes, drive_file_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<FilaArchivo>()

  if (error) return errorJson(error.message, 500)
  if (!archivo) return errorJson('Archivo no encontrado', 404)
  if (!archivo.drive_file_id) return errorJson('El archivo no tiene contenido en Drive todavía', 404)

  // Tope de uso (auditoría 2026-08-22). Comparte cupo con "analizar": las
  // dos mandan el archivo completo a Gemini, así que separar los topes
  // dejaría duplicar el gasto alternando entre ambos endpoints.
  const limite = await consumirLimite(userId, 'ia_archivo')
  if (limite) return limite

  // Misma política de formatos que el análisis — no tiene sentido aceptar
  // preguntas sobre un .docx que el modelo no puede leer.
  const politica = politicaDeAnalisis(archivo.mime_type, archivo.tamano_bytes)
  if (!politica.analizable) return errorJson(politica.motivo, 422)

  const descarga = await descargarArchivoStream(userId, archivo.drive_file_id)
  if (!descarga.ok) return errorJson(`No se pudo leer el archivo: ${descarga.detalle}`, 503)
  const bytes = Buffer.from(await new Response(descarga.datos.cuerpo).arrayBuffer())

  const esTexto = politica.via === 'texto'
  const adjuntos: AdjuntoIA[] = esTexto
    ? []
    : [{ tipo: politica.via === 'imagen' ? 'imagen' : 'documento', datosBase64: bytes.toString('base64'), mimeType: archivo.mime_type ?? 'application/octet-stream' }]

  // Hilo previo sobre ESTE archivo, si existe.
  const { data: conversacion } = await supabaseServer
    .from('conversaciones_ia')
    .select('id, mensajes')
    .eq('user_id', userId)
    .eq('archivo_id', id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; mensajes: MensajeGuardado[] }>()

  const mensajesPrevios: MensajeGuardado[] = Array.isArray(conversacion?.mensajes) ? conversacion.mensajes : []
  const historial: ConversationTurnInput[] = mensajesPrevios
    .slice(-MAX_TURNOS_CONTEXTO)
    .map((m) => ({ rol: m.rol === 'ia' ? ('modelo' as const) : ('usuario' as const), texto: m.texto }))

  bootstrapAI()
  const resultado = await aiOrchestrator.execute<PreguntaArchivoAgentOutput>(PREGUNTA_ARCHIVO_AGENT_ID, {
    id: createId('req'),
    agentId: PREGUNTA_ARCHIVO_AGENT_ID,
    userId,
    input: pregunta,
    metadata: {
      nombreArchivo: archivo.nombre,
      ...(esTexto ? { contenidoTexto: bytes.toString('utf8') } : {}),
      ...(adjuntos.length > 0 ? { adjuntos } : {}),
      ...(historial.length > 0 ? { historial } : {}),
    },
  })

  if (resultado.status !== 'success' || !resultado.output) {
    return errorJson(resultado.error?.message ?? 'No se pudo responder la pregunta', 503)
  }

  const ahora = new Date().toISOString()
  const mensajesActualizados = [
    ...mensajesPrevios,
    { rol: 'usuario' as const, texto: pregunta, en: ahora },
    { rol: 'ia' as const, texto: resultado.output.respuesta, en: ahora },
  ].slice(-MAX_MENSAJES_GUARDADOS)

  // Persistencia best-effort: la respuesta ya se generó y se devuelve pase lo
  // que pase — perder el hilo es molesto, perder la respuesta que el usuario
  // está esperando es peor.
  if (conversacion) {
    const { error: errorUpdate } = await supabaseServer
      .from('conversaciones_ia')
      .update({ mensajes: mensajesActualizados, updated_at: ahora })
      .eq('id', conversacion.id)
      .eq('user_id', userId)
    if (errorUpdate) console.error('[api/archivos/preguntar] no se pudo actualizar el hilo:', errorUpdate.message)
  } else {
    const { error: errorInsert } = await supabaseServer
      .from('conversaciones_ia')
      .insert({ user_id: userId, archivo_id: id, mensajes: mensajesActualizados })
    if (errorInsert) console.error('[api/archivos/preguntar] no se pudo crear el hilo:', errorInsert.message)
  }

  return ok({ respuesta: resultado.output.respuesta, mensajes: mensajesActualizados })
}

export async function GET(_request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const { id } = await params

  const { data, error } = await supabaseServer
    .from('conversaciones_ia')
    .select('id, mensajes, updated_at')
    .eq('user_id', auth.userId)
    .eq('archivo_id', id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return errorJson(error.message, 500)
  // Sin hilo todavía NO es 404: es un archivo sobre el que nadie preguntó
  // nada aún, un estado normal que la UI muestra como conversación vacía.
  return ok({ conversacion: data ?? null, mensajes: data?.mensajes ?? [] })
}
