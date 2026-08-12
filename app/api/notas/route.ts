import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { crearNota } from '@/lib/server/notas'
import { crearNotaSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Sprint Archivos / Fase 4.1.

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

  const parsed = crearNotaSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const { titulo, contenido, tareaId, bloqueHorarioId, archivoId, materiaId } = parsed.data

  // Mismo criterio que POST /api/archivos: zod no conoce al usuario
  // autenticado, y supabaseServer salta RLS — sin esto cualquier sesión
  // podría anclar su nota a una tarea/bloque/archivo/materia ajena
  // adivinando su id.
  if (tareaId) {
    const { data } = await supabaseServer.from('tareas').select('id').eq('id', tareaId).eq('user_id', userId).maybeSingle()
    if (!data) return errorJson('tareaId no corresponde a una tarea tuya', 400)
  }
  if (bloqueHorarioId) {
    const { data } = await supabaseServer.from('horario').select('id').eq('id', bloqueHorarioId).eq('user_id', userId).maybeSingle()
    if (!data) return errorJson('bloqueHorarioId no corresponde a un bloque tuyo', 400)
  }
  if (archivoId) {
    const { data } = await supabaseServer.from('archivos').select('id').eq('id', archivoId).eq('user_id', userId).maybeSingle()
    if (!data) return errorJson('archivoId no corresponde a un archivo tuyo', 400)
  }
  if (materiaId) {
    const { data } = await supabaseServer.from('materias').select('id').eq('id', materiaId).eq('user_id', userId).maybeSingle()
    if (!data) return errorJson('materiaId no corresponde a una materia tuya', 400)
  }

  const resultado = await crearNota(userId, {
    titulo: titulo ?? null,
    contenido: contenido ?? '',
    tareaId: tareaId ?? null,
    bloqueHorarioId: bloqueHorarioId ?? null,
    archivoId: archivoId ?? null,
    materiaId: materiaId ?? null,
    creadoPor: 'usuario',
  })
  if (!resultado.ok) return errorJson(resultado.error, 500)

  return ok({ nota: resultado.nota }, 201)
}

export async function GET(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  const { searchParams } = new URL(request.url)
  const tareaId = searchParams.get('tareaId')
  const bloqueHorarioId = searchParams.get('bloqueHorarioId')
  const archivoId = searchParams.get('archivoId')
  const materiaId = searchParams.get('materiaId')
  const sueltas = searchParams.get('sueltas') === '1'

  // Sin ningún filtro (los 5 ausentes), esta query trae TODAS las notas del
  // usuario sin importar su ancla — es exactamente lo que consume la vista
  // unificada de Archivos (Parte C del Sprint Sistema de Notas Unificado,
  // lib/notas/api.ts::cargarTodasLasNotas), sin necesitar un endpoint nuevo.
  let query = supabaseServer.from('notas').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
  if (tareaId) query = query.eq('tarea_id', tareaId)
  if (bloqueHorarioId) query = query.eq('bloque_horario_id', bloqueHorarioId)
  if (archivoId) query = query.eq('archivo_id', archivoId)
  if (materiaId) query = query.eq('materia_id', materiaId)
  // Notas "sueltas": ninguna de las 4 anclas — la migración original exige
  // explícitamente que exista este modo, para que borrar una tarea (que
  // desancla sus notas con `on delete set null`, nunca las destruye) no las
  // deje invisibles para siempre. Mismo criterio aplicado ahora a las 4.
  if (sueltas) query = query.is('tarea_id', null).is('bloque_horario_id', null).is('archivo_id', null).is('materia_id', null)

  const { data, error } = await query
  if (error) return errorJson(error.message, 500)

  return ok({ notas: data ?? [] })
}
