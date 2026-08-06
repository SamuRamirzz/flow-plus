import type { JSONSchema, OutputParser, ParseResult } from '@/lib/ai/types'
import { createId } from '@/lib/ai/utils'
import type { DetectedTask, HomeworkPriority, HomeworkTaskType } from '../homework/types'
import { TIPOS_DOCUMENTO, type AnalisisArchivoAgentOutput, type TipoDocumento } from './types'

const PRIORIDADES: HomeworkPriority[] = ['baja', 'media', 'alta']
const TIPOS: HomeworkTaskType[] = ['ejercicios', 'examen', 'ensayo', 'lectura', 'proyecto', 'otro']

// Tope defensivo: un documento largo podría hacer que el modelo liste
// decenas de "tareas". Mismo criterio que MAX_OPERACIONES en
// taskManagement/schema.ts — nunca se confía en que el modelo respete
// límites por sí solo.
const MAX_TAREAS = 15

// ───────────────────────────────────────────────────────────────────────────
// Este schema está MODELADO SOBRE HOMEWORK_OUTPUT_SCHEMA a propósito.
// ───────────────────────────────────────────────────────────────────────────
// El schema de items de `tareas` es literalmente el mismo (6 propiedades,
// todas required, con "" de centinela en vez de omitir) — esa forma exacta
// es la única que este proyecto tiene VERIFICADA como estable contra Gemini
// 3.5 Flash-Lite: el intento con ~16 propiedades mayormente opcionales de
// TaskManagementAgent degeneró (misma operación repetida ~100 veces), y
// HomeworkAgent nunca mostró ese problema. Acá solo se suman DOS campos de
// nivel superior (`resumen`, `tipoDocumento`), ambos escalares y required,
// sobre una forma ya probada — no se reinventa nada.
export const ANALISIS_ARCHIVO_OUTPUT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    resumen: {
      type: 'string',
      description:
        'Resumen breve (2-3 frases) del contenido del documento, en español, en tercera persona. Describe QUÉ es y de qué trata, no des consejos ni opines. Cadena vacía solo si el documento es completamente ilegible.',
    },
    tipoDocumento: {
      type: 'string',
      enum: TIPOS_DOCUMENTO,
      description:
        'Qué tipo de documento académico es: "examen" (una prueba o su temario), "guia" (guía de estudio o taller), "apuntes" (notas de clase), "enunciado" (consigna de una tarea o trabajo), "horario" (un horario de clases), "otro" si no calza en ninguno.',
    },
    tareas: {
      type: 'array',
      description:
        'Tareas académicas concretas que el documento le asigna al estudiante (entregas, ejercicios a resolver, lecturas obligatorias, fechas de examen). Arreglo VACÍO si el documento no asigna ninguna tarea — no inventes tareas a partir de contenido meramente informativo.',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título breve y claro de la tarea, en español' },
          materia: { type: 'string', description: 'Materia si se menciona o se infiere con confianza; cadena vacía si no' },
          fecha: {
            type: 'string',
            description:
              'Fecha de entrega en formato YYYY-MM-DD, resolviendo fechas relativas contra la fecha de referencia dada; cadena vacía si el documento no menciona ninguna fecha',
          },
          prioridad: { type: 'string', enum: PRIORIDADES },
          tipo: { type: 'string', enum: TIPOS },
          confidence: { type: 'number', description: 'Confianza de 0 a 1 en esta extracción específica' },
        },
        required: ['titulo', 'materia', 'fecha', 'prioridad', 'tipo', 'confidence'],
      },
    },
  },
  required: ['resumen', 'tipoDocumento', 'tareas'],
}

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

// NUNCA devuelve ok:false — mismo criterio que ExamOutputParser e
// IconoMateriaOutputParser: el análisis es un ENRIQUECIMIENTO. Un archivo
// cuyo análisis salga mal formado debe quedar sin resumen (estado válido y
// con nombre en la base: `analizado_en` null / `analisis_error` puesto),
// nunca hacer fallar nada que el usuario ya hizo (el archivo ya está subido
// y guardado mucho antes de que esto corra).
export class AnalisisArchivoOutputParser implements OutputParser<AnalisisArchivoAgentOutput> {
  parse(raw: unknown): ParseResult<AnalisisArchivoAgentOutput> {
    const vacio: AnalisisArchivoAgentOutput = { resumen: null, tipoDocumento: 'otro', tareas: [] }

    if (typeof raw !== 'string') return { ok: true, data: vacio }

    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return { ok: true, data: vacio }
    }
    if (typeof json !== 'object' || json === null) return { ok: true, data: vacio }

    const obj = json as Record<string, unknown>

    const tareas: DetectedTask[] = []
    if (Array.isArray(obj.tareas)) {
      for (const item of obj.tareas.slice(0, MAX_TAREAS)) {
        if (typeof item !== 'object' || item === null) continue
        const t = item as Record<string, unknown>
        const titulo = normalizar(t.titulo)
        if (!titulo) continue
        tareas.push({
          id: createId('task'),
          titulo,
          materia: normalizar(t.materia),
          fecha: normalizar(t.fecha),
          prioridad: PRIORIDADES.includes(t.prioridad as HomeworkPriority) ? (t.prioridad as HomeworkPriority) : 'media',
          tipo: TIPOS.includes(t.tipo as HomeworkTaskType) ? (t.tipo as HomeworkTaskType) : 'otro',
          confidence: clamp01(t.confidence),
        })
      }
    }

    return {
      ok: true,
      data: {
        resumen: normalizar(obj.resumen),
        tipoDocumento: TIPOS_DOCUMENTO.includes(obj.tipoDocumento as TipoDocumento) ? (obj.tipoDocumento as TipoDocumento) : 'otro',
        tareas,
      },
    }
  }
}
