import { describe, expect, it } from 'vitest'
import { AIOrchestrator } from '@/lib/ai/orchestrator'
import { createId } from '@/lib/ai/utils'
import type { AIContext, AIProvider, AIProviderCapabilities, AIRequest, AIResponse } from '@/lib/ai/types'
import { GEMINI_PROVIDER_ID } from '@/lib/ai/providers/gemini'
import { ICONO_MATERIA_AGENT_ID, iconoMateriaAgent, type IconoMateriaAgentOutput } from '../index'

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
  constructor(private readonly content: string) {}
  async send(request: AIRequest): Promise<AIResponse> {
    return { requestId: request.id, providerId: this.id, model: 'fake-model', content: this.content }
  }
}

async function ejecutar(nombreMateria: string, content: string) {
  const orchestrator = new AIOrchestrator()
  orchestrator.registerAgent(iconoMateriaAgent)
  orchestrator.providers.register(new FakeProvider(content))
  return orchestrator.execute<IconoMateriaAgentOutput>(
    ICONO_MATERIA_AGENT_ID,
    { id: createId('req'), agentId: ICONO_MATERIA_AGENT_ID, userId: 'user-1', input: nombreMateria },
    testContext
  )
}

describe('IconoMateriaAgent — respaldo de IA, nunca debe poder tumbar la creación de una materia', () => {
  it('devuelve el ícono que el modelo eligió, si es uno válido', async () => {
    const resultado = await ejecutar('Robótica Aplicada', JSON.stringify({ icono: 'Laptop' }))
    expect(resultado.status).toBe('success')
    expect(resultado.output?.icono).toBe('Laptop')
    expect(resultado.output?.nombreMateria).toBe('Robótica Aplicada')
  })

  it('el modelo eligió un ícono fuera del enum cerrado → cae al respaldo neutro, no lanza', async () => {
    const resultado = await ejecutar('Materia Rara', JSON.stringify({ icono: 'Rocket' }))
    expect(resultado.status).toBe('success')
    expect(resultado.output?.icono).toBe('GraduationCap')
  })

  it('respuesta no es JSON válido → cae al respaldo neutro, no lanza', async () => {
    const resultado = await ejecutar('Materia Rara', 'esto no es json')
    expect(resultado.status).toBe('success')
    expect(resultado.output?.icono).toBe('GraduationCap')
  })

  it('respuesta es un objeto sin la clave "icono" → cae al respaldo neutro', async () => {
    const resultado = await ejecutar('Materia Rara', JSON.stringify({ otraCosa: 'x' }))
    expect(resultado.status).toBe('success')
    expect(resultado.output?.icono).toBe('GraduationCap')
  })

  it('nombre de materia vacío → error de validación (nunca se llama sin nombre)', async () => {
    const resultado = await ejecutar('', JSON.stringify({ icono: 'Laptop' }))
    expect(resultado.status).toBe('error')
  })
})
