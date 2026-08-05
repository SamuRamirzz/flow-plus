import { supabaseServer } from './supabaseServer'
import type { Materia } from '@/lib/types'
import { asignarIconoDeterministico, ICONO_POR_DEFECTO } from '@/lib/materias/asignarIcono'
import { aiOrchestrator } from '@/lib/ai/orchestrator'
import { bootstrapAI } from '@/lib/ai/bootstrap'
import { createId } from '@/lib/ai/utils'
import { ICONO_MATERIA_AGENT_ID, type IconoMateriaAgentOutput } from '@/lib/ai/agents/iconoMateria'
import {
  CALENDAR_AGENT_ID,
  resolverAvisoDedup,
  type DedupInput,
  type MateriaParaComparar,
  type PosibleDuplicadoMateria,
  type ResultadoDedup,
} from '@/lib/ai/agents/calendar'

export const SUBJECT_COLORS = ['#FF6B4D', '#6E8F6A', '#C9973F', '#5C7FA6', '#8B6F9E', '#4A8B8B']

export type ResolverMateriaResultado =
  | { ok: true; materiaId: string; materiaCreada: Materia | null; posibleDuplicado?: PosibleDuplicadoMateria | null }
  | { ok: false; error: string }

// Escapa los caracteres especiales de LIKE/ILIKE (%, _, \) antes de usar un
// nombre de materia como patrón — sin esto, una materia literalmente
// llamada "Química_2" haría que `_` se interprete como comodín ("cualquier
// caracter") en vez de un caracter literal, y podría emparejar con
// "Química02" por error.
function escaparLike(valor: string): string {
  return valor.replace(/[%_\\]/g, (c) => `\\${c}`)
}

// Ícono automático — primero el mapeo determinístico (gratis, sin red, ver
// lib/materias/asignarIcono.ts), y solo si el nombre no calza con ningún
// patrón conocido, IconoMateriaAgent (Gemini, modeloLigero) como respaldo.
// Híbrido deliberado: la mayoría de materias de colegio/universidad
// ("Matemáticas", "Física", "Educación Física"...) ni siquiera gastan una
// llamada al modelo — solo los nombres raros/específicos la necesitan.
//
// Nunca debe poder bloquear ni tumbar la creación de la materia: es
// cosmético. Si el agente falla, tarda, o lanza por cualquier razón, se
// cae al ícono por defecto — el try/catch de acá es a propósito la única
// red de seguridad extra sobre la que ya tiene el propio agente (que
// tampoco lanza por un ícono mal formado, ver schema.ts).
async function resolverIcono(userId: string, nombreMateria: string): Promise<string> {
  const determinista = asignarIconoDeterministico(nombreMateria)
  if (determinista) return determinista

  try {
    bootstrapAI()
    const resultado = await aiOrchestrator.execute<IconoMateriaAgentOutput>(
      ICONO_MATERIA_AGENT_ID,
      { id: createId('req'), agentId: ICONO_MATERIA_AGENT_ID, userId, input: nombreMateria },
      { userId, generatedAt: Date.now() }
    )
    if (resultado.status === 'success' && resultado.output) return resultado.output.icono
    if (resultado.status !== 'success') {
      console.error('[resolverIcono] agente no tuvo éxito, cae al ícono por defecto', resultado.status, resultado.error)
    }
  } catch (error) {
    // Deliberado — cualquier fallo cae al respaldo de abajo. Se registra
    // igual: antes esto era un catch mudo, y un fallo sistemático (ej. el
    // límite de concurrencia agotado, ver ai.config.ts) podía degradar
    // silenciosamente TODAS las asignaciones de ícono sin dejar rastro.
    console.error('[resolverIcono] excepción, cae al ícono por defecto', error)
  }
  return ICONO_POR_DEFECTO
}

