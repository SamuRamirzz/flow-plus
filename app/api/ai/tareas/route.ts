import { aiOrchestrator } from '@/lib/ai'
import { bootstrapAI } from '@/lib/ai/bootstrap'
import { createId } from '@/lib/ai/utils'
import { TASK_MANAGEMENT_AGENT_ID, type TareaContexto, type TaskManagementAgentOutput } from '@/lib/ai/agents/taskManagement'
import type {
  OperacionCrearNotaResuelta,
  OperacionNotaExistenteResuelta,
  OperacionCrearBloqueResuelta,
  OperacionBloqueExistenteResuelta,
  BloqueHorarioContexto,
  ArchivoContexto,
  NotaContextoIA,
} from '@/lib/ai/agents/taskManagement/types'
import type { AdjuntoIA } from '@/lib/ai/providers/gemini'
import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { esRutaDelUsuario } from '@/lib/server/rutaStorage'
import { crearNota } from '@/lib/server/notas'
import { crearBloque, actualizarBloque, borrarBloque, hayColision } from '@/lib/server/horario'
import { resolverOCrearMateria } from '@/lib/server/materias'
import { minutosDesdeHHMM, hhmmDesdeMinutos } from '@/lib/horario/horaMinutos'

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

const NOMBRE_TIPO_BLOQUE_ESPECIAL: Record<string, string> = { ingreso: 'Ingreso', salida: 'Salida', descanso: 'Descanso' }

// Sprint Sistema de Notas Unificado (Parte E) — mismo patrón que
// cargarTareasParaContexto: consulta puntual, no ContextEngine. `nombre` ya
// viene resuelto a texto legible (materia real si tipo='clase', o el label
// del tipo especial) para que TaskManagementAgent nunca tenga que cruzar
// `tipo`/`materiaId` por su cuenta.
async function cargarBloquesParaContexto(userId: string): Promise<BloqueHorarioContexto[]> {
  const [{ data: bloques }, { data: materias }] = await Promise.all([
    supabaseServer
      .from('horario')
      .select('id, tipo, materia_id, dia_semana, hora_inicio, hora_fin')
      .eq('user_id', userId)
      .eq('activo', true)
      .order('dia_semana'),
    supabaseServer.from('materias').select('id, nombre').eq('user_id', userId),
  ])

  const nombrePorMateriaId = new Map((materias ?? []).map((m) => [m.id as string, m.nombre as string]))

  return (bloques ?? []).map((b) => {
    const tipo = b.tipo as string
    const nombre =
      tipo === 'clase'
        ? (b.materia_id ? nombrePorMateriaId.get(b.materia_id as string) : undefined) ?? 'Clase'
        : (NOMBRE_TIPO_BLOQUE_ESPECIAL[tipo] ?? tipo)
    return {
      id: b.id as string,
      nombre,
      diaSemana: b.dia_semana as number,
      horaInicio: (b.hora_inicio as string | null)?.slice(0, 5) ?? null,
      horaFin: (b.hora_fin as string | null)?.slice(0, 5) ?? null,
    }
  })
}

// Sprint Sistema de Notas Unificado (Parte E, cierre del gap de "archivo
// existente") — mismo patrón que cargarTareasParaContexto/
// cargarBloquesParaContexto: consulta puntual, no ContextEngine.
async function cargarArchivosParaContexto(userId: string): Promise<ArchivoContexto[]> {
  const { data: archivos } = await supabaseServer.from('archivos').select('id, nombre').eq('user_id', userId).order('created_at')
  return (archivos ?? []).map((a) => ({ id: a.id as string, nombre: a.nombre as string }))
}

const DIA_CORTO_CONTEXTO: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' }

