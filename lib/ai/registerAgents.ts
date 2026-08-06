import { aiOrchestrator } from './orchestrator'
import { homeworkAgent } from './agents/homework'
import { taskManagementAgent } from './agents/taskManagement'
import { classScheduleAgent } from './agents/classSchedule'
import { iconoMateriaAgent } from './agents/iconoMateria'
import { examAgent } from './agents/exam'
import { calendarAgent } from './agents/calendar'
import { resumenConversacionAgent } from './agents/resumenConversacion'
import { analisisArchivoAgent, preguntaArchivoAgent } from './agents/analisisArchivo'

let registered = false

// Punto único donde se registran los agentes concretos contra el
// AIOrchestrator compartido (docs/ai-architecture/02-orchestrator.md §4.4).
// Añadir un agente nuevo es una línea aquí — nunca un cambio en el
// Orchestrator ni en el AgentRegistry.
export function registerAgents(): void {
  if (registered) return
  registered = true

  if (!aiOrchestrator.getAgent(homeworkAgent.definition.id)) {
    aiOrchestrator.registerAgent(homeworkAgent)
  }
  if (!aiOrchestrator.getAgent(taskManagementAgent.definition.id)) {
    aiOrchestrator.registerAgent(taskManagementAgent)
  }
  if (!aiOrchestrator.getAgent(classScheduleAgent.definition.id)) {
    aiOrchestrator.registerAgent(classScheduleAgent)
  }
  if (!aiOrchestrator.getAgent(iconoMateriaAgent.definition.id)) {
    aiOrchestrator.registerAgent(iconoMateriaAgent)
  }
  // Cierre de Fase 1 — a diferencia de ReminderAgent/NotificationAgent (que
  // son lógica pura y NO se registran a propósito), ExamAgent y CalendarAgent
  // sí llaman al modelo, así que sí son AIAgent y sí van acá. CalendarAgent
  // es un caso especial: `esFechaPlausible`/`detectarColisiones` (Sprint 10)
  // siguen siendo funciones puras que NADA registra — lo único que se
  // registra es la capacidad nueva (dedup semántico), que vive en el mismo
  // folder pero sí necesita el AgentRegistry/AIOrchestrator para llamar a
  // Gemini. Cierra la desviación que ROADMAP.md documentaba desde el
  // Sprint 10 ("CalendarAgent deliberadamente no registrado").
  if (!aiOrchestrator.getAgent(examAgent.definition.id)) {
    aiOrchestrator.registerAgent(examAgent)
  }
  if (!aiOrchestrator.getAgent(calendarAgent.definition.id)) {
    aiOrchestrator.registerAgent(calendarAgent)
  }
  // Sprint Archivos / Fase 5.1 — primer agente schema-free del proyecto
  // (provider.send() sin outputSchema, ver el comentario en su definición).
  if (!aiOrchestrator.getAgent(resumenConversacionAgent.definition.id)) {
    aiOrchestrator.registerAgent(resumenConversacionAgent)
  }
  // Sprint Archivos / Fase 7 — analiza un archivo ya subido a Drive, y
  // responde preguntas puntuales sobre él.
  if (!aiOrchestrator.getAgent(analisisArchivoAgent.definition.id)) {
    aiOrchestrator.registerAgent(analisisArchivoAgent)
  }
  if (!aiOrchestrator.getAgent(preguntaArchivoAgent.definition.id)) {
    aiOrchestrator.registerAgent(preguntaArchivoAgent)
  }
}
