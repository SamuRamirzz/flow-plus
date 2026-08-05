import type { AIProvider, AIProviderId } from '@/lib/ai/types'
import { AIConfigError } from '@/lib/ai/errors'

// Registro de proveedores de modelo (Claude/OpenAI/Gemini/...). Ninguno
// implementado todavía — ver docs/ai-architecture/06-modelos-hibridos.md.
// Un proveedor nuevo se agrega con register(), sin tocar este archivo.
export class ProviderRegistry {
  private readonly providers = new Map<AIProviderId, AIProvider>()

  register(provider: AIProvider): void {
    if (this.providers.has(provider.id)) {
      throw new AIConfigError(`El proveedor "${provider.id}" ya está registrado`)
    }
    this.providers.set(provider.id, provider)
  }

  unregister(providerId: AIProviderId): void {
    this.providers.delete(providerId)
  }

  get(providerId: AIProviderId): AIProvider | undefined {
    return this.providers.get(providerId)
  }

  has(providerId: AIProviderId): boolean {
    return this.providers.has(providerId)
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values())
  }

  get size(): number {
    return this.providers.size
  }
}
