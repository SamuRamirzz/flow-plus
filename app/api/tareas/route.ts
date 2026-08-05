import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { resolverOCrearMateria } from '@/lib/server/materias'
import { cargarHorarioServidor } from '@/lib/server/horario'
import { resolverCamposExamen } from '@/lib/server/examen'
import { inferirFechaEntrega } from '@/lib/horario/inferirFecha'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import { crearTareaSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'
import { esFechaPlausible, detectarColisiones, type ColisionDetectada, type ResultadoPlausibilidad } from '@/lib/ai/agents/calendar'

// Único punto de creación de tareas del lado del servidor — reemplaza la
// lógica que antes vivía en lib/tasks.ts y corría en el navegador contra
// la clave anónima directamente. La resolución de materia (crear si es
// nueva, reusar si ya existe) pasa por resolverOCrearMateria(), que
// consulta la base en vez de una copia local potencialmente desactualizada
// — ver lib/server/materias.ts para la carrera que esto corrige.
//
// Sprint 7: si no llega una fecha explícita, se intenta inferir a partir
// del horario del usuario (inferirFechaEntrega, lib/horario/) — nunca al
// revés, una fecha explícita siempre gana, la función lo garantiza por
// estructura, no por un if de acá.
//
// Sprint 10: después de resolver la fecha y ANTES del insert, se valida de
// forma determinística (sin llamar a ningún modelo — ver
// lib/ai/agents/calendar/validar.ts). Ninguna de las dos cosas bloquea la
// creación: `avisoFecha`/`colisiones` viajan en la respuesta como
// información pasiva, igual que ya viaja `fechaInferida` — es la UI quien
// decide si los muestra, nunca un motivo para rechazar el insert.
export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = crearTareaSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const { titulo, materiaId, nuevaMateria, fecha, prioridad, tipo, fechaOrigen, temario, formato, peso, textoOrigen } = parsed.data

  // En paralelo: resolución de materia (icono + dedup si es nueva, ver
  // resolverOCrearMateria) y enriquecimiento de examen (ExamAgent, cierre de
  // Fase 1) — no dependen entre sí, y ambos son llamadas al modelo que no
  // vale la pena serializar.
  const [materia, camposExamen] = await Promise.all([
    resolverOCrearMateria({ userId, materiaId, nuevaMateria }),
    resolverCamposExamen(userId, { tipo, textoOrigen }, { temario, formato, peso }),
  ])
  if (!materia.ok) return errorJson(materia.error, 400)

  // hoyEnZona, NO hoyISOLocal(): esta última usa el reloj del proceso de
  // Node, que en producción corre en UTC — para un usuario en UTC-5, entre
  // las 19:00 y medianoche el servidor ya cree que es mañana, y esa fecha
  // de referencia desplazada se propaga a inferirFechaEntrega Y a
  // esFechaPlausible (que llegaría a marcar como "pasada" una fecha que
  // para el usuario todavía es hoy). Mismo helper que ya usan
  // TaskManagementAgent y HomeworkAgent, para que la fecha de referencia
  // sea una sola en todo el flujo.
  const hoy = hoyEnZona(new Date(), ZONA_HORARIA_POR_DEFECTO)

  // Si ya hay fecha explícita, inferirFechaEntrega la devuelve verbatim
  // sin mirar el horario — cargarlo en ese caso sería una consulta de
  // más, así que se evita.
  const horario = fecha ? [] : await cargarHorarioServidor(userId)
  const fechaResuelta = inferirFechaEntrega({
    fechaExplicita: fecha || null,
    origenExplicita: fechaOrigen ?? 'usuario',
    materiaId: materia.materiaId,
    horario,
    hoy,
  })

  // Sprint 10 — validación determinística, solo si de verdad hay una fecha
  // que evaluar (esFechaPlausible/detectarColisiones ya devuelven "todo
  // bien" con fecha null, pero evitar la consulta de colisiones cuando no
  // hace falta es gratis).
  let avisoFecha: ResultadoPlausibilidad | null = null
  let colisiones: ColisionDetectada[] = []

  if (fechaResuelta.fecha) {
    const plausibilidad = esFechaPlausible(fechaResuelta.fecha, hoy, fechaResuelta.origen)
    if (!plausibilidad.valida) avisoFecha = plausibilidad

    // Solo tareas PENDIENTES del mismo día: una ya completada no es un
    // choque de agenda real, y filtrar por fecha en la consulta (en vez de
    // traer todas las tareas del usuario) mantiene esto barato incluso con
    // un historial largo.
    const { data: mismoDia } = await supabaseServer
      .from('tareas')
      .select('id, titulo, fecha_entrega, prioridad, tipo')
      .eq('user_id', userId)
      .eq('fecha_entrega', fechaResuelta.fecha)
      .eq('completada', false)

    colisiones = detectarColisiones(
      { fecha: fechaResuelta.fecha, prioridad, tipo: tipo ?? 'otro' },
      (mismoDia ?? []).map((t) => ({
        id: t.id as string,
        titulo: t.titulo as string,
        fecha: t.fecha_entrega as string | null,
        prioridad: t.prioridad as string,
        tipo: t.tipo as string,
      }))
    )
  }

  const { data: tarea, error } = await supabaseServer
    .from('tareas')
    .insert({
      user_id: userId,
      materia_id: materia.materiaId,
      titulo,
      fecha_entrega: fechaResuelta.fecha,
      fecha_inferida: fechaResuelta.origen === 'inferida_horario',
      motivo_fecha: fechaResuelta.motivo,
      prioridad,
      completada: false,
      // Ausente → el DEFAULT 'otro' de la base sigue aplicando, igual que
      // antes de este sprint (ver el comentario de tipoTareaSchema).
      ...(tipo !== undefined ? { tipo } : {}),
      // Cierre de Fase 1 — campos de examen. `camposExamen` ya viene resuelto
      // (explícitos del body si los había, si no lo que haya extraído
      // ExamAgent de `textoOrigen`, si no `undefined` sin tocar) — mismo
      // criterio que `tipo`: un llamador que no manda nada de esto
      // (AddTaskBar) sigue creando tareas exactamente igual que antes.
      ...(camposExamen.temario !== undefined ? { temario: camposExamen.temario } : {}),
      ...(camposExamen.formato !== undefined ? { formato: camposExamen.formato } : {}),
      ...(camposExamen.peso !== undefined ? { peso: camposExamen.peso } : {}),
    })
    .select()
    .single()

  if (error) return errorJson(error.message, 500)

  return ok(
    {
      tarea,
      materiaCreada: materia.materiaCreada,
      // Cierre de Fase 1 — dedup semántico. `undefined` cuando materiaCreada
      // es null (no se creó nada nuevo, resolverOCrearMateria ni siquiera
      // corrió la detección) se normaliza a null: el cliente solo necesita
      // distinguir "hay sugerencia" de "no hay", nunca le importa por qué.
      posibleDuplicado: materia.posibleDuplicado ?? null,
      fechaInferida: fechaResuelta,
      avisoFecha,
      colisiones,
    },
    201
  )
}
