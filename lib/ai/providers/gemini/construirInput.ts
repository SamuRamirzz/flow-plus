import type { JSONSchema } from '@/lib/ai/types'

// Contrato propio (no el shape interno del SDK) para que un agente diga
// "quién dijo qué" y "con qué adjuntos", sin conocer la API de Gemini.
// Sprint 7.2 introdujo los turnos; Sprint 8 añade los adjuntos.
export type ConversationTurnInput = { rol: 'usuario' | 'modelo'; texto: string }

// Sprint 8 — visión. `datosBase64` sin el prefijo `data:` (solo la carga).
export type AdjuntoIA = { tipo: 'imagen' | 'documento'; datosBase64: string; mimeType: string }

export type StructuredProviderMetadata = {
  systemInstruction?: string
  outputSchema?: JSONSchema
  /** Sprint 8: adjuntos del ÚLTIMO turno de usuario (la foto que se sube). */
  adjuntos?: AdjuntoIA[]
  /** Sprint 8: modelo por llamada. Sin esto, todo agente recibía el modelo
   *  ligero fijo del módulo y `definition.defaultModel` era metadata muerta
   *  que nadie leía. */
  model?: string
}

// --- Shapes reales del SDK (@google/genai), verificados en genai.d.ts ---
// `InteractionsInput = string | Array<Step> | Array<Content_2> | ...`
// `UserInputStep  = { type: 'user_input',  content?: Array<Content_2> }`
// `ModelOutputStep = { type: 'model_output', content?: Array<Content_2> }`
// `Content_2 = TextContent | ImageContent | DocumentContent | ...`
// `TextContent  = { type: 'text',  text: string }`
// `ImageContent = { type: 'image', data?: string, mime_type?: string, uri?: string }`
// `Turn` (el shape con `role`) está marcado @deprecated — no se usa.
type ParteTexto = { type: 'text'; text: string }
type ParteImagen = { type: 'image'; mime_type: string; data: string }
type ParteDocumento = { type: 'document'; mime_type: string; data: string }
type Parte = ParteTexto | ParteImagen | ParteDocumento

export type PasoGemini = { type: 'user_input' | 'model_output'; content: Parte[] }

/** Lo que acepta `interactions.create({ input })`: string simple o pasos. */
export type InputGemini = string | PasoGemini[]

// Sprint 8 (ClassScheduleAgent) tenía su propia copia privada de esto;
// Sub-sprint 7.3 (TaskManagementAgent) la necesita también — se extrae acá,
// junto al tipo que valida, para que ningún agente la reimplemente.
export function normalizarAdjuntos(metadata: Record<string, unknown> | undefined): AdjuntoIA[] {
  const lista = metadata?.adjuntos
  if (!Array.isArray(lista)) return []
  return lista.filter(
    (a): a is AdjuntoIA =>
      typeof a === 'object' &&
      a !== null &&
      ((a as AdjuntoIA).tipo === 'imagen' || (a as AdjuntoIA).tipo === 'documento') &&
      typeof (a as AdjuntoIA).datosBase64 === 'string' &&
      (a as AdjuntoIA).datosBase64.length > 0 &&
      typeof (a as AdjuntoIA).mimeType === 'string'
  )
}

export function esConversacion(input: unknown): input is ConversationTurnInput[] {
  return (
    Array.isArray(input) &&
    input.length > 0 &&
    input.every(
      (t) =>
        typeof t === 'object' &&
        t !== null &&
        (t as ConversationTurnInput).rol !== undefined &&
        typeof (t as ConversationTurnInput).texto === 'string'
    )
  )
}

function parteDeAdjunto(adjunto: AdjuntoIA): ParteImagen | ParteDocumento {
  return adjunto.tipo === 'imagen'
    ? { type: 'image', mime_type: adjunto.mimeType, data: adjunto.datosBase64 }
    : { type: 'document', mime_type: adjunto.mimeType, data: adjunto.datosBase64 }
}

// PURO: traduce (input del agente + adjuntos) a la forma que entiende la
// Interactions API. Sin I/O, sin Date.now() — testeable sin red.
//
// Propiedad de seguridad deliberada (misma que se pactó al añadir turnos):
// SIN adjuntos, la salida es byte-idéntica a la de antes de este sprint —
// un string sigue saliendo como string, una conversación sigue saliendo
// como los mismos pasos. Solo cuando hay adjuntos cambia algo, y el cambio
// se limita a añadir partes al ÚLTIMO turno de usuario (que es el mensaje
// al que la foto acompaña; adjuntarla a un turno viejo confundiría al
// modelo sobre a qué mensaje pertenece).
export function construirInput(input: unknown, adjuntos?: AdjuntoIA[]): InputGemini {
  const partesAdjuntas = (adjuntos ?? []).map(parteDeAdjunto)

  if (esConversacion(input)) {
    const pasos: PasoGemini[] = input.map((t) => ({
      type: t.rol === 'usuario' ? ('user_input' as const) : ('model_output' as const),
      content: [{ type: 'text' as const, text: t.texto }],
    }))
    if (partesAdjuntas.length === 0) return pasos

    const idxUltimoUsuario = pasos.map((p) => p.type).lastIndexOf('user_input')
    if (idxUltimoUsuario === -1) {
      return [...pasos, { type: 'user_input', content: partesAdjuntas }]
    }
    return pasos.map((p, i) => (i === idxUltimoUsuario ? { ...p, content: [...p.content, ...partesAdjuntas] } : p))
  }

  const texto = typeof input === 'string' ? input : JSON.stringify(input)
  if (partesAdjuntas.length === 0) return texto
  return [{ type: 'user_input', content: [{ type: 'text', text: texto }, ...partesAdjuntas] }]
}
