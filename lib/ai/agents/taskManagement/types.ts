import type { HomeworkPriority, HomeworkTaskType } from '../homework/types'

export const TASK_MANAGEMENT_AGENT_ID = 'task-management-agent'
export const TASK_MANAGEMENT_AGENT_TRIGGER_EVENT = 'task_management.text_submitted'

// Mismo campo que HomeworkAgent (Sprint 7.1 Parte 1), mismo vocabulario:
// 'operaciones' cuando el texto describe al menos una acción sobre tareas
// (crear/modificar/borrar, aunque termine en "sin_coincidencias" o
// "ambiguo" por falta de match); 'conversacional' cuando no era un intento
// de gestionar tareas en absoluto (saludo, pregunta, charla).
export type TipoRespuestaGestion = 'operaciones' | 'conversacional'

// Resumen de una tarea real del usuario — lo que el agente puede "ver" para
// resolver a qué tarea se refiere una instrucción ambigua ("borra la de
// matemáticas"). Nunca incluye más que esto: el modelo no necesita (ni
// debe) ver más campos que los que ya se muestran en la UI.
export type TareaContexto = {
  id: string
  titulo: string
  materia: string | null
  fecha: string | null
  completada: boolean
}

// Nunca null en la práctica: el resolver (resolver.ts/schema.ts) solo pone
// una clave acá cuando tiene un valor real ("" del modelo se descarta antes,
// como en HomeworkAgent) — la firma refleja exactamente eso, no un "borrar
// este campo" que no existe todavía.
export type CambiosTarea = {
  titulo?: string
  materia?: string
  fecha?: string
  prioridad?: HomeworkPriority
  completada?: boolean
}

// Mismos campos que DetectedTask (HomeworkAgent) salvo que su campo de
// clasificación se llama `tipoTarea` acá, no `tipo` — ese nombre ya lo usa
// el discriminante de OperacionTarea ('crear'|'modificar'|...). El resto es
// intencionalmente idéntico para poder reusar materiaParaNombre()/
// TareaEditable en el cliente sin traducir campos.
export type OperacionCrear = {
  id: string
  tipo: 'crear'
  titulo: string
  materia: string | null
  fecha: string | null
  prioridad: HomeworkPriority
  tipoTarea: HomeworkTaskType
  confidence: number
}

export type OperacionModificar = {
  id: string
  tipo: 'modificar'
  tareaId: string
  antes: TareaContexto
  cambios: CambiosTarea
}

export type OperacionBorrar = {
  id: string
  tipo: 'borrar'
  tareaId: string
  antes: TareaContexto
}

// El usuario dijo algo como "borra la de matemáticas" y hay >1 tarea que
// calza. `accionOriginal`/`cambiosPropuestos` viajan para que, cuando el
// usuario elija un candidato en la UI, se pueda materializar la operación
// resuelta (modificar/borrar) sin volver a preguntarle nada al modelo.
export type OperacionAmbigua = {
  id: string
  tipo: 'ambiguo'
  descripcion: string
  accionOriginal: 'modificar' | 'borrar'
  cambiosPropuestos: CambiosTarea | null
  candidatos: TareaContexto[]
}

export type OperacionSinCoincidencias = {
  id: string
  tipo: 'sin_coincidencias'
  descripcion: string
}

export type OperacionTarea =
  | OperacionCrear
  | OperacionModificar
  | OperacionBorrar
  | OperacionAmbigua
  | OperacionSinCoincidencias

// Sprint Archivos / Fase 4.2 — resultado de resolver una intención
// `crear_nota` contra `tareasExistentes`, DELIBERADAMENTE separado de
// `OperacionTarea`: nunca se re-exporta desde index.ts (el barrel que
// consume components/ai/*), solo lo importan resolver.ts/TaskManagementAgent.ts
// y app/api/ai/tareas/route.ts de forma directa. Una nota ambigua no tiene
// picker de candidatos en el cliente (a diferencia de modificar/borrar) — se
// resuelve con una respuesta conversacional pidiendo aclaración, ver el
// Route Handler.
export type OperacionCrearNotaResuelta =
  | { id: string; estado: 'resuelto'; tareaId: string; contenidoNota: string }
  | { id: string; estado: 'ambiguo'; contenidoNota: string; candidatos: TareaContexto[] }
  | { id: string; estado: 'sin_coincidencias' }

export type TaskManagementAgentOutput = {
  originalText: string
  tipoRespuesta: TipoRespuestaGestion
  mensaje: string | null
  operaciones: OperacionTarea[]
  // Fase 4.2 — refleja EXACTAMENTE las operaciones `crear_nota` que el
  // modelo propuso en este turno, ya resueltas contra tareasExistentes.
  // Opcional (no simplemente `[]` por defecto): además de que el Route
  // Handler siempre lo llena, mantenerlo opcional evita que los fixtures de
  // test existentes en components/ai/__tests__/ (que construyen
  // TaskManagementAgentOutput a mano, de antes de este campo) tengan que
  // tocarse solo para agregar un campo que jamás leen — viaja en el JSON de
  // respuesta pero solo lo consume el propio Route Handler, server-side,
  // antes de responder.
  notasParaCrear?: OperacionCrearNotaResuelta[]
}
