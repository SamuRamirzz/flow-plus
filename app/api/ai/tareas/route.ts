import { aiOrchestrator } from '@/lib/ai'
import { bootstrapAI } from '@/lib/ai/bootstrap'
import { createId } from '@/lib/ai/utils'
import { TASK_MANAGEMENT_AGENT_ID, type TareaContexto, type TaskManagementAgentOutput } from '@/lib/ai/agents/taskManagement'
import type { OperacionCrearNotaResuelta } from '@/lib/ai/agents/taskManagement/types'
import type { AdjuntoIA } from '@/lib/ai/providers/gemini'
import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { esRutaDelUsuario } from '@/lib/server/rutaStorage'
import { crearNota } from '@/lib/server/notas'

// Sprint 7.1 Parte 2 — sucesor de /api/ai/homework para la pantalla /ai:
// TaskManagementAgent es un superconjunto de HomeworkAgent (también puede
// crear), más modificar/borrar por texto libre. HomeworkAgent y su endpoint
// se dejan intactos (siguen probados y en uso por sus propios tests), este
// es el que consume la superficie de producto real desde ahora.
bootstrapAI()

const BUCKET_TAREAS = 'tareas'

// Sub-sprint 7.3.1 — generaliza el 7.3 de UN adjunto a una LISTA: mismo
// patrón que app/api/ai/horario/route.ts (el cliente ya subió cada archivo
// a Storage, reducido si era imagen; acá solo llegan sus rutas — el body
// nunca carga binarios). Se descargan todas EN PARALELO y, si cualquiera
// falla, se reporta ese error sin devolver una respuesta con adjuntos a
// medias — mismo criterio "todo o nada" que ya aplica del lado del cliente
// (AIImmersiveOverlay.analizarMensaje).
async function cargarAdjuntos(rutasBody: unknown): Promise<{ ok: true; adjuntos: AdjuntoIA[] } | { ok: false; error: string }> {
  if (!Array.isArray(rutasBody) || rutasBody.length === 0) return { ok: true, adjuntos: [] }
  const rutas = rutasBody.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)

  const resultados = await Promise.all(
    rutas.map(async (ruta): Promise<{ ok: true; adjunto: AdjuntoIA } | { ok: false; error: string }> => {
      const { data: archivo, error } = await supabaseServer.storage.from(BUCKET_TAREAS).download(ruta)
      if (error || !archivo) {
        return { ok: false, error: `No se pudo leer un archivo adjunto: ${error?.message ?? 'no encontrado'}` }
      }
      const mimeType = archivo.type || 'image/jpeg'
      const datosBase64 = Buffer.from(await archivo.arrayBuffer()).toString('base64')
      return { ok: true, adjunto: { tipo: mimeType === 'application/pdf' ? 'documento' : 'imagen', datosBase64, mimeType } }
    })
  )

  const fallo = resultados.find((r): r is { ok: false; error: string } => !r.ok)
  if (fallo) return { ok: false, error: fallo.error }

  return { ok: true, adjuntos: resultados.map((r) => (r as { ok: true; adjunto: AdjuntoIA }).adjunto) }
}

// Lectura puntual de las tareas del usuario para dárselas como contexto al
// agente (para que pueda resolver "borra la de matemáticas" contra datos
// reales). NO pasa por ContextEngine — su build() lanza a propósito para
// cualquier scope hasta que la Fase 2 lo implemente de verdad (ver
// lib/ai/context/ContextEngine.ts) — es una consulta directa, igual que
// cargarHorarioServidor/resolverOCrearMateria en otros endpoints.
async function cargarTareasParaContexto(userId: string): Promise<TareaContexto[]> {
  const [{ data: tareas }, { data: materias }] = await Promise.all([
    supabaseServer.from('tareas').select('id, titulo, fecha_entrega, materia_id, completada').eq('user_id', userId).order('created_at'),
    supabaseServer.from('materias').select('id, nombre').eq('user_id', userId),
  ])

  const nombrePorMateriaId = new Map((materias ?? []).map((m) => [m.id as string, m.nombre as string]))

  return (tareas ?? []).map((t) => ({
    id: t.id as string,
    titulo: t.titulo as string,
    materia: t.materia_id ? (nombrePorMateriaId.get(t.materia_id as string) ?? null) : null,
    fecha: (t.fecha_entrega as string | null) ?? null,
    completada: Boolean(t.completada),
  }))
}

// Sprint Archivos / Fase 4.2 — ejecuta las intenciones `crear_nota` que
// TaskManagementAgent ya resolvió contra tareasExistentes (ver
// resolver.ts::resolverNotas). Reusa `crearNota` (lib/server/notas.ts), el
// MISMO punto de creación que usa `POST /api/notas` — nunca un fetch HTTP
// interno. Un fallo individual se registra y se sigue con el resto; nunca
// tumba la respuesta del turno completo.
async function procesarNotasParaCrear(
  userId: string,
  notas: OperacionCrearNotaResuelta[]
): Promise<{ creadas: number; ambiguas: number; sinCoincidencias: number }> {
  let creadas = 0
  let ambiguas = 0
  let sinCoincidencias = 0

  for (const item of notas) {
    if (item.estado === 'resuelto') {
      const resultado = await crearNota(userId, {
        titulo: null,
        contenido: item.contenidoNota,
        tareaId: item.tareaId,
        bloqueHorarioId: null,
        creadoPor: 'ia',
      })
      if (resultado.ok) creadas++
      else console.error('[api/ai/tareas] no se pudo crear la nota propuesta por la IA:', resultado.error)
    } else if (item.estado === 'ambiguo') {
      ambiguas++
    } else {
      sinCoincidencias++
    }
  }

  return { creadas, ambiguas, sinCoincidencias }
}

