import { supabaseServer } from './supabaseServer'
import { resolverOCrearMateria } from './materias'
import { cargarHorarioServidor } from './horario'
import { resolverCamposExamen } from './examen'
import { inferirFechaEntrega } from '@/lib/horario/inferirFecha'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import { esFechaPlausible, detectarColisiones, type ColisionDetectada, type ResultadoPlausibilidad } from '@/lib/ai/agents/calendar'
import type { Materia } from '@/lib/types'

// Sprint 2/3 — creación de tareas del lado del servidor, EXTRAÍDA de lo que
// vivía inline en `POST /api/tareas`. Mismo patrón (y mismo motivo) que
// `crearBloque`/`actualizarBloque`/`borrarBloque` en lib/server/horario.ts y
// que `crearNota()` en lib/server/notas.ts: un único punto de escritura que
// reusan tanto el endpoint HTTP como los canales que no son HTTP (el
// ejecutor de comandos de WhatsApp), nunca un fetch interno ni lógica
// duplicada.
//
// El comportamiento NO cambia respecto a lo que hacía el Route Handler —
// esto es un movimiento de código, no un rediseño. Los comentarios que
// explican cada decisión (por qué hoyEnZona y no hoyISOLocal, por qué el
// horario solo se carga si no hay fecha explícita, por qué la validación
// nunca bloquea) viajan con el código a su nuevo sitio.

export type NuevaTareaServidor = {
  titulo: string
  materiaId?: string | null
  nuevaMateria?: string | null
  fecha?: string | null
  prioridad: string
  tipo?: string
  fechaOrigen?: 'usuario' | 'ia'
  temario?: string | null
  formato?: string | null
  peso?: number | null
  textoOrigen?: string
}

export type ResultadoCrearTarea =
  | {
      ok: true
      tarea: Record<string, unknown>
      materiaCreada: Materia | null
      posibleDuplicado: unknown
      fechaInferida: ReturnType<typeof inferirFechaEntrega>
      avisoFecha: ResultadoPlausibilidad | null
      colisiones: ColisionDetectada[]
    }
  | { ok: false; error: string; status: number }

export async function crearTareaServidor(userId: string, input: NuevaTareaServidor): Promise<ResultadoCrearTarea> {
  const { titulo, materiaId, nuevaMateria, fecha, prioridad, tipo, fechaOrigen, temario, formato, peso, textoOrigen } = input

  // En paralelo: resolución de materia (icono + dedup si es nueva, ver
  // resolverOCrearMateria) y enriquecimiento de examen (ExamAgent) — no
  // dependen entre sí, y ambos son llamadas al modelo que no vale la pena
  // serializar.
  const [materia, camposExamen] = await Promise.all([
    resolverOCrearMateria({ userId, materiaId: materiaId ?? null, nuevaMateria: nuevaMateria ?? null }),
    resolverCamposExamen(userId, { tipo, textoOrigen }, { temario, formato, peso }),
  ])
  if (!materia.ok) return { ok: false, error: materia.error, status: 400 }

  // hoyEnZona, NO hoyISOLocal(): esta última usa el reloj del proceso de
  // Node, que en producción corre en UTC — para un usuario en UTC-5, entre
  // las 19:00 y medianoche el servidor ya cree que es mañana, y esa fecha
  // de referencia desplazada se propaga a inferirFechaEntrega Y a
  // esFechaPlausible.
  const hoy = hoyEnZona(new Date(), ZONA_HORARIA_POR_DEFECTO)

  // Si ya hay fecha explícita, inferirFechaEntrega la devuelve verbatim sin
  // mirar el horario — cargarlo en ese caso sería una consulta de más.
  const horario = fecha ? [] : await cargarHorarioServidor(userId)
  const fechaResuelta = inferirFechaEntrega({
    fechaExplicita: fecha || null,
    origenExplicita: fechaOrigen ?? 'usuario',
    materiaId: materia.materiaId,
    horario,
    hoy,
  })

  // Validación determinística, solo si de verdad hay una fecha que evaluar.
  // Nunca bloquea la creación: viaja como información pasiva.
  let avisoFecha: ResultadoPlausibilidad | null = null
  let colisiones: ColisionDetectada[] = []

  if (fechaResuelta.fecha) {
    const plausibilidad = esFechaPlausible(fechaResuelta.fecha, hoy, fechaResuelta.origen)
    if (!plausibilidad.valida) avisoFecha = plausibilidad

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
      ...(tipo !== undefined ? { tipo } : {}),
      ...(camposExamen.temario !== undefined ? { temario: camposExamen.temario } : {}),
      ...(camposExamen.formato !== undefined ? { formato: camposExamen.formato } : {}),
      ...(camposExamen.peso !== undefined ? { peso: camposExamen.peso } : {}),
    })
    .select()
    .single()

  if (error) return { ok: false, error: error.message, status: 500 }

  return {
    ok: true,
    tarea: tarea as Record<string, unknown>,
    materiaCreada: materia.materiaCreada,
    posibleDuplicado: materia.posibleDuplicado ?? null,
    fechaInferida: fechaResuelta,
    avisoFecha,
    colisiones,
  }
}
