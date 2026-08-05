import { supabase } from './supabase'
import { apiPost, apiPatch, apiDelete } from './api/cliente'
import type { Materia, Tarea } from './types'
import type { FechaInferida } from './horario/inferirFecha'
import type { ColisionDetectada, PosibleDuplicadoMateria, ResultadoPlausibilidad } from './ai/agents/calendar'

export type NuevaTareaInput = {
  titulo: string
  materiaId: string | null
  nuevaMateria: string | null
  fecha: string
  prioridad: string
  // Sprint 10: opcional — quien no lo manda (ej. AddTaskBar, que no tiene
  // selector de tipo) deja que la base aplique su DEFAULT 'otro', igual
  // que siempre. Los agentes de IA sí lo traen (ejercicios/examen/...).
  tipo?: string
  // Sprint 10: de dónde sale `fecha` cuando SÍ viene — 'ia' activa el
  // chequeo de plausibilidad (esFechaPlausible solo cuestiona fechas
  // 'explicita_ia'); ausente/'usuario' nunca se cuestiona. Quien no lo
  // manda (AddTaskBar) se comporta exactamente igual que antes de este campo.
  fechaOrigen?: 'usuario' | 'ia'
  // Cierre de Fase 1 — conecta ExamAgent. El mensaje libre original del que
  // salió esta tarea (solo /ai lo tiene; AddTaskBar no manda nada). El
  // servidor solo lo usa cuando tipo==='examen' y temario/formato/peso no
  // vinieron ya explícitos — ver lib/server/examen.ts.
  textoOrigen?: string
}

export type CrearTareaResultado =
  | {
      ok: true
      materiaCreada?: Materia
      tareaCreada: Tarea
      fechaInferida?: FechaInferida
      // Sprint 10 — nunca bloquean la creación (ya ocurrió cuando esto
      // llega): son la info pasiva que la UI puede mostrar como nota.
      avisoFecha?: ResultadoPlausibilidad | null
      colisiones?: ColisionDetectada[]
      // Cierre de Fase 1 — dedup semántico. `undefined` cuando no se creó
      // una materia nueva (nada que comparar). `null` cuando sí se creó
      // pero CalendarAgent no encontró una coincidencia con confianza
      // suficiente para mostrar (ver resolverAvisoDedup, umbral 0.35).
      posibleDuplicado?: PosibleDuplicadoMateria | null
    }
  | { ok: false; error: string }

// Lecturas: van directo a Supabase desde el cliente, igual que siempre —
// RLS ya está activa (Sprint 5) y no hay nada que validar en una lectura.
// Solo las MUTACIONES (crear/actualizar/borrar) pasan por Route Handlers
// (Sprint 6): son las que necesitan validación de servidor y las que hoy
// escriben con la clave anónima sin ningún control del lado del servidor.
export async function cargarMaterias(): Promise<Materia[]> {
  const { data, error } = await supabase.from('materias').select('*').order('created_at')
  if (error) return []
  return data ?? []
}

export async function cargarTareas(): Promise<Tarea[]> {
  const { data, error } = await supabase.from('tareas').select('*').order('created_at')
  if (error) return []
  return data ?? []
}

// Única función que crea una tarea (y, si hace falta, una materia nueva) —
// usada por AddTaskBar (vía app/page.tsx) y por la pantalla /ai.
//
// El segundo parámetro (`materiasExistentes`) se mantiene por compatibilidad
// de firma con quienes ya llaman a esta función — la deduplicación de
// materias por nombre ahora la hace el servidor contra la base real
// (POST /api/tareas → resolverOCrearMateria), no una copia local que podía
// estar desactualizada, así que ya no se usa acá.
export async function crearTarea(input: NuevaTareaInput, _materiasExistentes: Materia[]): Promise<CrearTareaResultado> {
  const resultado = await apiPost<{
    tarea: Tarea
    materiaCreada: Materia | null
    fechaInferida: FechaInferida
    avisoFecha: ResultadoPlausibilidad | null
    colisiones: ColisionDetectada[]
    posibleDuplicado: PosibleDuplicadoMateria | null
  }>('/api/tareas', input)
  if (!resultado.ok) return { ok: false, error: resultado.error }
  return {
    ok: true,
    tareaCreada: resultado.data.tarea,
    materiaCreada: resultado.data.materiaCreada ?? undefined,
    fechaInferida: resultado.data.fechaInferida,
    avisoFecha: resultado.data.avisoFecha,
    colisiones: resultado.data.colisiones,
    posibleDuplicado: resultado.data.posibleDuplicado,
  }
}