function mensajeParaNotas(resumen: { creadas: number; ambiguas: number; sinCoincidencias: number }): string {
  const partes: string[] = []
  if (resumen.creadas > 0) partes.push(resumen.creadas === 1 ? 'Agregué la nota.' : `Agregué ${resumen.creadas} notas.`)
  if (resumen.ambiguas > 0) partes.push('Hay más de una tarea que podría ser — decime cuál para agregar la nota.')
  if (resumen.sinCoincidencias > 0) partes.push('No encontré esa tarea entre las tuyas.')
  return partes.length > 0 ? partes.join(' ') : 'No pude procesar la nota.'
}

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
  const rutaAjena = rutasAdjuntos.find((ruta) => !esRutaDelUsuario(ruta, userId))
  if (rutaAjena) {
    return Response.json({ error: 'Uno de los adjuntos no pertenece a tu sesión' }, { status: 403 })
  }

  const cargaAdjuntos = await cargarAdjuntos(rutasAdjuntos)
  if (!cargaAdjuntos.ok) return Response.json({ error: cargaAdjuntos.error }, { status: 404 })

  // Sprint 7.2 Parte A: historial de la sesión actual del overlay, si el
  // cliente manda uno — opcional y sin validar estrictamente acá, el
  // agente (normalizarHistorial en TaskManagementAgent.ts) ya descarta
  // cualquier entrada mal formada sin lanzar, mismo criterio que el resto
  // de este endpoint (no todo pasa por zod, ver crearTareaSchema para lo
  // que sí lo necesita).
  const historial = typeof body === 'object' && body !== null && 'historial' in body ? (body as { historial: unknown }).historial : undefined

  const tareasExistentes = await cargarTareasParaContexto(userId)

  // ⚠️ Bug real corregido acá (Sprint Archivos / Fase 4.3): este endpoint
  // pasaba un tercer argumento (`{userId, generatedAt}`) a `execute()`, un
  // resto de cuando TaskManagementAgent no declaraba ningún contextScope.
  // `AIOrchestrator.execute()` hace `context ?? await this.context.build(...)`
  // — pasar CUALQUIER objeto, aunque sea mínimo, hace que el `??` nunca
  // dispare y `ContextEngine.build()` JAMÁS se ejecute, sin importar qué
  // `contextScopes` declare el agente. Con `contextScopes: ['academic',
  // 'conversationHistory']` ya agregados, esto significaba que
  // `context.academic`/`context.conversationHistory` siempre llegaban
  // `undefined` a `run()` — encontrado probando en vivo que el modelo negaba
  // tener notas/historial pese a que los loaders sí traían datos reales
  // (confirmado llamándolos directo). `app/api/ai/homework/route.ts` nunca
  // tuvo este bug porque nunca pasó un tercer argumento.
  const result = await aiOrchestrator.execute<TaskManagementAgentOutput>(TASK_MANAGEMENT_AGENT_ID, {
    id: createId('req'),
    agentId: TASK_MANAGEMENT_AGENT_ID,
    userId,
    input: text,
    metadata: { tareasExistentes, historial, ...(cargaAdjuntos.adjuntos.length > 0 ? { adjuntos: cargaAdjuntos.adjuntos } : {}) },
  })

  // Sprint Archivos / Fase 4.2 — `crear_nota` se ejecuta ACÁ, del lado del
  // servidor, en el mismo request: nunca llega al cliente como una
  // operación más. `result.output.operaciones` (lo que el overlay YA
  // consume en producción) queda exactamente como antes de este sprint.
  if (result.status === 'success' && result.output) {
    const notasParaCrear = result.output.notasParaCrear ?? []
    if (notasParaCrear.length > 0) {
      const resumenNotas = await procesarNotasParaCrear(userId, notasParaCrear)

      // Si TODO lo que había en este turno era crear_nota, `operaciones`
      // queda vacío — sin esto, el fallback de "0 operaciones = no entendí
      // nada" del cliente (components/ai/conversacion.ts) mostraría un
      // mensaje con estilo de error sobre algo que en realidad tuvo éxito.
      if (result.output.operaciones.length === 0) {
        result.output.tipoRespuesta = 'conversacional'
        if (!result.output.mensaje) result.output.mensaje = mensajeParaNotas(resumenNotas)
      }
    }

    // Uso exclusivo del servidor — nunca viaja en la respuesta al cliente.
    delete result.output.notasParaCrear
  }

  return Response.json(result)
}
