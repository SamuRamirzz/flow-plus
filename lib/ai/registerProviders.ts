import { aiOrchestrator } from './orchestrator'
import { aiConfig } from './config'
import { GeminiProvider, GEMINI_PROVIDER_ID } from './providers/gemini'

let registered = false

// Análogo a registerAgents.ts pero para proveedores — añadir uno nuevo
// (Claude, OpenAI...) es registrarlo aquí, nunca tocar ProviderRegistry.
export function registerProviders(): void {
  if (registered) return
  registered = true

  if (!aiOrchestrator.providers.has(GEMINI_PROVIDER_ID)) {
    aiOrchestrator.providers.register(new GeminiProvider(aiConfig.geminiApiKey))
  }
}