// Dedup semántico (cierre de Fase 1) — mismo criterio defensivo que
// resolverIcono: es una SUGERENCIA, nunca debe poder bloquear ni tumbar la
// creación de la materia. Si no hay materias contra qué comparar, ni
// siquiera se llama a aiOrchestrator (CalendarAgent ya maneja ese caso
// internamente, pero evitarlo acá ahorra el bootstrap/lookup completo para
// el caso más común: la primera materia de una lista).
async function resolverDedup(userId: string, nombreNuevo: string, existentes: MateriaParaComparar[]): Promise<PosibleDuplicadoMateria | null> {
  if (existentes.length === 0) return null

  try {
    bootstrapAI()
    const resultado = await aiOrchestrator.execute<ResultadoDedup>(
      CALENDAR_AGENT_ID,
      { id: createId('req'), agentId: CALENDAR_AGENT_ID, userId, input: { nombreNuevo, existentes } satisfies DedupInput },
      { userId, generatedAt: Date.now() }
    )
    if (resultado.status === 'success' && resultado.output) return resolverAvisoDedup(resultado.output)
    if (resultado.status !== 'success') {
      console.error('[resolverDedup] agente no tuvo éxito, no se sugiere fusión', resultado.status, resultado.error)
    }
  } catch (error) {
    // Deliberado — un fallo acá nunca debe impedir que la materia se cree.
    // Se registra igual, mismo motivo que resolverIcono arriba.
    console.error('[resolverDedup] excepción, no se sugiere fusión', error)
  }
  return null
}

// Resuelve el id de una materia a partir de `materiaId` (directo) o
// `nuevaMateria` (crea si no existe, reusa si ya hay una con ese nombre sin
// distinguir mayúsculas). Antes esto era un `.find()` en el cliente contra
// una copia de `materias` que podía estar desactualizada — con /ai
// creando varias tareas de una materia nueva casi al mismo tiempo, eso era
// una carrera real, no hipotética. Ahora consulta la base directamente, y
// el índice único `materias_user_nombre_uniq` (Sprint 5) es el respaldo
// final si dos requests llegan a insertar en el mismo instante.
export async function resolverOCrearMateria(input: {
  userId: string
  materiaId: string | null
  nuevaMateria: string | null
}): Promise<ResolverMateriaResultado> {
  if (input.materiaId) return { ok: true, materiaId: input.materiaId, materiaCreada: null }

  const nombreNormalizado = input.nuevaMateria?.trim()
  if (!nombreNormalizado) return { ok: false, error: 'La tarea necesita una materia' }

  const existente = await buscarPorNombre(input.userId, nombreNormalizado)
  if (!existente.ok) return existente
  if (existente.materia) return { ok: true, materiaId: existente.materia.id, materiaCreada: null }

  // Una sola consulta trae `id, nombre` de TODAS las materias del usuario —
  // sirve tanto para el color por índice (antes era un `count` aparte) como
  // para la lista que necesita el dedup semántico. Tabla chica (decenas de
  // filas como mucho), no vale la pena mantener dos consultas separadas.
  const { data: propias } = await supabaseServer.from('materias').select('id, nombre').eq('user_id', input.userId)
  const existentes: MateriaParaComparar[] = (propias ?? []).map((m) => ({ id: m.id as string, nombre: m.nombre as string }))

  const [icono, posibleDuplicado] = await Promise.all([
    resolverIcono(input.userId, nombreNormalizado),
    resolverDedup(input.userId, nombreNormalizado, existentes),
  ])

  const { data: nueva, error: errCrear } = await supabaseServer
    .from('materias')
    .insert({ user_id: input.userId, nombre: nombreNormalizado, color: SUBJECT_COLORS[existentes.length % SUBJECT_COLORS.length], icono })
    .select()
    .single()

  if (!errCrear) return { ok: true, materiaId: nueva.id, materiaCreada: nueva, posibleDuplicado }

  // 23505 = unique_violation — otra request creó la misma materia justo
  // antes de esta (la carrera real descrita arriba). La materia SÍ existe,
  // solo no la vimos a tiempo — reintentar la lectura en vez de fallar.
  if (errCrear.code === '23505') {
    const reintento = await buscarPorNombre(input.userId, nombreNormalizado)
    if (reintento.ok && reintento.materia) return { ok: true, materiaId: reintento.materia.id, materiaCreada: null }
  }
  return { ok: false, error: errCrear.message }
}

async function buscarPorNombre(
  userId: string,
  nombre: string
): Promise<{ ok: true; materia: Materia | null } | { ok: false; error: string }> {
  const { data, error } = await supabaseServer
    .from('materias')
    .select('*')
    .eq('user_id', userId)
    .ilike('nombre', escaparLike(nombre))
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, materia: data }
}
