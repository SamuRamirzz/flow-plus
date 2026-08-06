import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AIOrchestrator } from '@/lib/ai/orchestrator'
import { createId } from '@/lib/ai/utils'
import type { AIContext, AIProvider, AIProviderCapabilities, AIRequest, AIResponse } from '@/lib/ai/types'
import { GEMINI_PROVIDER_ID } from '@/lib/ai/providers/gemini'
import { HOMEWORK_AGENT_ID, HOMEWORK_AGENT_TRIGGER_EVENT, homeworkAgent, type HomeworkAgentOutput } from '../index'

const testContext: AIContext = { userId: 'user-1', generatedAt: Date.now() }

const FAKE_CAPABILITIES: AIProviderCapabilities = {
  supportsVision: false,
  supportsStructuredOutput: true,
  supportsStreaming: false,
  supportsBatch: false,
  supportsPromptCaching: false,
}

// Doble de prueba de AIProvider — nunca llama a la red real. HomeworkAgent
// no sabe ni le importa si el proveedor es Gemini de verdad o este fake:
// solo conoce la interfaz AIProvider, que es exactamente lo que se prueba.
class FakeProvider implements AIProvider {
  readonly id = GEMINI_PROVIDER_ID
  readonly capabilities = FAKE_CAPABILITIES
  /** Última instrucción de sistema recibida — permite afirmar QUÉ se le
   *  mandó al modelo, no solo qué devolvió (Sprint 9). */
  ultimaInstruccion: string | null = null
  constructor(private readonly content: string | (() => string)) {}

  async send(request: AIRequest): Promise<AIResponse> {
    const content = typeof this.content === 'function' ? this.content() : this.content
    this.ultimaInstruccion = (request.metadata as { systemInstruction?: string } | undefined)?.systemInstruction ?? null
    return { requestId: request.id, providerId: this.id, model: 'fake-model', content }
  }
}

function respuestaValida() {
  return JSON.stringify({
    tareas: [
      {
        titulo: 'Resolver ejercicios 5 al 12',
        materia: 'Matemáticas',
        fecha: '2026-08-14',
        prioridad: 'media',
        tipo: 'ejercicios',
        confidence: 0.9,
      },
      {
        titulo: 'Estudiar para el examen',
        materia: 'Historia',
        fecha: '2026-08-17',
        prioridad: 'alta',
        tipo: 'examen',
        confidence: 0.85,
      },
    ],
  })
}

