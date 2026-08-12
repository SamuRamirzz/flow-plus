import { createId } from '@/lib/ai/utils'
import type { OperacionRaw, OperacionCrearNotaRaw, OperacionNotaExistenteRaw } from './schema'
import type {
  OperacionTarea,
  OperacionCrearNotaResuelta,
  OperacionNotaExistenteResuelta,
  TareaContexto,
  BloqueHorarioContexto,
  ArchivoContexto,
  NotaContextoIA,
} from './types'

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
// lógica de cruce de índices, sin duplicarla. Sprint Sistema de Notas
// Unificado — `editar_nota`/`borrar_nota` se excluyen por el mismo motivo,
// resueltas aparte con `resolverOperacionesNotaExistente()`.
export function resolverOperaciones(operacionesRaw: OperacionRaw[], tareasExistentes: TareaContexto[]): OperacionTarea[] {
  return operacionesRaw
    .filter(
      (raw): raw is Exclude<OperacionRaw, OperacionCrearNotaRaw | OperacionNotaExistenteRaw> =>
        raw.tipo !== 'crear_nota' && raw.tipo !== 'editar_nota' && raw.tipo !== 'borrar_nota'
    )
    .map((raw) => resolverUna(raw, tareasExistentes))
}

type ResolucionCandidatos<T> = { estado: 'ambiguo'; candidatos: T[] } | { estado: 'sin_coincidencias' } | { estado: 'resuelto'; item: T }

// Cruza (indiceObjetivo, indicesCandidatos) — lo que el modelo devolvió —
// contra una lista real de items indexables. Genérica sobre T (Sprint
// Sistema de Notas Unificado: antes solo tareas, ahora también bloques de
// horario y notas existentes) — es la pieza defensiva real (">1 candidato
// válido siempre gana como 'ambiguo'"), y solo existe una vez sin importar
// contra qué lista se use.
function resolverCandidatos<T>(indiceObjetivo: number | null, indicesCandidatos: number[], lista: T[]): ResolucionCandidatos<T> {
  const enRango = (i: number) => i >= 0 && i < lista.length
  const candidatosIdx = indicesCandidatos.filter(enRango)
  const candidatos = candidatosIdx.map((i) => lista[i])

  // Defensivo: >1 candidato válido siempre gana como "ambiguo", sin
  // importar qué `tipo` haya declarado el modelo — nunca se aplica una
  // acción irreversible (borrar) o silenciosa (modificar/crear_nota) sobre
  // el item equivocado solo porque el modelo se saltó el chequeo.
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

  return { estado: 'resuelto', item: lista[indiceResuelto] }
}

function resolverUna(raw: Exclude<OperacionRaw, OperacionCrearNotaRaw | OperacionNotaExistenteRaw>, tareasExistentes: TareaContexto[]): OperacionTarea {
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

  const antes = resolucion.item
  const accion = raw.tipo === 'ambiguo' ? (raw.accionOriginal ?? 'modificar') : raw.tipo

  if (accion === 'borrar') {
    return { id: createId('op'), tipo: 'borrar', tareaId: antes.id, antes }
  }
  return { id: createId('op'), tipo: 'modificar', tareaId: antes.id, antes, cambios: raw.cambios }
}

