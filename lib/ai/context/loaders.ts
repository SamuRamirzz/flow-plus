import { supabaseServer } from '@/lib/server/supabaseServer'
import { cargarHorarioServidor } from '@/lib/server/horario'
import type { AIContextScope } from '@/lib/ai/types'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from './fecha'

/** Un loader trae los datos de UN scope. Inyectables (igual que las
 *  dependencias de AIOrchestrator) para poder probar ContextEngine con
 *  dobles y sin red. */
export type ScopeLoader = (userId: string) => Promise<Record<string, unknown>>

export type LoadersPorScope = Partial<Record<AIContextScope, ScopeLoader>>

async function zonaHorariaDe(userId: string): Promise<{ zonaHoraria: string; tienePerfil: boolean }> {
  const { data } = await supabaseServer.from('perfil_academico').select('zona_horaria').eq('user_id', userId).maybeSingle()
  const zona = data?.zona_horaria
  return typeof zona === 'string' && zona.length > 0
    ? { zonaHoraria: zona, tienePerfil: true }
    : { zonaHoraria: ZONA_HORARIA_POR_DEFECTO, tienePerfil: false }
}

// identity — quién es el usuario para efectos de la IA. Hoy: sus materias.
// Es lo que necesita HomeworkAgent para dejar de proponer como "nueva" una
// materia que el usuario ya tiene.
export const cargarIdentity: ScopeLoader = async (userId) => {
  const { data, error } = await supabaseServer.from('materias').select('id, nombre').eq('user_id', userId).order('created_at')
  if (error) throw new Error(`No se pudieron cargar las materias del usuario: ${error.message}`)

  const materias = (data ?? []).map((m) => ({ id: m.id as string, nombre: m.nombre as string }))
  return { materias, nombresDeMateria: materias.map((m) => m.nombre) }
}

// schedule — el horario semanal (Sprint 7/8) más la fecha de referencia ya
// resuelta en la zona del usuario. `hoy` viaja en el contexto para que los
// agentes NO llamen a new Date() por su cuenta: así la fecha que ve el
// modelo es la misma que usaría inferirFechaEntrega, y es inyectable en
// pruebas.
export const cargarSchedule: ScopeLoader = async (userId) => {
  const [{ zonaHoraria, tienePerfil }, bloques] = await Promise.all([zonaHorariaDe(userId), cargarHorarioServidor(userId)])

  const porDia: Record<number, typeof bloques> = {}
  for (const b of bloques) {
    porDia[b.diaSemana] = [...(porDia[b.diaSemana] ?? []), b]
  }

  return {
    bloques,
    porDia,
    hoy: hoyEnZona(new Date(), zonaHoraria),
    zonaHoraria,
    // Explícito para que quien lea el contexto sepa si la zona es la real
    // del usuario o el valor por defecto — no es lo mismo para depurar un
    // desfase de un día.
    zonaHorariaPorDefecto: !tienePerfil,
  }
}

// academic — Sprint Archivos / Fase 4.3: notas ancladas a una tarea (las
// "sueltas", sin tarea_id, se excluyen — no tienen relación con una tarea
// sobre la que se esté preguntando). Cap de 50 notas por recencia y 500
// caracteres de contenido cada una: mismo espíritu que el recorte a ~50
// turnos de `conversaciones_ia.mensajes` (Fase 5) — no dejar que el tamaño
// del prompt crezca sin límite con el uso normal de la app.
const CAP_NOTAS = 50
const CAP_CONTENIDO_NOTA = 500

type FilaNota = { tarea_id: string | null; titulo: string | null; contenido: string }

export const cargarAcademic: ScopeLoader = async (userId) => {
  const { data, error } = await supabaseServer
    .from('notas')
    .select('tarea_id, titulo, contenido')
    .eq('user_id', userId)
    .not('tarea_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(CAP_NOTAS)
    .returns<FilaNota[]>()
  if (error) throw new Error(`No se pudieron cargar las notas del usuario: ${error.message}`)

  const notasPorTareaId: Record<string, Array<{ titulo: string | null; contenido: string }>> = {}
  for (const n of data ?? []) {
    if (!n.tarea_id) continue
    const lista = notasPorTareaId[n.tarea_id] ?? []
    lista.push({ titulo: n.titulo, contenido: n.contenido.slice(0, CAP_CONTENIDO_NOTA) })
    notasPorTareaId[n.tarea_id] = lista
  }

  return { notasPorTareaId }
}

// conversationHistory — Sprint Archivos / Fase 5.3: últimas conversaciones
// pasadas con la IA, por recencia ("empieza simple", sin búsqueda semántica
// — límite conocido, un sprint futuro si hace falta). `resumen` puede ser
// `null` (todavía no se generó, o falló) — en ese caso se cae a las
// primeras palabras del primer mensaje, nunca se omite la conversación
// entera solo porque le falta el resumen.
const CAP_CONVERSACIONES = 3
const CAP_PALABRAS_FALLBACK = 20

type FilaConversacion = { mensajes: unknown; resumen: string | null; updated_at: string }

function resumenOFallback(fila: FilaConversacion): string {
  if (fila.resumen) return fila.resumen

  const mensajes = Array.isArray(fila.mensajes) ? fila.mensajes : []
  const primerTexto = mensajes
    .map((m) => (typeof m === 'object' && m !== null && typeof (m as Record<string, unknown>).texto === 'string' ? ((m as Record<string, unknown>).texto as string) : null))
    .find((t): t is string => t !== null)
  if (!primerTexto) return '(conversación sin contenido legible)'

  const palabras = primerTexto.trim().split(/\s+/)
  const recorte = palabras.slice(0, CAP_PALABRAS_FALLBACK).join(' ')
  return palabras.length > CAP_PALABRAS_FALLBACK ? `${recorte}…` : recorte
}

export const cargarConversationHistory: ScopeLoader = async (userId) => {
  const { data, error } = await supabaseServer
    .from('conversaciones_ia')
    .select('mensajes, resumen, updated_at')
    .eq('user_id', userId)
    .eq('archivada', false)
    .order('updated_at', { ascending: false })
    .limit(CAP_CONVERSACIONES)
    .returns<FilaConversacion[]>()
  if (error) throw new Error(`No se pudieron cargar las conversaciones pasadas del usuario: ${error.message}`)

  const conversaciones = (data ?? []).map((f) => ({ resumen: resumenOFallback(f), fecha: f.updated_at }))
  return { conversaciones }
}

// Solo se implementan los scopes que algún agente necesita HOY. Pedir
// 'operational' | 'habits' lanza AINotImplementedError desde ContextEngine
// (ver allí) — deliberado: es mejor fallar fuerte que entregar un contexto
// vacío que el modelo interpretaría como "el usuario no tiene hábitos" en
// vez de "esto no está construido".
export const loadersPorDefecto: LoadersPorScope = {
  identity: cargarIdentity,
  schedule: cargarSchedule,
  academic: cargarAcademic,
  conversationHistory: cargarConversationHistory,
}
