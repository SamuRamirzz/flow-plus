import { createId } from '@/lib/ai/utils'
import type { OperacionRaw, OperacionCrearNotaRaw } from './schema'
import type { OperacionTarea, OperacionCrearNotaResuelta, TareaContexto } from './types'

// PURO respecto a datos: la única impureza es createId() (timestamp +
// aleatorio), igual que HomeworkOutputParser — no afecta la resolución en
// sí, solo el id de UI de cada operación. Separado del parser a propósito:
// el parser (schema.ts) no conoce qué tareas existen de verdad, solo valida
// forma; esta función es la que cruza los índices que devolvió el modelo
// contra la lista real y decide qué operación queda resuelta, ambigua o sin
// coincidencias — es la pieza que se prueba exhaustivamente sin red.
//
// Sprint Archivos / Fase 4.2 — `crear_nota` se excluye acá a propósito: no
// mapea a ningún miembro de `OperacionTarea` (el tipo público que consume
// components/ai/*, ya en producción). Se resuelve aparte con
// `resolverNotas()`, más abajo, reusando `resolverCandidatos()` — la MISMA
// lógica de cruce de índices, sin duplicarla.
export function resolverOperaciones(operacionesRaw: OperacionRaw[], tareasExistentes: TareaContexto[]): OperacionTarea[] {
  return operacionesRaw
    .filter((raw): raw is Exclude<OperacionRaw, OperacionCrearNotaRaw> => raw.tipo !== 'crear_nota')
    .map((raw) => resolverUna(raw, tareasExistentes))
}

type ResolucionCandidatos =
  | { estado: 'ambiguo'; candidatos: TareaContexto[] }
  | { estado: 'sin_coincidencias' }
  | { estado: 'resuelto'; tarea: TareaContexto }

// Cruza (indiceObjetivo, indicesCandidatos) — lo que el modelo devolvió —
// contra la lista real de tareas. Compartida por `resolverUna` (modificar/
// borrar/ambiguo) y `resolverNotas` (crear_nota): es la pieza defensiva real
// (">1 candidato válido siempre gana como 'ambiguo'"), y solo existe una vez.
function resolverCandidatos(indiceObjetivo: number | null, indicesCandidatos: number[], tareasExistentes: TareaContexto[]): ResolucionCandidatos {
  const enRango = (i: number) => i >= 0 && i < tareasExistentes.length
  const candidatosIdx = indicesCandidatos.filter(enRango)
  const candidatos = candidatosIdx.map((i) => tareasExistentes[i])

  // Defensivo: >1 candidato válido siempre gana como "ambiguo", sin
  // importar qué `tipo` haya declarado el modelo — nunca se aplica una
  // acción irreversible (borrar) o silenciosa (modificar/crear_nota) sobre
  // la tarea equivocada solo porque el modelo se saltó el chequeo.
  if (candidatos.length > 1) return { estado: 'ambiguo', candidatos }

  // Un único candidato sobrevivió al filtro de rango (o el modelo dio un
  // indiceObjetivo directo) → se resuelve, ya no queda ambiguo.
  const indiceResuelto = candidatos.length === 1 ? candidatosIdx[0] : indiceObjetivo !== null && enRango(indiceObjetivo) ? indiceObjetivo : null

  if (indiceResuelto === null) {
    // El modelo dijo "ambiguo" sin candidatos válidos, o dio un índice fuera
    // de rango (alucinado) — en ambos casos no hay nada real a lo que
    // aplicar la operación.
    return { estado: 'sin_coincidencias' }
  }

  return { estado: 'resuelto', tarea: tareasExistentes[indiceResuelto] }
}

function resolverUna(raw: Exclude<OperacionRaw, OperacionCrearNotaRaw>, tareasExistentes: TareaContexto[]): OperacionTarea {
  if (raw.tipo === 'crear') {
    return {
      id: createId('op'),
      tipo: 'crear',
      titulo: raw.titulo,
      materia: raw.materia,
      fecha: raw.fecha,
      prioridad: raw.prioridad,
      tipoTarea: raw.tipoTarea,
      confidence: raw.confidence,
    }
  }
  if (raw.tipo === 'sin_coincidencias') {
    return { id: createId('op'), tipo: 'sin_coincidencias', descripcion: raw.descripcion }
  }

  // modificar | borrar | ambiguo — todas referencian tarea(s) existente(s).
  const resolucion = resolverCandidatos(raw.indiceObjetivo, raw.indicesCandidatos, tareasExistentes)

  if (resolucion.estado === 'ambiguo') {
    return {
      id: createId('op'),
      tipo: 'ambiguo',
      descripcion: raw.descripcion,
      accionOriginal: raw.accionOriginal ?? (raw.tipo === 'borrar' ? 'borrar' : 'modificar'),
      cambiosPropuestos: Object.keys(raw.cambios).length > 0 ? raw.cambios : null,
      candidatos: resolucion.candidatos,
    }
  }
  if (resolucion.estado === 'sin_coincidencias') {
    return { id: createId('op'), tipo: 'sin_coincidencias', descripcion: raw.descripcion }
  }

  const antes = resolucion.tarea
  const accion = raw.tipo === 'ambiguo' ? (raw.accionOriginal ?? 'modificar') : raw.tipo

  if (accion === 'borrar') {
    return { id: createId('op'), tipo: 'borrar', tareaId: antes.id, antes }
  }
  return { id: createId('op'), tipo: 'modificar', tareaId: antes.id, antes, cambios: raw.cambios }
}

// Sprint Archivos / Fase 4.2 — resuelve las intenciones `crear_nota` contra
// `tareasExistentes`, reusando `resolverCandidatos` (la misma lógica que
// modificar/borrar/ambiguo, sin duplicarla). El tipo de retorno
// (`OperacionCrearNotaResuelta`, en types.ts) es DELIBERADAMENTE distinto de
// `OperacionTarea`: nunca se re-exporta desde index.ts (el barrel que
// consume components/ai/*) — solo lo importan TaskManagementAgent.ts y
// app/api/ai/tareas/route.ts de forma directa.
export function resolverNotas(operacionesRaw: OperacionRaw[], tareasExistentes: TareaContexto[]): OperacionCrearNotaResuelta[] {
  return operacionesRaw
    .filter((raw): raw is OperacionCrearNotaRaw => raw.tipo === 'crear_nota')
    .map((raw) => {
      const id = createId('op')
      const resolucion = resolverCandidatos(raw.indiceObjetivo, raw.indicesCandidatos, tareasExistentes)

      if (resolucion.estado === 'ambiguo') return { id, estado: 'ambiguo', contenidoNota: raw.contenidoNota, candidatos: resolucion.candidatos }
      if (resolucion.estado === 'sin_coincidencias') return { id, estado: 'sin_coincidencias' }
      return { id, estado: 'resuelto', tareaId: resolucion.tarea.id, contenidoNota: raw.contenidoNota }
    })
}
