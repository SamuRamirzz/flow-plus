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

// Sprint Archivos / Fase 4.2, extendido en el Sprint Sistema de Notas
// Unificado (Parte E) — resultado de resolver una intención `crear_nota`
// contra `tareasExistentes` O `bloquesExistentes` (según `objetivoTipo` que
// devuelve el modelo), DELIBERADAMENTE separado de `OperacionTarea`: nunca
// se re-exporta desde index.ts (el barrel que consume components/ai/*),
// solo lo importan resolver.ts/TaskManagementAgent.ts y
// app/api/ai/tareas/route.ts de forma directa. Una nota ambigua no tiene
// picker de candidatos en el cliente (a diferencia de modificar/borrar) — se
// resuelve con una respuesta conversacional pidiendo aclaración, ver el
// Route Handler.
//
// `estado:'resuelto'` lleva `ancla` (discriminada por `tipo`) en vez de tres
// campos opcionales `tareaId?`/`bloqueHorarioId?`/`archivoId?` — evita el
// estado inválido "más de uno presente a la vez" al nivel del propio tipo,
// no solo por convención.
export type AnclaResuelta = { tipo: 'tarea'; id: string } | { tipo: 'bloque_horario'; id: string } | { tipo: 'archivo'; id: string }

export type OperacionCrearNotaResuelta =
  | { id: string; estado: 'resuelto'; ancla: AnclaResuelta; contenidoNota: string }
  | { id: string; estado: 'ambiguo'; contenidoNota: string; candidatos: TareaContexto[] | BloqueHorarioContexto[] | ArchivoContexto[] }
  | { id: string; estado: 'sin_coincidencias' }

// Sprint Sistema de Notas Unificado (Parte E, cierre del gap de "archivo
// existente") — mismo espíritu que BloqueHorarioContexto: el resumen mínimo
// de un archivo real que el modelo puede "ver" para resolver una
// referencia como "mi apunte de Física" o "mi archivo Collective Nouns".
export type ArchivoContexto = { id: string; nombre: string }

// Sprint Sistema de Notas Unificado (Parte E) — mismo espíritu que
// TareaContexto: el resumen mínimo de un bloque de horario que el modelo
// puede "ver" para resolver una referencia ("mi clase de Inglés de los
// lunes", "mi bloque de ingreso"). `nombre` ya viene resuelto a texto
// legible (materia si es tipo 'clase', o "Ingreso"/"Salida"/"Descanso" si
// es especial) — el modelo nunca necesita saber de `tipo`/`materiaId` por
// separado, evita que tenga que cruzar dos tablas en su cabeza.
//
// Bugs pendientes / Parte 2 — `horaFin` se agregó para que
// `procesarBloquesParaCrear`/`procesarOperacionesBloque` (route.ts) puedan
// llamar a `hayColision()` con el rango completo, no solo `horaInicio`
// (sin `horaFin` no hay forma de saber si dos bloques se solapan de
// verdad). El modelo (prompt) sigue sin verlo — `listarBloquesParaPrompt`
// no lo usa — es de uso exclusivo del servidor.
export type BloqueHorarioContexto = {
  id: string
  nombre: string
  diaSemana: number
  horaInicio: string | null
  horaFin: string | null
}

// Sprint Sistema de Notas Unificado (Parte E) — resumen mínimo de una nota
// EXISTENTE del usuario, para que el modelo pueda resolver "la nota de mi
// tarea de Historia" / "mi nota de la clase de Inglés" al editar/borrar por
// lenguaje natural. `anclaTexto` ya viene resuelto (mismo criterio que
// `nombreDeAncla` en lib/notas/formato.ts, versión servidor) para que el
// modelo compare contra lo que el usuario dijo sin tener que cruzar tablas.
export type NotaContextoIA = {
  id: string
  anclaTexto: string
  contenido: string
}

