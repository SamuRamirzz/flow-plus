import { describe, expect, it } from 'vitest'
import { createId } from '@/lib/ai/utils'
import type { AIContext, AIProvider, AIProviderCapabilities, AIRequest, AIResponse } from '@/lib/ai/types'
import { GEMINI_PROVIDER_ID } from '@/lib/ai/providers/gemini'
import type { DatosSeccionIA } from '@/lib/informes/tipos'
import { puntosClaveInformeAgent } from '../PuntosClaveInformeAgent'
import { PUNTOS_CLAVE_INFORME_AGENT_ID } from '../types'

// Ningún test toca la red: el proveedor es falso e inyectado, mismo patrón
// que lib/ai/agents/calendar/__tests__/CalendarAgent.test.ts.

const testContext: AIContext = { userId: 'user-1', generatedAt: Date.now() }

const FAKE_CAPABILITIES: AIProviderCapabilities = {
  supportsVision: false,
  supportsStructuredOutput: true,
  supportsStreaming: false,
  supportsBatch: false,
  supportsPromptCaching: false,
}

class FakeProvider implements AIProvider {
  readonly id = GEMINI_PROVIDER_ID
  readonly capabilities = FAKE_CAPABILITIES
  ultimaInstruccion: string | null = null
  ultimoInput: unknown = null
  constructor(private readonly content: string) {}
  async send(request: AIRequest): Promise<AIResponse> {
    this.ultimaInstruccion = (request.metadata as { systemInstruction?: string } | undefined)?.systemInstruction ?? null
    this.ultimoInput = request.input
    return { requestId: request.id, providerId: this.id, model: 'fake-model', content: this.content }
  }
}

const DATOS: DatosSeccionIA = {
  periodo: 'semanal',
  etiquetaPeriodo: '10 – 16 de agosto de 2026',
  completadas: { hechas: 18, total: 22, porcentaje: 82 },
  porcentajePuntualidad: 75,
  rachaDias: 3,
  deltaCompletadas: 5,
  deltaPuntualidad: null,
  materias: [{ nombre: 'BIOLOGÍA', completadas: 7, pendientes: 2 }],
}

function peticion(datos: DatosSeccionIA = DATOS): AIRequest {
  return { id: createId('req'), agentId: PUNTOS_CLAVE_INFORME_AGENT_ID, userId: 'user-1', input: '', metadata: { datos } }
}

describe('PuntosClaveInformeAgent — camino feliz', () => {
  it('acepta un texto que solo cita cifras provistas y lo parte en frases', async () => {
    const proveedor = new FakeProvider('Completaste 18 de 22 tareas (82 %).\nEl 75 % llegó a tiempo.')
    const r = await puntosClaveInformeAgent.run(peticion(), testContext, proveedor)
    expect(r.status).toBe('success')
    expect(r.output?.puntos).toEqual(['Completaste 18 de 22 tareas (82 %).', 'El 75 % llegó a tiempo.'])
  })

  it('quita las viñetas que el modelo pueda añadir pese a la instrucción', async () => {
    const proveedor = new FakeProvider('- Completaste 18 de 22 tareas.\n• El 75 % llegó a tiempo.')
    const r = await puntosClaveInformeAgent.run(peticion(), testContext, proveedor)
    expect(r.output?.puntos).toEqual(['Completaste 18 de 22 tareas.', 'El 75 % llegó a tiempo.'])
  })

  it('recorta a 4 frases como máximo', async () => {
    const proveedor = new FakeProvider(['Una.', 'Dos.', 'Tres.', 'Cuatro.', 'Cinco.', 'Seis.'].join('\n'))
    const r = await puntosClaveInformeAgent.run(peticion(), testContext, proveedor)
    expect(r.output?.puntos).toHaveLength(4)
  })

  it('los datos reales llegan al prompt — el modelo no adivina, se le dan', async () => {
    const proveedor = new FakeProvider('Vas bien.')
    await puntosClaveInformeAgent.run(peticion(), testContext, proveedor)
    const input = String(proveedor.ultimoInput)
    expect(input).toContain('18 de 22')
    expect(input).toContain('BIOLOGÍA')
    expect(proveedor.ultimaInstruccion).toContain('no menciones NINGUNA cifra')
  })
})

describe('PuntosClaveInformeAgent — rechaza lo que no respeta los datos', () => {
  it('lanza si el texto cita una cifra inventada (el llamador cae al fallback)', async () => {
    const proveedor = new FakeProvider('Completaste 18 de 22 tareas, un 99 % de tu meta.')
    await expect(puntosClaveInformeAgent.run(peticion(), testContext, proveedor)).rejects.toThrow(/no respetan los datos/)
  })

  it('lanza si menciona una materia que el usuario no tiene', async () => {
    const proveedor = new FakeProvider('Tu mejor materia fue QUÍMICA.')
    await expect(puntosClaveInformeAgent.run(peticion(), testContext, proveedor)).rejects.toThrow(/no respetan los datos/)
  })

  it('lanza si el modelo devuelve texto vacío', async () => {
    const proveedor = new FakeProvider('   ')
    await expect(puntosClaveInformeAgent.run(peticion(), testContext, proveedor)).rejects.toThrow()
  })

  it('lanza si faltan los datos en metadata — nunca inventa un informe sin cifras', async () => {
    const proveedor = new FakeProvider('Vas bien.')
    const sinDatos: AIRequest = { id: createId('req'), agentId: PUNTOS_CLAVE_INFORME_AGENT_ID, userId: 'user-1', input: '' }
    await expect(puntosClaveInformeAgent.run(sinDatos, testContext, proveedor)).rejects.toThrow(/requiere los datos/)
  })
})

describe('PuntosClaveInformeAgent — definición', () => {
  it('no declara contextScopes: todo lo que ve llega por metadata', () => {
    expect(puntosClaveInformeAgent.definition.contextScopes).toEqual([])
  })

  it('usa el modelo ligero y no declara outputSchema (es prosa, no JSON)', () => {
    expect(puntosClaveInformeAgent.definition.defaultModel).toBe('gemini-3.5-flash-lite')
    expect(puntosClaveInformeAgent.definition.outputSchema).toBeUndefined()
  })
})