// Sprint Archivos / Fase 4.2, extendido en el Sprint Sistema de Notas
// Unificado — resuelve las intenciones `crear_nota` contra `tareasExistentes`,
// `bloquesExistentes`, O `archivosExistentes` (según `raw.objetivoTipo`, lo
// que el modelo dijo), reusando `resolverCandidatos` (la misma lógica que
// modificar/borrar/ambiguo, sin duplicarla). El tipo de retorno
// (`OperacionCrearNotaResuelta`, en types.ts) es DELIBERADAMENTE distinto de
// `OperacionTarea`: nunca se re-exporta desde index.ts (el barrel que
// consume components/ai/*) — solo lo importan TaskManagementAgent.ts y
// app/api/ai/tareas/route.ts de forma directa.
//
// `archivosExistentes` se agregó DESPUÉS de verificar contra Gemini real que
// "agrega una nota a mi archivo X" devolvía sin_coincidencias siempre sin
// este tercer universo — el encargo original asumía que ya funcionaba
// (heredado de un flujo distinto, PreguntaArchivoAgent, que responde
// preguntas sobre un archivo puntual pero nunca gestionaba notas por
// lenguaje natural genérico). Cerrado en el mismo sprint.
export function resolverNotas(
  operacionesRaw: OperacionRaw[],
  tareasExistentes: TareaContexto[],
  bloquesExistentes: BloqueHorarioContexto[],
  archivosExistentes: ArchivoContexto[]
): OperacionCrearNotaResuelta[] {
  return operacionesRaw
    .filter((raw): raw is OperacionCrearNotaRaw => raw.tipo === 'crear_nota')
    .map((raw) => {
      const id = createId('op')

      if (raw.objetivoTipo === 'bloque_horario') {
        const resolucion = resolverCandidatos(raw.indiceObjetivo, raw.indicesCandidatos, bloquesExistentes)
        if (resolucion.estado === 'ambiguo') return { id, estado: 'ambiguo', contenidoNota: raw.contenidoNota, candidatos: resolucion.candidatos }
        if (resolucion.estado === 'sin_coincidencias') return { id, estado: 'sin_coincidencias' }
        return { id, estado: 'resuelto', ancla: { tipo: 'bloque_horario', id: resolucion.item.id }, contenidoNota: raw.contenidoNota }
      }

      if (raw.objetivoTipo === 'archivo') {
        const resolucion = resolverCandidatos(raw.indiceObjetivo, raw.indicesCandidatos, archivosExistentes)
        if (resolucion.estado === 'ambiguo') return { id, estado: 'ambiguo', contenidoNota: raw.contenidoNota, candidatos: resolucion.candidatos }
        if (resolucion.estado === 'sin_coincidencias') return { id, estado: 'sin_coincidencias' }
        return { id, estado: 'resuelto', ancla: { tipo: 'archivo', id: resolucion.item.id }, contenidoNota: raw.contenidoNota }
      }

      const resolucion = resolverCandidatos(raw.indiceObjetivo, raw.indicesCandidatos, tareasExistentes)
      if (resolucion.estado === 'ambiguo') return { id, estado: 'ambiguo', contenidoNota: raw.contenidoNota, candidatos: resolucion.candidatos }
      if (resolucion.estado === 'sin_coincidencias') return { id, estado: 'sin_coincidencias' }
      return { id, estado: 'resuelto', ancla: { tipo: 'tarea', id: resolucion.item.id }, contenidoNota: raw.contenidoNota }
    })
}

// Sprint Sistema de Notas Unificado — resuelve `editar_nota`/`borrar_nota`
// contra `notasExistentes` (la lista real de notas del usuario, con su
// ancla ya resuelta a texto legible — ver NotaContextoIA en types.ts).
// Mismo criterio defensivo que el resto: >1 candidato válido siempre es
// "ambiguo".
export function resolverOperacionesNotaExistente(
  operacionesRaw: OperacionRaw[],
  notasExistentes: NotaContextoIA[]
): OperacionNotaExistenteResuelta[] {
  return operacionesRaw
    .filter((raw): raw is OperacionNotaExistenteRaw => raw.tipo === 'editar_nota' || raw.tipo === 'borrar_nota')
    .map((raw) => {
      const id = createId('op')
      const accion = raw.tipo === 'editar_nota' ? 'editar' : 'borrar'
      const resolucion = resolverCandidatos(raw.indiceObjetivo, raw.indicesCandidatos, notasExistentes)

      if (resolucion.estado === 'ambiguo') {
        return { id, accion, estado: 'ambiguo', contenidoNuevo: raw.contenidoNuevo ?? undefined, candidatos: resolucion.candidatos }
      }
      if (resolucion.estado === 'sin_coincidencias') return { id, accion, estado: 'sin_coincidencias' }
      return { id, accion, estado: 'resuelto', notaId: resolucion.item.id, contenidoNuevo: raw.contenidoNuevo ?? undefined }
    })
}
