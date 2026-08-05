import { aiOrchestrator } from './orchestrator'
import { registerProviders } from './registerProviders'
import { registerAgents } from './registerAgents'
import { SupabaseEventSink } from './events'

let bootstrapped = false

// La memoria persistente va inyectada en la instancia compartida (ver
// lib/ai/orchestrator/index.ts). Aquí solo se engancha la auditoría, que sí
// es un listener y no una dependencia del constructor.
const eventSink = new SupabaseEventSink()

// Punto único que los Route Handlers llaman antes de usar aiOrchestrator —
// registra proveedores, agentes, memoria y auditoría una sola vez por
// proceso. Reemplaza llamar registerAgents()/registerProviders() por
// separado en cada ruta.
export function bootstrapAI(): void {
  if (bootstrapped) return
  bootstrapped = true
  registerProviders()
  registerAgents()

  // El sink se ENGANCHA al bus como listener; no vive dentro de él. Ver
  // SupabaseEventSink para por qué eso importa (latencia por ejecución).
  eventSink.conectar(aiOrchestrator.events)
}
