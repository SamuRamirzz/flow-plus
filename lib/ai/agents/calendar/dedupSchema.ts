import type { JSONSchema, OutputParser, ParseResult } from '@/lib/ai/types'
import type { MateriaParaComparar, ResultadoDedup } from './types'

// 3 propiedades, todas requeridas, centinelas ("" y 0) en vez de opcionales
// — mismo criterio que exam/schema.ts, por el mismo motivo documentado ahí:
// taskManagement/schema.ts registra una degeneración real de Gemini
// 3.5 Flash-Lite con schemas grandes y mayormente opcionales.
export const CALENDAR_DEDUP_OUTPUT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    hayDuplicado: {
      type: 'boolean',
      description: 'true si el nombre nuevo probablemente es la MISMA materia que una de la lista de existentes, con otro nombre.',
    },
    nombreExistente: {
      type: 'string',
      description:
        'Solo si hayDuplicado es true: copia EXACTA (mismas tildes y mayúsculas) del nombre de la lista de existentes que probablemente es la misma materia. Cadena vacía si hayDuplicado es false.',
    },
    confianza: {
      type: 'number',
      description: 'Qué tan seguro estás de que es un duplicado, de 0 a 1. 0 si hayDuplicado es false.',
    },
  },
  required: ['hayDuplicado', 'nombreExistente', 'confianza'],
}

function clamp01(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

// Nunca lanza — mismo criterio que ExamOutputParser: un dedup fallido no es
// un error del que el usuario deba enterarse, es "no se encontró duplicado"
// (el resultado más conservador y más seguro posible).
//
// `parse` recibe el nombre EXISTENTES por separado (no en el JSON del
// modelo) para resolver el nombre que el modelo devolvió contra el
// `MateriaParaComparar` real (con su id) — el modelo nunca ve ni inventa
// ids, solo copia nombres, que es lo único que puede citar de forma
// verificable contra lo que se le mandó.
export class CalendarDedupOutputParser implements OutputParser<ResultadoDedup> {
  constructor(private readonly existentes: MateriaParaComparar[]) {}

  parse(raw: unknown): ParseResult<ResultadoDedup> {
    const vacio: ResultadoDedup = { hayDuplicado: false, materiaExistente: null, confianza: 0 }
    if (typeof raw !== 'string') return { ok: true, data: vacio }

    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return { ok: true, data: vacio }
    }
    if (typeof json !== 'object' || json === null) return { ok: true, data: vacio }

    const obj = json as Record<string, unknown>
    if (obj.hayDuplicado !== true) return { ok: true, data: vacio }

    const nombreCitado = typeof obj.nombreExistente === 'string' ? obj.nombreExistente.trim() : ''
    // El modelo debe citar EXACTAMENTE uno de los nombres que se le mandó —
    // si "encontró" un duplicado pero el nombre no calza con ninguno de la
    // lista real (alucinación), se trata como "no hay duplicado": mostrar
    // un aviso que apunta a una materia que no está en la lista sería peor
    // que no mostrar nada.
    const materia = this.existentes.find((m) => m.nombre === nombreCitado)
    if (!materia) return { ok: true, data: vacio }

    return { ok: true, data: { hayDuplicado: true, materiaExistente: materia, confianza: clamp01(obj.confianza) } }
  }
}
