import { createId } from '@/lib/ai/utils'
import type { OperacionRaw } from './schema'
import type { OperacionTarea, TareaContexto } from './types'

// PURO respecto a datos: la única impureza es createId() (timestamp +
// aleatorio), igual que HomeworkOutputParser — no afecta la resolución en
// sí, solo el id de UI de cada operación. Separado del parser a propósito:
// el parser (schema.ts) no conoce qué tareas existen de verdad, solo valida
// forma; esta función es la que cruza los índices que devolvió el modelo
// contra la lista real y decide qué operación queda resuelta, ambigua o sin
// coincidencias — es la pieza que se prueba exhaustivamente sin red.
export function resolverOperaciones(operacionesRaw: OperacionRaw[], tareasExistentes: TareaContexto[]): OperacionTarea[] {
  return operacionesRaw.map((raw) => resolverUna(raw, tareasExistentes))
}

function resolverUna(raw: OperacionRaw, tareasExistentes: TareaContexto[]): OperacionTarea {
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
  const enRango = (i: number) => i >= 0 && i < tareasExistentes.length
  const candidatosIdx = raw.indicesCandidatos.filter(enRango)
  const candidatos = candidatosIdx.map((i) => tareasExistentes[i])

  // Defensivo: >1 candidato válido siempre gana como "ambiguo", sin
  // importar qué `tipo` haya declarado el modelo — nunca se aplica una
  // acción irreversible (borrar) o silenciosa (modificar) sobre la tarea
  // equivocada solo porque el modelo se saltó el chequeo.
  if (candidatos.length > 1) {
    return {
      id: createId('op'),
      tipo: 'ambiguo',
      descripcion: raw.descripcion,
      accionOriginal: raw.accionOriginal ?? (raw.tipo === 'borrar' ? 'borrar' : 'modificar'),
      cambiosPropuestos: Object.keys(raw.cambios).length > 0 ? raw.cambios : null,
      candidatos,
    }
  }

  // Un único candidato sobrevivió al filtro de rango (o el modelo dio un
  // indiceObjetivo directo) → se resuelve, ya no queda ambiguo.
  const indiceResuelto = candidatos.length === 1 ? candidatosIdx[0] : raw.indiceObjetivo !== null && enRango(raw.indiceObjetivo) ? raw.indiceObjetivo : null

  if (indiceResuelto === null) {
    // El modelo dijo "ambiguo" sin candidatos válidos, o dio un índice fuera
    // de rango (alucinado) — en ambos casos no hay nada real a lo que
        // aplicar la operación.
    return { id: createId('op'), tipo: 'sin_coincidencias', descripcion: raw.descripcion }
  }

  const antes = tareasExistentes[indiceResuelto]
  const accion = raw.tipo === 'ambiguo' ? (raw.accionOriginal ?? 'modificar') : raw.tipo

  if (accion === 'borrar') {
    return { id: createId('op'), tipo: 'borrar', tareaId: antes.id, antes }
  }
  return { id: createId('op'), tipo: 'modificar', tareaId: antes.id, antes, cambios: raw.cambios }
}
