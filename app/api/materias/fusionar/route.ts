import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { fusionarMateriasSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Cierre de Fase 1 — acción real detrás del aviso de dedup semántico de
// CalendarAgent. El usuario decide fusionar "Cálculo 2" (origen, recién
// creada) con "Cálculo II" (destino, ya existía) cuando el aviso le
// pregunta si son la misma materia.
//
// Regla de qué sobrevive, la más simple defendible: DESTINO gana. Se
// reasignan tareas y bloques de horario de origen a destino, y origen se
// borra entero — con su color y su ícono, que eran los de una materia
// recién creada sin ningún dato propio todavía. El ícono/color de destino
// (la materia que el usuario ya venía usando) nunca se toca.
//
// ⚠️ ORDEN OBLIGATORIO: tareas.materia_id y horario.materia_id son FK
// ON DELETE CASCADE hacia materias (verificado contra la base real antes de
// escribir esto). Borrar origen ANTES de reasignar sus tareas las borraría
// a ellas también, en cascada — el "fusionar" se convertiría en "borrar
// silenciosamente todo lo de la materia origen". Por eso las dos
// reasignaciones van primero, verificadas, y solo entonces se borra.
export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = fusionarMateriasSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const userId = auth.userId
  const { origenId, destinoId } = parsed.data

  // Confirma que AMBAS pertenecen al usuario antes de tocar nada — sin
  // esto, un id ajeno (o simplemente inexistente) llegaría hasta el UPDATE
  // y fallaría a mitad de camino con un mensaje de Postgres que no dice
  // nada útil al usuario.
  const { data: materias, error: errMaterias } = await supabaseServer
    .from('materias')
    .select('id')
    .eq('user_id', userId)
    .in('id', [origenId, destinoId])
  if (errMaterias) return errorJson(errMaterias.message, 500)
  if ((materias ?? []).length !== 2) return errorJson('Una de las dos materias no existe', 404)

  const { error: errTareas, count: tareasReasignadas } = await supabaseServer
    .from('tareas')
    .update({ materia_id: destinoId }, { count: 'exact' })
    .eq('user_id', userId)
    .eq('materia_id', origenId)
  if (errTareas) return errorJson(errTareas.message, 500)

  const { error: errHorario, count: bloquesReasignados } = await supabaseServer
    .from('horario')
    .update({ materia_id: destinoId }, { count: 'exact' })
    .eq('user_id', userId)
    .eq('materia_id', origenId)
  if (errHorario) return errorJson(errHorario.message, 500)

  // Recién acá, con las dos reasignaciones confirmadas, es seguro borrar.
  const { error: errBorrar } = await supabaseServer.from('materias').delete().eq('id', origenId).eq('user_id', userId)
  if (errBorrar) return errorJson(errBorrar.message, 500)

  return ok({ destinoId, tareasReasignadas: tareasReasignadas ?? 0, bloquesReasignados: bloquesReasignados ?? 0 })
}
