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

// Solo se implementan los scopes que algún agente necesita HOY. Pedir
// 'operational' | 'habits' | 'academic' lanza AINotImplementedError desde
// ContextEngine (ver allí) — deliberado: es mejor fallar fuerte que
// entregar un contexto vacío que el modelo interpretaría como "el usuario
// no tiene hábitos/historial" en vez de "esto no está construido".
export const loadersPorDefecto: LoadersPorScope = {
  identity: cargarIdentity,
  schedule: cargarSchedule,
}
