// Contrato para decidir la cola de ejecución (interactiva/diferida/batch)
// de un evento (docs/ai-architecture/02-orchestrator.md §4.2.2). Hoy cada
// agente declara su executionQueue de forma estática en su
// AIAgentDefinition; esta interfaz queda lista para cuando esa decisión
// deba tomarse en tiempo de ejecución.
export type { SchedulingPolicy } from '@/lib/ai/types'