// Crea una materia de forma directa (no como efecto colateral de crear una
// tarea) — usada por app/horario/page.tsx, donde el usuario arma bloques
// de horario para materias que pueden no existir todavía. Devuelve
// `posibleDuplicado` por completitud (mismo funnel del servidor que
// AddTaskBar/`/ai`), pero /horario todavía no lo muestra — el encargo del
// cierre de Fase 1 solo pidió la UI del aviso en esos otros dos lugares.
export async function crearMateria(
  nombre: string
): Promise<{ ok: true; materia: Materia; posibleDuplicado: PosibleDuplicadoMateria | null } | { ok: false; error: string }> {
  const resultado = await apiPost<{ materia: Materia; posibleDuplicado: PosibleDuplicadoMateria | null }>('/api/materias', { nombre })
  if (!resultado.ok) return { ok: false, error: resultado.error }
  return { ok: true, materia: resultado.data.materia, posibleDuplicado: resultado.data.posibleDuplicado }
}

// Cierre de Fase 1 — acción "Fusionar" del aviso de dedup semántico. Borra
// `origenId` de verdad, así que quien llama debe pedir confirmación antes
// (ver AvisoDuplicadoMateria.tsx) — esta función no vuelve a preguntar.
export async function fusionarMaterias(
  origenId: string,
  destinoId: string
): Promise<{ ok: true; tareasReasignadas: number } | { ok: false; error: string }> {
  const resultado = await apiPost<{ destinoId: string; tareasReasignadas: number; bloquesReasignados: number }>('/api/materias/fusionar', {
    origenId,
    destinoId,
  })
  if (!resultado.ok) return { ok: false, error: resultado.error }
  return { ok: true, tareasReasignadas: resultado.data.tareasReasignadas }
}

// Sprint 7.1 Parte 2: se extendió más allá de completada/titulo (fecha/
// prioridad/materia) para que el agente de gestión de tareas pueda aplicar
// sus operaciones "modificar" con esta misma función — la firma sigue
// aceptando los llamados existentes (toggle/editarTarea en app/page.tsx)
// sin cambios, todos los campos nuevos son opcionales.
export type CambiosTarea = {
  completada?: boolean
  titulo?: string
  materiaId?: string | null
  nuevaMateria?: string | null
  fecha?: string
  prioridad?: string
  tipo?: string
  // Sprint 10 — ver NuevaTareaInput.fechaOrigen. Solo importa cuando `fecha`
  // también viaja en el mismo objeto de cambios.
  fechaOrigen?: 'usuario' | 'ia'
}

export type ActualizarTareaResultado =
  | {
      ok: true
      // Cierre de Fase 1 — antes esta función descartaba `tarea` del todo;
      // ahora hace falta para el aviso de dedup: si `cambios.nuevaMateria`
      // creó una materia, `tarea.materia_id` YA es el id de esa materia
      // nueva (es el "origen" que se fusionaría), y no hay otra forma de
      // conocerlo desde acá sin una segunda consulta.
      tarea: Tarea
      avisoFecha: ResultadoPlausibilidad | null
      colisiones: ColisionDetectada[]
      posibleDuplicado: PosibleDuplicadoMateria | null
    }
  | { ok: false; error: string }

export async function actualizarTarea(id: string, cambios: CambiosTarea): Promise<ActualizarTareaResultado> {
  const resultado = await apiPatch<{
    tarea: Tarea
    avisoFecha: ResultadoPlausibilidad | null
    colisiones: ColisionDetectada[]
    posibleDuplicado: PosibleDuplicadoMateria | null
  }>(`/api/tareas/${id}`, cambios)
  if (!resultado.ok) return { ok: false, error: resultado.error }
  return {
    ok: true,
    tarea: resultado.data.tarea,
    avisoFecha: resultado.data.avisoFecha,
    colisiones: resultado.data.colisiones,
    posibleDuplicado: resultado.data.posibleDuplicado,
  }
}

// Sprint 7.2 Parte B: expone la tarea borrada (el endpoint ya la devuelve)
// para que quien llama pueda guardarla y ofrecer "Deshacer" — recrearla con
// crearTarea() sin tener que guardar una copia aparte antes de borrar.
export async function eliminarTarea(id: string): Promise<{ ok: true; tareaEliminada: Tarea } | { ok: false; error: string }> {
  const resultado = await apiDelete<{ eliminado: true; tarea: Tarea }>(`/api/tareas/${id}`)
  if (!resultado.ok) return { ok: false, error: resultado.error }
  return { ok: true, tareaEliminada: resultado.data.tarea }
}
