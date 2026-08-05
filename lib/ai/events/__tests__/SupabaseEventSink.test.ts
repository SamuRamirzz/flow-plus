import { describe, expect, it, vi } from 'vitest'
import { AIEventBus } from '../EventBus'
import { SupabaseEventSink } from '../SupabaseEventSink'

// Se sustituye el único punto de I/O del sink. Nada de red.
function sinkConEspia(persistir: (evento: unknown) => Promise<void>) {
  const sink = new SupabaseEventSink()
  // @ts-expect-error — se reemplaza el método privado a propósito: es el
  // único borde con Supabase y sustituirlo deja probar el comportamiento
  // que de verdad importa (que NO bloquee y que NO propague fallos).
  sink.persistir = persistir
  return sink
}

describe('SupabaseEventSink — no debe bloquear la ejecución', () => {
  it('emit() resuelve sin esperar a que termine el insert', async () => {
    let insertTerminado = false
    const sink = sinkConEspia(async () => {
      await new Promise((r) => setTimeout(r, 60))
      insertTerminado = true
    })

    const bus = new AIEventBus()
    sink.conectar(bus)

    await bus.emit('agent.execution.started', { agentId: 'x' }, 'test')
    // El evento ya se emitió y el insert sigue en vuelo: esa es justamente
    // la propiedad que se busca (la auditoría no añade latencia a cada
    // ejecución de agente).
    expect(insertTerminado).toBe(false)

    await new Promise((r) => setTimeout(r, 90))
    expect(insertTerminado).toBe(true)
  })

  it('un fallo al persistir NO tumba la emisión del evento', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sink = sinkConEspia(async () => {
      throw new Error('supabase caído')
    })

    const bus = new AIEventBus()
    sink.conectar(bus)

    await expect(bus.emit('agent.execution.failed', { agentId: 'x' }, 'test')).resolves.toBeUndefined()
    await new Promise((r) => setTimeout(r, 10))
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe('SupabaseEventSink — suscripción', () => {
  it('recibe los seis tipos de evento del sistema', async () => {
    const recibidos: string[] = []
    const sink = sinkConEspia(async (e) => {
      recibidos.push((e as { type: string }).type)
    })
    const bus = new AIEventBus()
    sink.conectar(bus)

    for (const tipo of [
      'orchestrator.initialized',
      'agent.registered',
      'agent.unregistered',
      'agent.execution.started',
      'agent.execution.completed',
      'agent.execution.failed',
    ] as const) {
      await bus.emit(tipo, {}, 'test')
    }
    await new Promise((r) => setTimeout(r, 20))
    expect(recibidos).toHaveLength(6)
  })

  it('desconectar() deja de recibir eventos', async () => {
    const recibidos: string[] = []
    const sink = sinkConEspia(async (e) => {
      recibidos.push((e as { type: string }).type)
    })
    const bus = new AIEventBus()
    const soltar = sink.conectar(bus)

    await bus.emit('agent.registered', {}, 'test')
    await new Promise((r) => setTimeout(r, 10))
    expect(recibidos).toHaveLength(1)

    soltar()
    await bus.emit('agent.registered', {}, 'test')
    await new Promise((r) => setTimeout(r, 10))
    expect(recibidos).toHaveLength(1)
  })

  it('conectar() dos veces no duplica los inserts', async () => {
    const recibidos: string[] = []
    const sink = sinkConEspia(async (e) => {
      recibidos.push((e as { type: string }).type)
    })
    const bus = new AIEventBus()
    sink.conectar(bus)
    sink.conectar(bus)

    await bus.emit('agent.registered', {}, 'test')
    await new Promise((r) => setTimeout(r, 10))
    expect(recibidos).toHaveLength(1)
  })
})
