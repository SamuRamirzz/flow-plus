import type { JSONSchema, OutputParser, ParseResult } from '@/lib/ai/types'
import { createId } from '@/lib/ai/utils'
import type { DetectedTask, HomeworkPriority, HomeworkTaskType, TipoRespuestaHomework } from './types'

const PRIORIDADES: HomeworkPriority[] = ['baja', 'media', 'alta']
const TIPOS: HomeworkTaskType[] = ['ejercicios', 'examen', 'ensayo', 'lectura', 'proyecto', 'otro']
const TIPOS_RESPUESTA: TipoRespuestaHomework[] = ['tareas', 'ambiguo', 'conversacional']

// JSON Schema forzado vía response_format en GeminiProvider — Gemini nunca
// puede devolver texto libre, solo un objeto que cumpla esta forma. materia
// y fecha son string (nunca null): "no todos los campos de JSON Schema son
// soportados" según la documentación de Gemini, así que se evita el patrón
// ['string','null'] y en su lugar se instruye devolver "" cuando no aplica
// — HomeworkOutputParser normaliza "" a null después.
export const HOMEWORK_OUTPUT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    tipoRespuesta: {
      type: 'string',
      enum: TIPOS_RESPUESTA,
      description:
        '"tareas" si detectaste al menos una tarea académica en el texto; "ambiguo" si el usuario intentaba describir una tarea pero no diste con nada útil; "conversacional" si el texto no era un intento de describir una tarea (saludo, pregunta, charla).',
    },
    mensaje: {
      type: 'string',
      description:
        'Solo cuando tipoRespuesta es "conversacional": una respuesta breve y natural, aclarando que tu función principal es ayudar con tareas académicas, sin sonar a error. Cadena vacía en cualquier otro caso.',
    },
    tareas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título breve y claro de la tarea, en español' },
          materia: {
            type: 'string',
            description: 'Nombre de la materia si se menciona o se puede inferir con confianza; cadena vacía si no',
          },
          fecha: {
            type: 'string',
            description:
              'Fecha de entrega en formato YYYY-MM-DD, resolviendo fechas relativas ("el viernes") contra la fecha de referencia dada; cadena vacía si no se menciona ninguna fecha',
          },
          prioridad: { type: 'string', enum: PRIORIDADES },
          tipo: { type: 'string', enum: TIPOS },
          confidence: { type: 'number', description: 'Confianza de 0 a 1 en esta extracción específica' },
        },
        required: ['titulo', 'materia', 'fecha', 'prioridad', 'tipo', 'confidence'],
      },
    },
  },
  required: ['tipoRespuesta', 'mensaje', 'tareas'],
}

export type HomeworkParsedOutput = { tipoRespuesta: TipoRespuestaHomework; mensaje: string | null; tareas: DetectedTask[] }

function normalizar(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  return limpio.length > 0 ? limpio : null
}

function clamp01(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(n)) return 0.5
  return Math.min(1, Math.max(0, n))
}

// Primera implementación real de la interfaz OutputParser (lib/ai/types/
// parser.ts) — hasta ahora era solo contrato. Valida en tiempo de ejecución
// lo que Gemini devuelve: aunque response_format fuerza JSON válido a nivel
// de sintaxis, no garantiza que cada campo tenga el tipo/valor esperado, y
// el texto puede no ser JSON en absoluto si Gemini se desvía. Nunca lanza —
// devuelve ParseResult para que el agente decida qué hacer con un fallo.
export class HomeworkOutputParser implements OutputParser<HomeworkParsedOutput> {
  parse(raw: unknown): ParseResult<HomeworkParsedOutput> {
    if (typeof raw !== 'string') {
      return { ok: false, error: 'La respuesta del proveedor no es texto' }
    }

    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'La respuesta del proveedor no es JSON válido' }
    }

    if (typeof json !== 'object' || json === null) {
      return { ok: false, error: 'La respuesta no es un objeto JSON' }
    }

    const obj = json as Record<string, unknown>
    const tareasRaw = obj.tareas

    const tareas: DetectedTask[] = []
    if (Array.isArray(tareasRaw)) {
      for (const item of tareasRaw) {
        if (typeof item !== 'object' || item === null) continue
        const t = item as Record<string, unknown>
        const titulo = typeof t.titulo === 'string' ? t.titulo.trim() : ''
        if (!titulo) continue

        const prioridad = PRIORIDADES.includes(t.prioridad as HomeworkPriority) ? (t.prioridad as HomeworkPriority) : 'media'
        const tipo = TIPOS.includes(t.tipo as HomeworkTaskType) ? (t.tipo as HomeworkTaskType) : 'otro'

        tareas.push({
          id: createId('task'),
          titulo,
          materia: normalizar(t.materia),
          fecha: normalizar(t.fecha),
          prioridad,
          tipo,
          confidence: clamp01(t.confidence),
        })
      }
    }

    // El modelo debería declarar tipoRespuesta siempre (está en `required`
    // del schema), pero si se desvía o lo omite, se infiere de la forma más
    // segura posible en vez de fallar: hay tareas → 'tareas'; si no, 'ambiguo'
    // (el comportamiento previo a este cambio, nunca 'conversacional' por
    // inferencia — ese caso solo lo declara el modelo explícitamente).
    const tipoDeclarado = obj.tipoRespuesta
    const tipoRespuesta: TipoRespuestaHomework = TIPOS_RESPUESTA.includes(tipoDeclarado as TipoRespuestaHomework)
      ? (tipoDeclarado as TipoRespuestaHomework)
      : tareas.length > 0
        ? 'tareas'
        : 'ambiguo'

    return { ok: true, data: { tipoRespuesta, mensaje: normalizar(obj.mensaje), tareas } }
  }
}
