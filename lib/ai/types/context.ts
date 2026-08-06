// Sprint Archivos / Fase 5.3 — 'conversationHistory' se agregó a esta unión
// cerrada (único lugar donde se toca). Distinto de 'academic' (notas
// ancladas a tareas, Fase 4.3): esto es el historial de CONVERSACIONES
// pasadas con la IA, no contenido académico del usuario.
export type AIContextScope = 'identity' | 'schedule' | 'operational' | 'habits' | 'academic' | 'conversationHistory'

// Cada categoría queda como Record<string, unknown> a propósito: el modelo
// de datos real (materias, horario, memoria) todavía no existe — se define
// cuando la Fase 2 del roadmap (docs/ai-architecture) conecte fuentes reales.
export type AIContext = {
  userId: string
  generatedAt: number
  identity?: Record<string, unknown>
  schedule?: Record<string, unknown>
  operational?: Record<string, unknown>
  habits?: Record<string, unknown>
  academic?: Record<string, unknown>
  conversationHistory?: Record<string, unknown>
}

export type ContextRequest = {
  userId: string
  scopes: AIContextScope[]
}
