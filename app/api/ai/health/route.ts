import { aiOrchestrator, ORCHESTRATOR_VERSION } from '@/lib/ai'
import { bootstrapAI } from '@/lib/ai/bootstrap'

// Registra proveedores y agentes una vez, al cargar el módulo — así
// GET /api/ai/health refleja el estado real (agentes, proveedor) en vez
// de reportar todo en cero.
bootstrapAI()

export async function GET() {
  try {
    await aiOrchestrator.initialize()
    return Response.json(aiOrchestrator.health())
  } catch (error) {
    return Response.json(
      {
        status: 'error',
        version: ORCHESTRATOR_VERSION,
        provider: null,
        agents: 0,
        initialized: false,
        timestamp: Date.now(),
        contexto: { scopes: [] },
        memoria: { conectada: false },
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
