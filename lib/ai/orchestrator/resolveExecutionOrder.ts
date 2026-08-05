import type { AIAgentDefinition } from '@/lib/ai/types'
import { AIConfigError } from '@/lib/ai/errors'

// Orden topológico por dependsOn (docs/ai-architecture/02-orchestrator.md
// §4.2.1 — ej. OCR Agent → Homework Agent → Calendar Agent). Ignora
// dependencias que no estén en el propio lote de definiciones: se asume
// que ya se resolvieron en una etapa anterior.
export function resolveExecutionOrder(definitions: AIAgentDefinition[]): AIAgentDefinition[] {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const ordered: AIAgentDefinition[] = []

  function visit(id: string): void {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      throw new AIConfigError(`Dependencia circular detectada en el agente "${id}"`)
    }
    const definition = byId.get(id)
    if (!definition) return

    visiting.add(id)
    for (const dependencyId of definition.dependsOn ?? []) visit(dependencyId)
    visiting.delete(id)

    visited.add(id)
    ordered.push(definition)
  }

  for (const definition of definitions) visit(definition.id)
  return ordered
}
