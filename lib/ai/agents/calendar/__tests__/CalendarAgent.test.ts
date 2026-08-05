import { describe, expect, it } from 'vitest'
import { createId } from '@/lib/ai/utils'
import type { AIContext, AIProvider, AIProviderCapabilities, AIRequest, AIResponse } from '@/lib/ai/types'
import { GEMINI_PROVIDER_ID } from '@/lib/ai/providers/gemini'
import { calendarAgent } from '../CalendarAgent'
import type { MateriaParaComparar } from '../types'

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

function peticion(nombreNuevo: string, existentes: MateriaParaComparar[]): AIRequest {
  return { id: createId('req'), agentId: 'calendar-agent', userId: 'user-1', input: { nombreNuevo, existentes } }
}

const EXISTENTES: MateriaParaComparar[] = [
  { id: 'm1', nombre: 'Cálculo II' },
  { id: 'm2', nombre: 'Física I' },
]

describe('CalendarAgent — sin materias existentes', () => {
  it('no llama al modelo y devuelve "sin duplicado" — es el caso normal de la primera materia', async () => {
    const proveedor = new FakeProvider('{}')
    const r = await calendarAgent.run(peticion('Química', []), testContext, proveedor)
    expect(r.status).toBe('success')
    expect(r.output).toEqual({ hayDuplicado: false, materiaExistente: null, confianza: 0 })
    expect(proveedor.ultimaInstruccion).toBeNull()
  })
})

describe('CalendarAgent — con materias existentes', () => {
  it('detecta un duplicado y resuelve el id real contra la lista mandada', async () => {
    const proveedor = new FakeProvider(JSON.stringify({ hayDuplicado: true, nombreExistente: 'Cálculo II', confianza: 0.9 }))
    const r = await calendarAgent.run(peticion('Calculo 2', EXISTENTES), testContext, proveedor)
    expect(r.status).toBe('success')
    expect(r.output).toEqual({ hayDuplicado: true, materiaExistente: { id: 'm1', nombre: 'Cálculo II' }, confianza: 0.9 })
    expect(r.confidence).toBe(0.9)
  })

  it('la instrucción de sistema incluye los nombres de todas las existentes', async () => {
    const proveedor = new FakeProvider(JSON.stringify({ hayDuplicado: false, nombreExistente: '', confianza: 0 }))
    await calendarAgent.run(peticion('Química', EXISTENTES), testContext, proveedor)
    expect(proveedor.ultimaInstruccion).toContain('Cálculo II')
    expect(proveedor.ultimaInstruccion).toContain('Física I')
  })

  it('manda el NOMBRE (no el objeto de input) como input real al proveedor', async () => {
    const proveedor = new FakeProvider(JSON.stringify({ hayDuplicado: false, nombreExistente: '', confianza: 0 }))
    await calendarAgent.run(peticion('Química Orgánica', EXISTENTES), testContext, proveedor)
    expect(proveedor.ultimoInput).toBe('Química Orgánica')
  })

  it('sin duplicado real, devuelve confianza 0 y materiaExistente null', async () => {
    const proveedor = new FakeProvider(JSON.stringify({ hayDuplicado: false, nombreExistente: '', confianza: 0 }))
    const r = await calendarAgent.run(peticion('Historia del Arte', EXISTENTES), testContext, proveedor)
    expect(r.output).toEqual({ hayDuplicado: false, materiaExistente: null, confianza: 0 })
  })

  it('un nombreExistente alucinado (no está en la lista real) se trata como "sin duplicado"', async () => {
    const proveedor = new FakeProvider(JSON.stringify({ hayDuplicado: true, nombreExistente: 'Materia Que No Existe', confianza: 0.9 }))
    const r = await calendarAgent.run(peticion('Algo', EXISTENTES), testContext, proveedor)
    expect(r.output).toEqual({ hayDuplicado: false, materiaExistente: null, confianza: 0 })
  })

  it('JSON inválido del modelo nunca lanza, resuelve a "sin duplicado"', async () => {
    const proveedor = new FakeProvider('esto no es JSON')
    const r = await calendarAgent.run(peticion('Química', EXISTENTES), testContext, proveedor)
    expect(r.status).toBe('success')
    expect(r.output).toEqual({ hayDuplicado: false, materiaExistente: null, confianza: 0 })
  })
})

describe('CalendarAgent — definición', () => {
  it('no pide contextScopes — recibe todo por request.input', () => {
    expect(calendarAgent.definition.contextScopes).toEqual([])
  })

  it('usa el modelo ligero', () => {
    expect(calendarAgent.definition.defaultModel).toBeTruthy()
  })

  it('nunca actúa solo: requiere confirmación del usuario', () => {
    expect(calendarAgent.definition.autonomyLevel).toBe('suggested_confirmation_required')
  })
})
