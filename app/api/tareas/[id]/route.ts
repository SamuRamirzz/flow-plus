import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { resolverOCrearMateria } from '@/lib/server/materias'
import { actualizarTareaSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import { esFechaPlausible, detectarColisiones, type ColisionDetectada, type ResultadoPlausibilidad } from '@/lib/ai/agents/calendar'

// `params` es una Promise en esta versión de Next.js (App Router,
// verificado contra node_modules/next/dist/docs/.../route.md) — no un
// objeto plano como en versiones anteriores a la 15.
type Contexto = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Contexto) {
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

  const parsed = actualizarTareaSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const { materiaId, nuevaMateria, fecha, completada, titulo, prioridad, tipo, fechaOrigen, temario, formato, peso } = parsed.data

  // Sprint 7.1 Parte 2: cambiar materia por texto libre ("cámbiala a
  // literatura") llega como nombre, igual que al crear — se resuelve del
  // mismo modo (reusa/crea) antes del update, nunca duplica esa lógica.
  const cambios: Record<string, unknown> = {}
  let posibleDuplicado = null
  if (materiaId !== undefined || nuevaMateria !== undefined) {
    const materia = await resolverOCrearMateria({ userId, materiaId: materiaId ?? null, nuevaMateria: nuevaMateria ?? null })
    if (!materia.ok) return errorJson(materia.error, 400)
    cambios.materia_id = materia.materiaId
    posibleDuplicado = materia.posibleDuplicado ?? null
  }
  if (titulo !== undefined) cambios.titulo = titulo
  // Sprint Home — `completada_en` registra CUÁNDO se completó, no solo que
  // se completó (sin esto, "puntualidad" en los informes de rendimiento no
  // es calculable). Se limpia a null al desmarcar: volver a "pendiente" no
  // debe dejar una fecha de completado fantasma de un ciclo anterior.
  // Requiere saber el estado ANTERIOR — un PATCH repetido con
  // `completada: true` sobre una tarea ya completada no debe pisar la
  // fecha real de cuando se completó por primera vez.
  if (completada !== undefined) {
    cambios.completada = completada
    if (completada) {
      const { data: previo } = await supabaseServer.from('tareas').select('completada').eq('id', id).eq('user_id', userId).maybeSingle()
      if (previo?.completada !== true) cambios.completada_en = new Date().toISOString()
    } else {
      cambios.completada_en = null
    }
  }
  if (prioridad !== undefined) cambios.prioridad = prioridad
  if (tipo !== undefined) cambios.tipo = tipo
  // Cierre de Fase 1 — campos de examen. `undefined` (ausente) = no tocar;
  // `null` (explícito) = vaciar, que es lo que hace falta cuando el usuario
  // corrige un examen a tarea normal y el temario viejo debe desaparecer.
  if (temario !== undefined) cambios.temario = temario
  if (formato !== undefined) cambios.formato = formato
  if (peso !== undefined) cambios.peso = peso

  // Sprint 10 — misma validación determinística que al crear, solo cuando
  // la fecha de verdad cambia (si `fecha` no viene en el body, no hay nada
  // nuevo que evaluar). Se necesitan prioridad/tipo FINALES de la tarea
  // para detectar colisiones con sentido — si esta llamada no los cambia,
  // se leen los que ya tiene guardados.
  let avisoFecha: ResultadoPlausibilidad | null = null
  let colisiones: ColisionDetectada[] = []

  if (fecha !== undefined) {
    // Una fecha explícita (persona o agente) siempre pisa cualquier
    // inferencia previa — misma regla que inferirFechaEntrega en la
    // creación: nunca queda una fecha marcada "inferida" que en realidad ya
    // fue corregida a mano.
    cambios.fecha_entrega = fecha || null
    cambios.fecha_inferida = false
    cambios.motivo_fecha = null

    if (fecha) {
      // Misma razón que en POST /api/tareas: el reloj del proceso (UTC en
      // producción) no es la fecha que ve el usuario. Ver el comentario
      // extendido allá.
      const hoy = hoyEnZona(new Date(), ZONA_HORARIA_POR_DEFECTO)
      // Sprint 10 (revisado): igual que en POST, `fechaOrigen` distingue si
      // esta fecha la escribió una persona o la propuso el agente de
      // gestión de tareas — antes esto estaba hardcodeado a
      // 'explicita_usuario' sin importar quién la mandara, lo que dejaba
      // esFechaPlausible sin forma de activarse nunca desde acá.
      const plausibilidad = esFechaPlausible(fecha, hoy, fechaOrigen === 'ia' ? 'explicita_ia' : 'explicita_usuario')
      if (!plausibilidad.valida) avisoFecha = plausibilidad

      const { data: actual } = await supabaseServer.from('tareas').select('prioridad, tipo').eq('id', id).eq('user_id', userId).maybeSingle()
      const prioridadFinal = prioridad ?? (actual?.prioridad as string | undefined) ?? 'media'
      const tipoFinal = tipo ?? (actual?.tipo as string | undefined) ?? 'otro'

      const { data: mismoDia } = await supabaseServer
        .from('tareas')
        .select('id, titulo, fecha_entrega, prioridad, tipo')
        .eq('user_id', userId)
        .eq('fecha_entrega', fecha)
        .eq('completada', false)
        // La propia tarea no puede chocar consigo misma. Se excluye en la
        // consulta (una fila menos que traer) Y se le pasa el `id` a
        // detectarColisiones, que también la filtra por su cuenta — la
        // función es correcta sola, esto solo evita el viaje de más.
        .neq('id', id)

      colisiones = detectarColisiones(
        { id, fecha, prioridad: prioridadFinal, tipo: tipoFinal },
        (mismoDia ?? []).map((t) => ({
          id: t.id as string,
          titulo: t.titulo as string,
          fecha: t.fecha_entrega as string | null,
          prioridad: t.prioridad as string,
          tipo: t.tipo as string,
        }))
      )
    }
  }

  const { data, error } = await supabaseServer.from('tareas').update(cambios).eq('id', id).eq('user_id', userId).select().single()

  if (error) {
    // PGRST116 = PostgREST "0 o más de 1 fila" — acá significa que el id
    // no existe o no pertenece a este usuario, no un fallo real del server.
    if (error.code === 'PGRST116') return errorJson('Tarea no encontrada', 404)
    return errorJson(error.message, 500)
  }

  // Mismo shape que POST /api/tareas ({ tarea, ...avisos }) — no se
  // aplanan avisoFecha/colisiones junto a las columnas de la tarea, para
  // que el cliente tipe una sola forma de respuesta en los dos endpoints.
  return ok({ tarea: data, avisoFecha, colisiones, posibleDuplicado })
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  const { id } = await params

  // Sprint 7.2 Parte B: devuelve la fila borrada (DELETE ... RETURNING vía
  // PostgREST) para que el cliente pueda deshacer una eliminación
  // recreando la tarea con sus datos reales, sin tener que guardar una
  // copia por su cuenta antes de pedir el borrado — cambio menor y
  // compatible hacia atrás (igual que devolver `tarea` en POST /api/tareas).
  //
  // El `.eq('user_id', ...)` sigue siendo la barrera real del lado del
  // servidor (supabaseServer usa service_role y salta RLS) — solo que ahora
  // el id viene de un JWT verificado, no de una constante.
  const { data, error } = await supabaseServer.from('tareas').delete().eq('id', id).eq('user_id', auth.userId).select().maybeSingle()

  if (error) return errorJson(error.message, 500)
  if (!data) return errorJson('Tarea no encontrada', 404)
  return ok({ eliminado: true, tarea: data })
}
