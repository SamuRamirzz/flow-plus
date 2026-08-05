import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AIOrchestrator } from '@/lib/ai/orchestrator'
import { createId } from '@/lib/ai/utils'
import type { AIContext, AIProvider, AIProviderCapabilities, AIRequest, AIResponse } from '@/lib/ai/types'
import { GEMINI_PROVIDER_ID } from '@/lib/ai/providers/gemini'
import { TASK_MANAGEMENT_AGENT_ID, taskManagementAgent } from '../index'

const testContext: AIContext = { userId: 'user-1', generatedAt: Date.now() }

const FAKE_CAPABILITIES: AIProviderCapabilities = {
  supportsVision: false,
  supportsStructuredOutput: true,
  supportsStreaming: false,
  supportsBatch: false,
  supportsPromptCaching: false,
}

// Mismo doble que homework-agent.test.ts — captura la instrucción de
// sistema real que se le mandó al modelo, no solo lo que devolvió.
class FakeProvider implements AIProvider {
  readonly id = GEMINI_PROVIDER_ID
  readonly capabilities = FAKE_CAPABILITIES
  ultimaInstruccion: string | null = null
  async send(request: AIRequest): Promise<AIResponse> {
    this.ultimaInstruccion = (request.metadata as { systemInstruction?: string } | undefined)?.systemInstruction ?? null
    return { requestId: request.id, providerId: this.id, model: 'fake-model', content: '{"tipoRespuesta":"conversacional","mensaje":"ok","operaciones":[]}' }
  }
}

async function instruccionCon(ahora: Date): Promise<string> {
  vi.setSystemTime(ahora)
  const orchestrator = new AIOrchestrator()
  const provider = new FakeProvider()
  orchestrator.registerAgent(taskManagementAgent)
  orchestrator.providers.register(provider)
  await orchestrator.execute(TASK_MANAGEMENT_AGENT_ID, { id: createId('req'), agentId: TASK_MANAGEMENT_AGENT_ID, userId: 'user-1', input: 'algo' }, testContext)
  return provider.ultimaInstruccion ?? ''
}

// Ajuste (post 7.5) Parte 1-bis — reporte real del usuario: pidió una tarea
// "para mañana" el 27, con el horario completamente vacío (así que no podía
// ser el bug de horario del ajuste anterior), y el sistema guardó el 29 en
// vez del 28 — un salto de +2, no +1. Causa raíz: TaskManagementAgent
// calculaba la fecha de referencia con `new Date().toISOString().slice(0,10)`
// (fecha UTC), no la fecha LOCAL del estudiante (Bogotá, UTC-5). Cerca de
// medianoche eso hace que la fecha UTC YA sea el día siguiente — el modelo
// recibía "hoy es 28" (siendo 27 en Bogotá) y calculaba correctamente
// "mañana" = 29 respecto a ESA fecha ya corrida. El bug no estaba en cómo
// el modelo interpreta "mañana" (eso ya se había probado extensamente en
// el ajuste anterior) sino en qué fecha de referencia recibía.
describe('TaskManagementAgent — fecha de referencia en zona horaria, no UTC', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('caso reportado: a las 23:30 hora de Bogotá del 27, la fecha de hoy en el prompt sigue siendo 27, no 28', async () => {
    // 2026-07-27T23:30:00 en Bogotá (UTC-5) = 2026-07-28T04:30:00Z.
    // Con el bug (.toISOString() cruda) el prompt habría dicho "2026-07-28".
    const instruccion = await instruccionCon(new Date('2026-07-28T04:30:00.000Z'))
    expect(instruccion).toContain('La fecha de hoy es 2026-07-27')
    expect(instruccion).not.toContain('2026-07-28')
  })

  it('a mediodía en Bogotá, UTC y local coinciden — sigue funcionando igual que antes', async () => {
    // 2026-07-27T12:00:00 en Bogotá (UTC-5) = 2026-07-27T17:00:00Z.
    const instruccion = await instruccionCon(new Date('2026-07-27T17:00:00.000Z'))
    expect(instruccion).toContain('La fecha de hoy es 2026-07-27')
  })

  it('justo después de medianoche en Bogotá (00:05 del 28) — ya es 28 en ambas', async () => {
    // 2026-07-28T00:05:00 en Bogotá (UTC-5) = 2026-07-28T05:05:00Z.
    const instruccion = await instruccionCon(new Date('2026-07-28T05:05:00.000Z'))
    expect(instruccion).toContain('La fecha de hoy es 2026-07-28')
  })
})