describe('HomeworkAgent + AIOrchestrator + GeminiProvider (fake)', () => {
  let orchestrator: AIOrchestrator

  beforeEach(() => {
    orchestrator = new AIOrchestrator()
  })

  it('se registra en el AgentRegistry a través del orchestrator', () => {
    orchestrator.registerAgent(homeworkAgent)
    expect(orchestrator.getAgent(HOMEWORK_AGENT_ID)).toBe(homeworkAgent)
  })

  it('el orchestrator lo encuentra vía dispatch() por su evento disparador', () => {
    orchestrator.registerAgent(homeworkAgent)

    const found = orchestrator.dispatch({
      id: createId('evt'),
      type: HOMEWORK_AGENT_TRIGGER_EVENT,
      userId: 'user-1',
      payload: {},
      occurredAt: Date.now(),
    })

    expect(found).toHaveLength(1)
    expect(found[0].definition.id).toBe(HOMEWORK_AGENT_ID)
  })

  it('execute() sin proveedor registrado resuelve como error AI_PROVIDER_NOT_FOUND, sin lanzar', async () => {
    orchestrator.registerAgent(homeworkAgent)

    const result = await orchestrator.execute(
      HOMEWORK_AGENT_ID,
      { id: createId('req'), agentId: HOMEWORK_AGENT_ID, userId: 'user-1', input: 'texto' },
      testContext
    )

    expect(result.status).toBe('error')
    expect(result.error?.code).toBe('AI_PROVIDER_NOT_FOUND')
  })

  it('execute() con un proveedor que devuelve JSON válido produce tareas estructuradas', async () => {
    orchestrator.registerAgent(homeworkAgent)
    orchestrator.providers.register(new FakeProvider(respuestaValida()))

    const result = await orchestrator.execute<HomeworkAgentOutput>(
      HOMEWORK_AGENT_ID,
      {
        id: createId('req'),
        agentId: HOMEWORK_AGENT_ID,
        userId: 'user-1',
        input: 'Para el viernes resolver los ejercicios 5 al 12 de matemáticas y estudiar para el examen del lunes.',
      },
      testContext
    )

    expect(result.status).toBe('success')
    expect(result.output?.tareas).toHaveLength(2)
    expect(result.output?.tareas[0].materia).toBe('Matemáticas')
    expect(result.output?.tareas[0].id).toBeTruthy()
    expect(result.output?.tareas[1].prioridad).toBe('alta')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('normaliza campos "" del modelo a null en vez de dejarlos como cadena vacía', async () => {
    orchestrator.registerAgent(homeworkAgent)
    orchestrator.providers.register(
      new FakeProvider(
        JSON.stringify({
          tareas: [{ titulo: 'Leer capítulo 2', materia: '', fecha: '', prioridad: 'baja', tipo: 'lectura', confidence: 0.4 }],
        })
      )
    )

    const result = await orchestrator.execute<HomeworkAgentOutput>(
      HOMEWORK_AGENT_ID,
      { id: createId('req'), agentId: HOMEWORK_AGENT_ID, userId: 'user-1', input: 'Leer capítulo 2 cuando pueda.' },
      testContext
    )

    expect(result.status).toBe('success')
    expect(result.output?.tareas[0].materia).toBeNull()
    expect(result.output?.tareas[0].fecha).toBeNull()
  })

  it('con JSON inválido del proveedor resuelve como AgentResult de error, sin lanzar', async () => {
    orchestrator.registerAgent(homeworkAgent)
    orchestrator.providers.register(new FakeProvider('esto no es JSON'))

    const result = await orchestrator.execute(
      HOMEWORK_AGENT_ID,
      { id: createId('req'), agentId: HOMEWORK_AGENT_ID, userId: 'user-1', input: 'texto cualquiera' },
      testContext
    )

    expect(result.status).toBe('error')
    expect(result.error?.code).toBe('AI_VALIDATION_ERROR')
  })

  it('con texto vacío resuelve como error sin siquiera llamar al proveedor', async () => {
    orchestrator.registerAgent(homeworkAgent)
    orchestrator.providers.register(new FakeProvider(respuestaValida()))

    const result = await orchestrator.execute(
      HOMEWORK_AGENT_ID,
      { id: createId('req'), agentId: HOMEWORK_AGENT_ID, userId: 'user-1', input: '' },
      testContext
    )

    expect(result.status).toBe('error')
    expect(result.error?.code).toBe('AI_VALIDATION_ERROR')
  })

  it('el flujo completo — registrar, inicializar, ejecutar — no lanza excepciones', async () => {
    orchestrator.registerAgent(homeworkAgent)
    orchestrator.providers.register(new FakeProvider(respuestaValida()))
    await orchestrator.initialize()

    await expect(
      orchestrator.execute(
        HOMEWORK_AGENT_ID,
        { id: createId('req'), agentId: HOMEWORK_AGENT_ID, userId: 'user-1', input: 'Leer el capítulo 3 de historia para el martes.' },
        testContext
      )
    ).resolves.toBeDefined()

    expect(orchestrator.health().agents).toBe(1)
    expect(orchestrator.health().initialized).toBe(true)
  })
})

// Sprint 9 — el agente deja de llamar a new Date() y de ignorar las
// materias del usuario: ambas cosas llegan por el AIContext.
describe('HomeworkAgent usa el contexto real (Sprint 9)', () => {
  function contextoCon(schedule?: Record<string, unknown>, identity?: Record<string, unknown>): AIContext {
    return { userId: 'user-1', generatedAt: Date.now(), ...(schedule ? { schedule } : {}), ...(identity ? { identity } : {}) }
  }

  async function ejecutarCon(context: AIContext) {
    const orchestrator = new AIOrchestrator()
    const provider = new FakeProvider(respuestaValida())
    orchestrator.registerAgent(homeworkAgent)
    orchestrator.providers.register(provider)
    await orchestrator.execute(
      HOMEWORK_AGENT_ID,
      { id: createId('req'), agentId: HOMEWORK_AGENT_ID, userId: 'user-1', input: 'algo para el viernes' },
      context
    )
    return provider.ultimaInstruccion ?? ''
  }

  it('declara los scopes que necesita', () => {
    // Sprint Archivos / Fase 5.3 agregó 'conversationHistory'.
    expect(homeworkAgent.definition.contextScopes).toEqual(['schedule', 'identity', 'conversationHistory'])
  })

  it('usa context.schedule.hoy como fecha de referencia, no el reloj del proceso', async () => {
    const instruccion = await ejecutarCon(contextoCon({ hoy: '2020-01-15' }))
    expect(instruccion).toContain('2020-01-15')
  })

  it('incluye las materias que el usuario ya tiene, para no duplicarlas', async () => {
    const instruccion = await ejecutarCon(contextoCon({ hoy: '2026-07-28' }, { nombresDeMateria: ['Cálculo II', 'Física I'] }))
    expect(instruccion).toContain('Cálculo II')
    expect(instruccion).toContain('Física I')
    expect(instruccion).toMatch(/no se cree una materia duplicada/i)
  })

  it('sin materias conocidas no inventa esa sección del prompt', async () => {
    const instruccion = await ejecutarCon(contextoCon({ hoy: '2026-07-28' }, { nombresDeMateria: [] }))
    expect(instruccion).not.toMatch(/YA tiene registradas/i)
  })

  it('con un contexto mínimo degrada al reloj del proceso en vez de romper', async () => {
    const instruccion = await ejecutarCon({ userId: 'user-1', generatedAt: Date.now() })
    expect(instruccion).toMatch(/La fecha de hoy es \d{4}-\d{2}-\d{2}/)
  })

  // Ajuste (post 7.5) Parte 1-bis — el fallback de fechaDeReferencia también
  // usaba `.toISOString()` (UTC) en vez de la zona horaria por defecto,
  // mismo bug que se reprodujo y corrigió en TaskManagementAgent. En uso
  // normal HomeworkAgent recibe context.schedule.hoy y nunca pisa este
  // fallback, pero si algún llamador lo ejecuta con contexto mínimo, no
  // debe reintroducir el desfase de medianoche.
  describe('fallback sin contexto — misma corrección de zona horaria', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('a las 23:30 hora de Bogotá del 27, sigue siendo 27 (no 28) aunque no haya context.schedule', async () => {
      vi.setSystemTime(new Date('2026-07-28T04:30:00.000Z')) // 2026-07-27T23:30:00-05:00
      const instruccion = await ejecutarCon({ userId: 'user-1', generatedAt: Date.now() })
      expect(instruccion).toContain('La fecha de hoy es 2026-07-27')
    })
  })

  it('ignora un hoy con formato inválido en vez de pasárselo al modelo', async () => {
    const instruccion = await ejecutarCon(contextoCon({ hoy: 'el martes' }))
    expect(instruccion).not.toContain('el martes')
    expect(instruccion).toMatch(/La fecha de hoy es \d{4}-\d{2}-\d{2}/)
  })
})
