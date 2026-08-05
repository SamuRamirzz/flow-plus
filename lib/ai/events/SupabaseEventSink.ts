import { supabaseServer } from '@/lib/server/supabaseServer'
import type { AISystemEvent, AISystemEventType } from '@/lib/ai/types'
import type { AIEventBus } from './EventBus'

const TIPOS: AISystemEventType[] = [
  'orchestrator.initialized',
  'agent.registered',
  'agent.unregistered',
  'agent.execution.started',
  'agent.execution.completed',
  'agent.execution.failed',
]

/** Saca el userId del payload si lo trae. Los eventos del orchestrator no
 *  lo incluyen hoy (llevan agentId/requestId), así que casi siempre será
 *  null — la columna es nullable justamente por eso. */
function userIdDe(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const v = (payload as Record<string, unknown>).userId
  return typeof v === 'string' ? v : null
}

// Persiste los eventos del bus en `public.ai_events` para auditoría.
//
// Es un LISTENER del bus, no una pieza dentro de él, y eso es deliberado:
// AIEventBus.emit() hace `await Promise.all(listeners)`, y el Orchestrator
// hace `await this.events.emit(...)` en cinco puntos de cada ejecución. Si
// el insert se esperara ahí, cada ejecución de agente cargaría con la
// latencia de una escritura a la base — y peor, un fallo de la base
// tumbaría una ejecución de usuario que por lo demás iba bien.
//
// Por eso el listener NO devuelve la promesa del insert: la lanza y retorna
// de inmediato (fire-and-forget con .catch()). La observabilidad puede
// perderse; la ejecución del usuario, no.
export class SupabaseEventSink {
  private desuscribir: Array<() => void> = []

  /** Registra el sink en el bus. Devuelve la función para soltarlo (la
   *  misma que ya expone `bus.on`), útil en pruebas y en un hot-reload. */
  conectar(bus: AIEventBus): () => void {
    this.desconectar()
    this.desuscribir = TIPOS.map((tipo) =>
      bus.on(tipo, (evento) => {
        // Sin await ni return: el bus no debe esperar a la base.
        void this.persistir(evento).catch((e) => {
          console.error('[SupabaseEventSink] no se pudo registrar el evento', evento.type, e)
        })
      })
    )
    return () => this.desconectar()
  }

  desconectar(): void {
    for (const off of this.desuscribir) off()
    this.desuscribir = []
  }

  private async persistir(evento: AISystemEvent): Promise<void> {
    const { error } = await supabaseServer.from('ai_events').insert({
      user_id: userIdDe(evento.payload),
      tipo: evento.type,
      // El payload va tal cual: es jsonb y su forma varía por tipo de
      // evento. Normalizarlo perdería justo lo que hace útil una auditoría.
      payload: evento.payload ?? null,
      source: evento.source ?? null,
      emitted_at: new Date(evento.emittedAt).toISOString(),
    })
    if (error) throw new Error(error.message)
  }
}
