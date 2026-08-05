export { taskManagementAgent } from './TaskManagementAgent'
export { TASK_MANAGEMENT_AGENT_ID, TASK_MANAGEMENT_AGENT_TRIGGER_EVENT } from './types'
export type {
  CambiosTarea,
  OperacionAmbigua,
  OperacionBorrar,
  OperacionCrear,
  OperacionModificar,
  OperacionSinCoincidencias,
  OperacionTarea,
  TareaContexto,
  TaskManagementAgentOutput,
  TipoRespuestaGestion,
} from './types'
export { TASK_MANAGEMENT_OUTPUT_SCHEMA, TaskManagementOutputParser } from './schema'
export { resolverOperaciones } from './resolver'
