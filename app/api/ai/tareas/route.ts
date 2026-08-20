import { requerirUsuario } from '@/lib/server/usuario'
import { esRutaDelUsuario } from '@/lib/server/rutaStorage'
import { procesarMensajeTareas } from '@/lib/server/ia/mensajeTareas'

// Borde HTTP del turno conversacional de /ai. Toda la lógica real —carga de
// contexto, llamada a TaskManagementAgent y ejecución server-side de las
// operaciones de nota y de horario— vive en `procesarMensajeTareas`
// (lib/server/ia/mensajeTareas.ts) desde el Sprint 2/3: se extrajo para que
// el canal de WhatsApp corra EXACTAMENTE el mismo pipeline sin duplicarlo ni
// hacerse un fetch HTTP a sí mismo. Mismo patrón que ya siguen
// lib/server/tareas.ts y lib/server/horario.ts.
//
// La respuesta es byte a byte la misma que antes de la extracción: el overlay
// de /ai sigue recibiendo el `result` completo, con `output.operaciones` sin
// aplicar para mostrarlas con aplicar/deshacer.
export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido: se esperaba JSON' }, { status: 400 })
  }

  const textoRaw = typeof body === 'object' && body !== null && 'text' in body ? (body as { text: unknown }).text : ''
  const text = typeof textoRaw === 'string' ? textoRaw.trim() : ''

  // Sub-sprint 7.3.1: `adjuntos` es una lista de `{ruta}`, opcional — el
  // cliente ya subió cada archivo binario (imagen/PDF) a Storage antes de
  // llamar acá (ver lib/ai/procesarAdjunto.ts); los adjuntos de texto
  // (.txt/.md) NUNCA llegan por acá, ya vienen concatenados dentro de
  // `text`. Con adjuntos binarios presentes, el mensaje puede ir sin texto:
  // la(s) foto(s)/PDF ES el mensaje.
  const adjuntosBody = typeof body === 'object' && body !== null && 'adjuntos' in body ? (body as { adjuntos: unknown }).adjuntos : undefined
  const rutasAdjuntos = Array.isArray(adjuntosBody)
    ? adjuntosBody
        .map((a) => (typeof a === 'object' && a !== null && 'ruta' in a ? (a as { ruta: unknown }).ruta : undefined))
        .filter((r): r is string => typeof r === 'string')
    : []

  if (!text && rutasAdjuntos.length === 0) {
    return Response.json({ error: 'El campo "text" es requerido (o un adjunto) y no puede estar vacío' }, { status: 400 })
  }

  // ⚠️ IDOR corregido — mismo hallazgo que app/api/ai/horario/route.ts:
  // `supabaseServer` usa service_role y salta las políticas RLS de Storage,
  // así que sin este chequeo cualquier sesión podía leer el adjunto de OTRO
  // usuario adivinando o conociendo su ruta. Este endpoint además NO tenía
  // ningún control de formato sobre `ruta` (a diferencia de
  // analizarHorarioSchema) — esRutaDelUsuario también rechaza `..`, así que
  // de paso cierra esa ausencia. Se rechaza ANTES de tocar Storage.
  //
  // Se queda en el borde HTTP y NO se movió al módulo compartido a
  // propósito: es una comprobación sobre datos que vienen de un request,
  // y el canal de WhatsApp (el otro llamador) nunca recibe rutas de Storage.
  const rutaAjena = rutasAdjuntos.find((ruta) => !esRutaDelUsuario(ruta, userId))
  if (rutaAjena) {
    return Response.json({ error: 'Uno de los adjuntos no pertenece a tu sesión' }, { status: 403 })
  }

  // Sprint 7.2 Parte A: historial de la sesión actual del overlay, si el
  // cliente manda uno — opcional y sin validar estrictamente acá, el agente
  // (normalizarHistorial en TaskManagementAgent.ts) ya descarta cualquier
  // entrada mal formada sin lanzar.
  const historial = typeof body === 'object' && body !== null && 'historial' in body ? (body as { historial: unknown }).historial : undefined

  const salida = await procesarMensajeTareas(userId, { texto: text, rutasAdjuntos, historial })
  if (!salida.ok) return Response.json({ error: salida.error }, { status: salida.status })

  return Response.json(salida.result)
}