// Sprint Sistema de Notas Unificado (Parte E) — resultado de resolver
// `editar_nota`/`borrar_nota` contra `notasExistentes`. Mismo criterio
// defensivo que `resolverCandidatos`: >1 candidato válido siempre es
// "ambiguo", nunca se aplica sobre la nota equivocada. `contenidoNuevo`
// solo tiene sentido en `editar_nota` (ausente en `borrar_nota`, no una
// cadena vacía — la resolución de a qué nota apunta es idéntica en los dos
// casos, así que un solo tipo cubre ambos).
export type OperacionNotaExistenteResuelta =
  | { id: string; accion: 'editar' | 'borrar'; estado: 'resuelto'; notaId: string; contenidoNuevo?: string }
  | { id: string; accion: 'editar' | 'borrar'; estado: 'ambiguo'; contenidoNuevo?: string; candidatos: NotaContextoIA[] }
  | { id: string; accion: 'editar' | 'borrar'; estado: 'sin_coincidencias' }

// Bugs pendientes / Parte 2 — resumen mínimo de un bloque de horario
// existente para poder deduplicarlo/mostrarlo al resolver `modificar_bloque`/
// `borrar_bloque`. Distinto de BloqueHorarioContexto (que solo trae `nombre`
// ya resuelto a texto): acá se necesitan los campos crudos porque
// `procesarOperacionesBloque` (route.ts) va a llamar a `hayColision()` con
// ellos, y `nombre` (string) no sirve para eso.
export type BloqueHorarioCompleto = {
  id: string
  tipo: TipoBloqueHorarioIA
  materiaId: string | null
  materiaNombre: string | null
  diaSemana: number
  horaInicio: string | null
  horaFin: string | null
}

export type TipoBloqueHorarioIA = 'clase' | 'ingreso' | 'salida' | 'descanso'

// Bugs pendientes / Parte 2 — resultado de resolver una intención
// `crear_bloque_horario`. DELIBERADAMENTE separado de `OperacionTarea`,
// mismo criterio que `OperacionCrearNotaResuelta`: nunca se re-exporta desde
// index.ts, solo lo consumen resolver.ts/TaskManagementAgent.ts y
// app/api/ai/tareas/route.ts. No hay estado "ambiguo" — crear siempre
// produce un bloque nuevo, no resuelve contra una lista existente (a
// diferencia de crear_nota, que si ancla a algo ya existente). El único
// fallo posible es una materia sin nombre reconocible cuando tipo='clase',
// que se resuelve igual que resolverOCrearMateria ya resuelve para tareas
// (crea la materia si hace falta) — así que en la práctica esto casi
// siempre es 'resuelto'; el estado 'invalido' cubre el caso borde real:
// tipo='clase' sin ningún nombre de materia utilizable.
export type OperacionCrearBloqueResuelta =
  | {
      id: string
      estado: 'resuelto'
      tipo: TipoBloqueHorarioIA
      materiaNombre: string | null
      diaSemana: number
      horaInicio: string | null
      horaFin: string | null
    }
  | { id: string; estado: 'invalido'; motivo: string }

// Bugs pendientes / Parte 2 — resultado de resolver `modificar_bloque_horario`/
// `borrar_bloque_horario` contra `bloquesExistentes` (mismo criterio
// defensivo que OperacionNotaExistenteResuelta: >1 candidato válido siempre
// es "ambiguo", nunca se aplica sobre el bloque equivocado).
export type CambiosBloqueIA = {
  materiaNombre?: string | null
  diaSemana?: number
  horaInicio?: string | null
  horaFin?: string | null
}

export type OperacionBloqueExistenteResuelta =
  | { id: string; accion: 'modificar' | 'borrar'; estado: 'resuelto'; bloqueId: string; cambios?: CambiosBloqueIA }
  | { id: string; accion: 'modificar' | 'borrar'; estado: 'ambiguo'; cambios?: CambiosBloqueIA; candidatos: BloqueHorarioContexto[] }
  | { id: string; accion: 'modificar' | 'borrar'; estado: 'sin_coincidencias' }

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
  // Sprint Sistema de Notas Unificado (Parte E) — mismo criterio que
  // notasParaCrear: refleja `editar_nota`/`borrar_nota` ya resueltas contra
  // notasExistentes, exclusivo del servidor (el Route Handler lo consume y
  // lo borra antes de responder al cliente).
  operacionesNotaExistente?: OperacionNotaExistenteResuelta[]
  // Bugs pendientes / Parte 2 — mismo criterio exacto que notasParaCrear:
  // exclusivo del servidor, nunca llega al cliente.
  bloquesParaCrear?: OperacionCrearBloqueResuelta[]
  operacionesBloqueExistente?: OperacionBloqueExistenteResuelta[]
}
