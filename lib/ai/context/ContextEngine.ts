import type { AIContext, AIContextScope, ContextRequest } from '@/lib/ai/types'
import { AINotImplementedError } from '@/lib/ai/errors'
import { loadersPorDefecto, type LoadersPorScope } from './loaders'

// Ensambla el AIContext que el Orchestrator entrega a cada agente
// (docs/ai-architecture/05-contexto-y-memoria.md). Desde el Sprint 9 ya no
// es un stub: carga de verdad los scopes que el agente declara en
// `definition.contextScopes`.
//
// Los loaders se inyectan (mismo patrón que las dependencias de
// AIOrchestrator) para poder probar esta clase con dobles y sin red.
//
// Se conserva la propiedad deliberada del stub anterior — "fallar fuerte,
// no fingir contexto vacío" — pero acotada al scope concreto: pedir un
// scope sin loader lanza AINotImplementedError, mientras que los scopes
// implementados se cargan normalmente. Antes fallaba la construcción
// entera aunque no se pidiera nada.
export class ContextEngine {
  constructor(private readonly loaders: LoadersPorScope = loadersPorDefecto) {}

  /** Scopes que hoy sí se pueden cargar — lo usa GET /api/ai/health. */
  scopesDisponibles(): AIContextScope[] {
    return Object.keys(this.loaders) as AIContextScope[]
  }

  async build(request: ContextRequest): Promise<AIContext> {
    const contexto: AIContext = { userId: request.userId, generatedAt: Date.now() }

    // Sin scopes pedidos NO se lanza: un agente que no declara
    // `contextScopes` legítimamente no necesita contexto, y devolverle
    // { userId, generatedAt } es la respuesta correcta. (El stub anterior
    // lanzaba siempre; se verificó que ningún llamador dependía de eso —
    // los cuatro Route Handlers y todos los tests pasaban su propio
    // contexto, así que esta rama nunca llegaba a ejecutarse.)
    if (request.scopes.length === 0) return contexto

    // Sin duplicados: dos agentes encadenados podrían pedir el mismo scope
    // y no tiene sentido consultarlo dos veces.
    const scopes = [...new Set(request.scopes)]

    const faltantes = scopes.filter((s) => !this.loaders[s])
    if (faltantes.length > 0) {
      throw new AINotImplementedError(
        `ContextEngine no tiene loader para el scope "${faltantes.join('", "')}" (userId="${request.userId}"). ` +
          `Scopes disponibles: ${this.scopesDisponibles().join(', ')}. Ver docs/ai-architecture/05-contexto-y-memoria.md.`
      )
    }

    // En paralelo: los scopes son independientes entre sí y encadenarlos
    // sumaría latencia a cada ejecución de agente sin ganar nada.
    const cargados = await Promise.all(
      scopes.map(async (scope) => [scope, await this.loaders[scope]!(request.userId)] as const)
    )

    for (const [scope, datos] of cargados) {
      contexto[scope] = datos
    }
    return contexto
  }
}