// Sprint Sistema de Notas Unificado (Parte E) — resumen de TODAS las notas
// del usuario (cualquier ancla) para que editar_nota/borrar_nota puedan
// resolver "la nota de mi tarea de Historia" contra datos reales.
// `anclaTexto` reusa los mismos nombres ya resueltos en tareasExistentes/
// bloquesExistentes (recibidos como parámetro para no duplicar las 2
// consultas que ya hace cargarTareasParaContexto/cargarBloquesParaContexto).
async function cargarNotasParaContexto(
  userId: string,
  tareasExistentes: TareaContexto[],
  bloquesExistentes: BloqueHorarioContexto[]
): Promise<NotaContextoIA[]> {
  const { data: notas } = await supabaseServer
    .from('notas')
    .select('id, contenido, tarea_id, bloque_horario_id, archivo_id, materia_id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (!notas || notas.length === 0) return []

  const nombrePorTareaId = new Map(tareasExistentes.map((t) => [t.id, t.titulo]))
  const bloquePorId = new Map(bloquesExistentes.map((b) => [b.id, b]))

  // archivo_id/materia_id no vienen ya resueltos por otra consulta de este
  // endpoint (a diferencia de tarea/bloque) — se resuelven acá, una sola
  // vez, solo si hace falta (evita 2 consultas más cuando no hay ninguna
  // nota anclada a esos dos tipos).
  const archivoIds = notas.map((n) => n.archivo_id).filter((id): id is string => !!id)
  const materiaIds = notas.map((n) => n.materia_id).filter((id): id is string => !!id)
  const [{ data: archivos }, { data: materiasDeNotas }] = await Promise.all([
    archivoIds.length > 0
      ? supabaseServer.from('archivos').select('id, nombre').eq('user_id', userId).in('id', archivoIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    materiaIds.length > 0
      ? supabaseServer.from('materias').select('id, nombre').eq('user_id', userId).in('id', materiaIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ])
  const nombrePorArchivoId = new Map((archivos ?? []).map((a) => [a.id, a.nombre]))
  const nombrePorMateriaDeNotaId = new Map((materiasDeNotas ?? []).map((m) => [m.id, m.nombre]))

  return notas.map((n) => {
    let anclaTexto = 'nota suelta'
    if (n.tarea_id) anclaTexto = `tarea "${nombrePorTareaId.get(n.tarea_id) ?? 'eliminada'}"`
    else if (n.bloque_horario_id) {
      const b = bloquePorId.get(n.bloque_horario_id)
      anclaTexto = b ? `bloque "${b.nombre}" (${DIA_CORTO_CONTEXTO[b.diaSemana] ?? '?'})` : 'bloque eliminado'
    } else if (n.archivo_id) anclaTexto = `archivo "${nombrePorArchivoId.get(n.archivo_id) ?? 'eliminado'}"`
    else if (n.materia_id) anclaTexto = `materia "${nombrePorMateriaDeNotaId.get(n.materia_id) ?? 'eliminada'}"`

    return { id: n.id as string, anclaTexto, contenido: n.contenido as string }
  })
}

// Sprint Archivos / Fase 4.2, extendido en el Sprint Sistema de Notas
// Unificado — ejecuta las intenciones `crear_nota` que TaskManagementAgent
// ya resolvió contra tareasExistentes O bloquesExistentes (ver
// resolver.ts::resolverNotas, `item.ancla` discrimina cuál). Reusa
// `crearNota` (lib/server/notas.ts), el MISMO punto de creación que usa
// `POST /api/notas` — nunca un fetch HTTP interno. Un fallo individual se
// registra y se sigue con el resto; nunca tumba la respuesta del turno
// completo.
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
        tareaId: item.ancla.tipo === 'tarea' ? item.ancla.id : null,
        bloqueHorarioId: item.ancla.tipo === 'bloque_horario' ? item.ancla.id : null,
        archivoId: item.ancla.tipo === 'archivo' ? item.ancla.id : null,
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

// Sprint Sistema de Notas Unificado (Parte E) — ejecuta `editar_nota`/
// `borrar_nota` ya resueltas contra notasExistentes. A diferencia de
// `crearNota`, acá se usa `supabaseServer` directo (update/delete simples
// por id ya verificado — `resolverOperacionesNotaExistente` solo resuelve
// contra notas que ya son del usuario, la lista viene de una query filtrada
// por `user_id`) en vez de pasar por el endpoint `/api/notas/[id]`, mismo
// criterio que `procesarNotasParaCrear` reusa `crearNota()` sin un fetch
// HTTP interno. El resync a Drive se omite a propósito en 'editar': mismo
// criterio de costo que ya documenta lib/server/notas.ts (evitar gastar
// cuota de Drive en cada edición) — la próxima edición manual desde la UI sí
// la dispara si el usuario cambia el contenido otra vez.
async function procesarOperacionesNotaExistente(
  userId: string,
  operaciones: OperacionNotaExistenteResuelta[]
): Promise<{ editadas: number; borradas: number; ambiguas: number; sinCoincidencias: number }> {
  let editadas = 0
  let borradas = 0
  let ambiguas = 0
  let sinCoincidencias = 0

  for (const item of operaciones) {
    if (item.estado === 'ambiguo') {
      ambiguas++
      continue
    }
    if (item.estado === 'sin_coincidencias') {
      sinCoincidencias++
      continue
    }

    if (item.accion === 'editar') {
      const { error } = await supabaseServer
        .from('notas')
        .update({ contenido: item.contenidoNuevo ?? '', updated_at: new Date().toISOString() })
        .eq('id', item.notaId)
        .eq('user_id', userId)
      if (error) console.error('[api/ai/tareas] no se pudo editar la nota propuesta por la IA:', error.message)
      else editadas++
    } else {
      const { error } = await supabaseServer.from('notas').delete().eq('id', item.notaId).eq('user_id', userId)
      if (error) console.error('[api/ai/tareas] no se pudo borrar la nota propuesta por la IA:', error.message)
      else borradas++
    }
  }

  return { editadas, borradas, ambiguas, sinCoincidencias }
}

function mensajeParaNotas(resumen: {
  creadas: number
  ambiguas: number
  sinCoincidencias: number
  editadas?: number
  borradas?: number
}): string {
  const partes: string[] = []
  if (resumen.creadas > 0) partes.push(resumen.creadas === 1 ? 'Agregué la nota.' : `Agregué ${resumen.creadas} notas.`)
  if (resumen.editadas && resumen.editadas > 0) partes.push(resumen.editadas === 1 ? 'Actualicé la nota.' : `Actualicé ${resumen.editadas} notas.`)
  if (resumen.borradas && resumen.borradas > 0) partes.push(resumen.borradas === 1 ? 'Borré la nota.' : `Borré ${resumen.borradas} notas.`)
  if (resumen.ambiguas > 0) partes.push('Hay más de una que podría ser — decime cuál.')
  if (resumen.sinCoincidencias > 0) partes.push('No encontré eso entre lo tuyo.')
  return partes.length > 0 ? partes.join(' ') : 'No pude procesar la nota.'
}

// Bugs pendientes / Parte 2 — ejecuta `crear_bloque` ya resuelto contra
// bloquesExistentes (colisión) y materias reales (resolverOCrearMateria).
// Mismo criterio defensivo que procesarNotasParaCrear: un fallo individual
// se registra y se sigue con el resto, nunca tumba la respuesta del turno.
// Una colisión detectada NO bloquea la creación — se avisa en el mensaje
// final, mismo criterio que ya sigue `esFechaPlausible`/`detectarColisiones`
// de CalendarAgent para tareas (POST /api/tareas): nunca bloquea, solo
// avisa, porque el usuario puede querer el solape a propósito (ej. una
// clase optativa superpuesta que solo asistirá parcialmente).
async function procesarBloquesParaCrear(
  userId: string,
  bloques: OperacionCrearBloqueResuelta[],
  bloquesExistentes: BloqueHorarioContexto[]
): Promise<{ creados: number; conColision: number; invalidos: number }> {
  let creados = 0
  let conColision = 0
  let invalidos = 0

  // Bloques creados en ESTE mismo turno cuentan para la colisión de los
  // siguientes — sin esto, "agrega Física lunes y miércoles a las 10" (dos
  // operaciones crear_bloque del mismo turno) nunca se verían entre sí.
  const existentesConNuevos = bloquesExistentes.map((b) => ({ id: b.id, diaSemana: b.diaSemana, horaInicio: b.horaInicio, horaFin: b.horaFin }))

  for (const item of bloques) {
    if (item.estado === 'invalido') {
      invalidos++
      continue
    }

    let materiaId: string | null = null
    if (item.tipo === 'clase') {
      const resolucion = await resolverOCrearMateria({ userId, materiaId: null, nuevaMateria: item.materiaNombre })
      if (!resolucion.ok) {
        console.error('[api/ai/tareas] no se pudo resolver la materia del bloque propuesto por la IA:', resolucion.error)
        invalidos++
        continue
      }
      materiaId = resolucion.materiaId
    }

    const choca = hayColision(existentesConNuevos, { diaSemana: item.diaSemana, horaInicio: item.horaInicio, horaFin: item.horaFin })
    if (choca) conColision++

    const resultado = await crearBloque(userId, {
      tipo: item.tipo,
      materiaId,
      diaSemana: item.diaSemana,
      horaInicio: item.horaInicio,
      horaFin: item.horaFin,
    })
    if (resultado.ok) {
      creados++
      existentesConNuevos.push({ id: resultado.bloque.id, diaSemana: item.diaSemana, horaInicio: item.horaInicio, horaFin: item.horaFin })
    } else {
      console.error('[api/ai/tareas] no se pudo crear el bloque de horario propuesto por la IA:', resultado.error)
      invalidos++
    }
  }

  return { creados, conColision, invalidos }
}

// Bugs pendientes / Parte 2 — ejecuta `modificar_bloque`/`borrar_bloque` ya
// resueltas contra bloquesExistentes. Reusa `actualizarBloque`/
// `borrarBloque` (lib/server/horario.ts), el MISMO punto de escritura que ya
// usan los endpoints `PATCH`/`DELETE /api/horario/[id]` — nunca un fetch
// HTTP interno, mismo criterio que procesarOperacionesNotaExistente.
async function procesarOperacionesBloque(
  userId: string,
  operaciones: OperacionBloqueExistenteResuelta[],
  bloquesExistentes: BloqueHorarioContexto[]
): Promise<{ modificados: number; borrados: number; conColision: number; ambiguas: number; sinCoincidencias: number }> {
  let modificados = 0
  let borrados = 0
  let conColision = 0
  let ambiguas = 0
  let sinCoincidencias = 0

  for (const item of operaciones) {
    if (item.estado === 'ambiguo') {
      ambiguas++
      continue
    }
    if (item.estado === 'sin_coincidencias') {
      sinCoincidencias++
      continue
    }

    if (item.accion === 'borrar') {
      const resultado = await borrarBloque(userId, item.bloqueId)
      if (resultado.ok) borrados++
      else console.error('[api/ai/tareas] no se pudo borrar el bloque propuesto por la IA:', resultado.error)
      continue
    }

    // modificar
    const cambios = item.cambios
    let materiaId: string | undefined
    if (cambios?.materiaNombre) {
      const resolucion = await resolverOCrearMateria({ userId, materiaId: null, nuevaMateria: cambios.materiaNombre })
      if (resolucion.ok) materiaId = resolucion.materiaId
      else console.error('[api/ai/tareas] no se pudo resolver la materia del cambio de bloque propuesto por la IA:', resolucion.error)
    }

    // Bug real encontrado en la verificación contra Gemini: "mueve mi clase
    // de Guitarra a las 17:00" solo devuelve horaInicio nuevo — mandarlo
    // solo (sin horaFin) deja la hora de fin VIEJA en la fila, que puede
    // quedar antes del nuevo inicio y violar `horario_horas_chk` en
    // Postgres (reproducido: "new row for relation horario violates check
    // constraint horario_horas_chk"). Cuando cambia solo uno de los dos
    // extremos, se recalcula el otro preservando la DURACIÓN original del
    // bloque — "muévela a las 9" debe seguir durando lo mismo que antes,
    // no quedar con una hora de fin que ya no tiene sentido.
    let horaInicioFinal = cambios?.horaInicio
    let horaFinFinal = cambios?.horaFin
    if ((cambios?.horaInicio && !cambios?.horaFin) || (cambios?.horaFin && !cambios?.horaInicio)) {
      const actual = bloquesExistentes.find((b) => b.id === item.bloqueId)
      if (actual?.horaInicio && actual?.horaFin) {
        const duracionMin = minutosDesdeHHMM(actual.horaFin) - minutosDesdeHHMM(actual.horaInicio)
        if (duracionMin > 0) {
          if (cambios.horaInicio && !cambios.horaFin) horaFinFinal = hhmmDesdeMinutos(minutosDesdeHHMM(cambios.horaInicio) + duracionMin)
          if (cambios.horaFin && !cambios.horaInicio) horaInicioFinal = hhmmDesdeMinutos(minutosDesdeHHMM(cambios.horaFin) - duracionMin)
        }
      }
    }

    if (horaInicioFinal || horaFinFinal || cambios?.diaSemana !== undefined) {
      const actual = bloquesExistentes.find((b) => b.id === item.bloqueId)
      const diaSemana = cambios?.diaSemana ?? actual?.diaSemana
      const horaInicio = horaInicioFinal ?? actual?.horaInicio ?? null
      const horaFin = horaFinFinal ?? actual?.horaFin ?? null
      if (diaSemana !== undefined && hayColision(bloquesExistentes, { diaSemana, horaInicio, horaFin }, item.bloqueId)) {
        conColision++
      }
    }

    const resultado = await actualizarBloque(userId, item.bloqueId, {
      materiaId,
      horaInicio: horaInicioFinal,
      horaFin: horaFinFinal,
    })
    if (resultado.ok) modificados++
    else console.error('[api/ai/tareas] no se pudo modificar el bloque propuesto por la IA:', resultado.error)
  }

  return { modificados, borrados, conColision, ambiguas, sinCoincidencias }
}

function mensajeParaBloques(resumen: {
  creados: number
  modificados: number
  borrados: number
  conColision: number
  invalidos: number
  ambiguas: number
  sinCoincidencias: number
}): string {
  const partes: string[] = []
  if (resumen.creados > 0) partes.push(resumen.creados === 1 ? 'Agregué el bloque a tu horario.' : `Agregué ${resumen.creados} bloques a tu horario.`)
  if (resumen.modificados > 0) partes.push(resumen.modificados === 1 ? 'Actualicé el bloque.' : `Actualicé ${resumen.modificados} bloques.`)
  if (resumen.borrados > 0) partes.push(resumen.borrados === 1 ? 'Borré el bloque.' : `Borré ${resumen.borrados} bloques.`)
  if (resumen.conColision > 0) partes.push('Ojo: choca con otro bloque que ya tenías en esa franja.')
  if (resumen.invalidos > 0) partes.push('Me faltó información para completar alguno (materia, día u hora).')
  if (resumen.ambiguas > 0) partes.push('Hay más de un bloque que podría ser — decime cuál.')
  if (resumen.sinCoincidencias > 0) partes.push('No encontré ese bloque en tu horario.')
  return partes.length > 0 ? partes.join(' ') : 'No pude procesar el bloque de horario.'
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
  // Sprint Sistema de Notas Unificado (Parte E) — bloquesExistentes primero
  // (bloques de horario), notasExistentes después (necesita los nombres ya
  // resueltos de tareas/bloques para construir `anclaTexto`). archivosExistentes
  // se agregó en el cierre del gap de "archivo existente" (crear_nota
  // también resuelve contra archivos ya subidos, no solo tareas/bloques).
  const bloquesExistentes = await cargarBloquesParaContexto(userId)
  const archivosExistentes = await cargarArchivosParaContexto(userId)
  const notasExistentes = await cargarNotasParaContexto(userId, tareasExistentes, bloquesExistentes)

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
    metadata: {
      tareasExistentes,
      historial,
      bloquesExistentes,
      archivosExistentes,
      notasExistentes,
      ...(cargaAdjuntos.adjuntos.length > 0 ? { adjuntos: cargaAdjuntos.adjuntos } : {}),
    },
  })

  // Sprint Archivos / Fase 4.2, extendido en el Sprint Sistema de Notas
  // Unificado y en Bugs pendientes / Parte 2 — crear_nota/editar_nota/
  // borrar_nota y crear_bloque/modificar_bloque/borrar_bloque se ejecutan
  // ACÁ, del lado del servidor, en el mismo request: ninguna llega al
  // cliente como una operación más. `result.output.operaciones` (lo que el
  // overlay YA consume en producción) queda exactamente como antes de estos
  // sprints.
  if (result.status === 'success' && result.output) {
    const notasParaCrear = result.output.notasParaCrear ?? []
    const operacionesNotaExistente = result.output.operacionesNotaExistente ?? []
    const bloquesParaCrear = result.output.bloquesParaCrear ?? []
    const operacionesBloqueExistente = result.output.operacionesBloqueExistente ?? []
    const huboAlgunaOperacionDeNota = notasParaCrear.length > 0 || operacionesNotaExistente.length > 0
    const huboAlgunaOperacionDeBloque = bloquesParaCrear.length > 0 || operacionesBloqueExistente.length > 0

    if (huboAlgunaOperacionDeNota || huboAlgunaOperacionDeBloque) {
      const resumenCrear = notasParaCrear.length > 0 ? await procesarNotasParaCrear(userId, notasParaCrear) : { creadas: 0, ambiguas: 0, sinCoincidencias: 0 }
      const resumenExistente =
        operacionesNotaExistente.length > 0
          ? await procesarOperacionesNotaExistente(userId, operacionesNotaExistente)
          : { editadas: 0, borradas: 0, ambiguas: 0, sinCoincidencias: 0 }
      const resumenBloquesCrear =
        bloquesParaCrear.length > 0 ? await procesarBloquesParaCrear(userId, bloquesParaCrear, bloquesExistentes) : { creados: 0, conColision: 0, invalidos: 0 }
      const resumenBloquesExistentes =
        operacionesBloqueExistente.length > 0
          ? await procesarOperacionesBloque(userId, operacionesBloqueExistente, bloquesExistentes)
          : { modificados: 0, borrados: 0, conColision: 0, ambiguas: 0, sinCoincidencias: 0 }

      // Si TODO lo que había en este turno era una operación de nota o de
      // bloque de horario, `operaciones` queda vacío — sin esto, el
      // fallback de "0 operaciones = no entendí nada" del cliente
      // (components/ai/conversacion.ts) mostraría un mensaje con estilo de
      // error sobre algo que en realidad tuvo éxito.
      if (result.output.operaciones.length === 0) {
        result.output.tipoRespuesta = 'conversacional'
        if (!result.output.mensaje) {
          const partes: string[] = []
          if (huboAlgunaOperacionDeNota) {
            partes.push(
              mensajeParaNotas({
                creadas: resumenCrear.creadas,
                ambiguas: resumenCrear.ambiguas + resumenExistente.ambiguas,
                sinCoincidencias: resumenCrear.sinCoincidencias + resumenExistente.sinCoincidencias,
                editadas: resumenExistente.editadas,
                borradas: resumenExistente.borradas,
              })
            )
          }
          if (huboAlgunaOperacionDeBloque) {
            partes.push(
              mensajeParaBloques({
                creados: resumenBloquesCrear.creados,
                modificados: resumenBloquesExistentes.modificados,
                borrados: resumenBloquesExistentes.borrados,
                conColision: resumenBloquesCrear.conColision + resumenBloquesExistentes.conColision,
                invalidos: resumenBloquesCrear.invalidos,
                ambiguas: resumenBloquesExistentes.ambiguas,
                sinCoincidencias: resumenBloquesExistentes.sinCoincidencias,
              })
            )
          }
          result.output.mensaje = partes.join(' ')
        }
      }
    }

    // Uso exclusivo del servidor — nunca viaja en la respuesta al cliente.
    delete result.output.notasParaCrear
    delete result.output.operacionesNotaExistente
    delete result.output.bloquesParaCrear
    delete result.output.operacionesBloqueExistente
  }

  return Response.json(result)
}
