import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { resolverOCrearMateria } from '@/lib/server/materias'
import { crearMateriaSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Materias solo se crean hoy como efecto colateral de crear una tarea
// (ver POST /api/tareas), pero app/horario/page.tsx (Sprint 7) también
// necesita crear una materia de forma directa al armar el horario — de ahí
// que este endpoint exista ya aunque nada más lo use todavía.
export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = crearMateriaSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const resultado = await resolverOCrearMateria({
    userId: auth.userId,
    materiaId: null,
    nuevaMateria: parsed.data.nombre,
  })
  if (!resultado.ok) return errorJson(resultado.error, 500)

  // Cierre de Fase 1 — respuesta envuelta ({materia, posibleDuplicado}) en
  // vez de la materia sola: es lo que necesita el dedup semántico para
  // viajar hasta acá también (mismo funnel único, resolverOCrearMateria,
  // que ya usan POST/PATCH /api/tareas). La UI del aviso hoy solo está
  // conectada en AddTaskBar y el overlay de /ai (lo que pidió el encargo);
  // app/horario/page.tsx recibe el campo pero todavía no lo muestra.
  if (resultado.materiaCreada) return ok({ materia: resultado.materiaCreada, posibleDuplicado: resultado.posibleDuplicado ?? null }, 201)

  // Ya existía una materia con ese nombre — resolverOCrearMateria solo
  // devuelve el id en ese caso, así que se lee de vuelta para responder
  // siempre con el objeto completo.
  const { data: existente, error } = await supabaseServer
    .from('materias')
    .select('*')
    .eq('id', resultado.materiaId)
    .single()
  if (error || !existente) return errorJson('No se pudo obtener la materia', 500)
  return ok({ materia: existente, posibleDuplicado: null }, 200)
}
