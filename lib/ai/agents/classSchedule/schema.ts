import type { JSONSchema, OutputParser, ParseResult } from '@/lib/ai/types'
import type { BloquePropuesto } from '@/lib/horario/diff'
import type { DiaSemana, TipoBloqueHorario } from '@/lib/horario/tipos'
import type { TipoRespuestaHorario } from './types'

const TIPOS_RESPUESTA: TipoRespuestaHorario[] = ['bloques', 'no_es_horario', 'ilegible']

// Sprint Zonas de horario — mismo enum que el resto del proyecto
// (lib/horario/tipos.ts, lib/api/schemas.ts).
const TIPOS_BLOQUE: TipoBloqueHorario[] = ['clase', 'ingreso', 'salida', 'descanso']

// Tope defensivo: un horario semanal real no pasa de ~40 bloques. Si el
// modelo se desvía y repite la misma fila cientos de veces (comportamiento
// degenerado ya observado con este modelo en el Sprint 7.1, cuando el
// schema tenía demasiadas propiedades opcionales), se corta acá.
const MAX_BLOQUES = 40

// TODAS las propiedades son `required` — disciplina establecida en el
// Sprint 7.1: con propiedades opcionales, gemini-3.5-flash-lite produjo
// respuestas degeneradas (la misma entrada repetida ~100 veces). Los campos
// que no aplican se piden como cadena vacía y el parser los normaliza a
// null, igual que en HomeworkAgent. Tampoco se usa `maxItems`: la API lo
// rechaza con 400 "Request contains an invalid argument" (verificado en el
// Sprint 7.1) — el tope se aplica del lado del parser.
export const CLASS_SCHEDULE_OUTPUT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    tipoRespuesta: {
      type: 'string',
      enum: TIPOS_RESPUESTA,
      description:
        '"bloques" si pudiste leer el horario; "no_es_horario" si la imagen no es un horario de clases; "ilegible" si es un horario pero no se puede leer (borroso, cortado, muy oscuro).',
    },
    mensaje: {
      type: 'string',
      description: 'Si NO es "bloques": una frase breve en español explicando qué pasa con la imagen. Cadena vacía si es "bloques".',
    },
    bloques: {
      type: 'array',
      description:
        'Una entrada por cada celda de clase O bloque especial (ingreso/salida/descanso, si la imagen los marca explícitamente): si una materia aparece lunes Y miércoles, son DOS entradas. Nunca repitas la misma entrada.',
      items: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: TIPOS_BLOQUE,
            description:
              '"clase" para una celda de materia normal. "ingreso"/"salida"/"descanso" SOLO si la imagen marca explícitamente un bloque de entrada, salida o receso (ej. una fila literal "Ingreso" o "Descanso" en el horario) — no lo inventes para huecos entre clases.',
          },
          materia: {
            type: 'string',
            description: 'Nombre de la materia tal como aparece en la imagen. Cadena vacía si tipo no es "clase" (los bloques especiales no tienen materia).',
          },
          diaSemana: { type: 'number', description: 'Día en ISO-8601: 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado, 7=domingo' },
          horaInicio: { type: 'string', description: 'Hora de inicio en formato HH:MM (24h). Cadena vacía si la imagen no la indica.' },
          horaFin: { type: 'string', description: 'Hora de fin en formato HH:MM (24h). Cadena vacía si la imagen no la indica.' },
          aula: { type: 'string', description: 'Aula/salón si aparece. Cadena vacía si no (siempre vacía para bloques especiales).' },
          confidence: { type: 'number', description: 'Confianza de 0 a 1 en la lectura de ESTA fila' },
        },
        required: ['tipo', 'materia', 'diaSemana', 'horaInicio', 'horaFin', 'aula', 'confidence'],
      },
    },
  },
  required: ['tipoRespuesta', 'mensaje', 'bloques'],
}

export type ClassScheduleParsedOutput = {
  tipoRespuesta: TipoRespuestaHorario
  mensaje: string | null
  bloques: BloquePropuesto[]
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

/** Acepta 'HH:MM' 24h; cualquier otra cosa (incluido '' o '25:00') → null. */
function horaValida(valor: unknown): string | null {
  const s = normalizar(valor)
  if (!s) return null
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null
}

/** Solo 1..7 (ISO). El modelo podría devolver 0 (convención JS) o basura. */
function diaValido(valor: unknown): DiaSemana | null {
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isInteger(n) && n >= 1 && n <= 7 ? (n as DiaSemana) : null
}

/** Cualquier valor fuera del enum (o ausente, en una foto vieja) cae a 'clase' — mismo default que el resto del proyecto. */
function tipoValido(valor: unknown): TipoBloqueHorario {
  return TIPOS_BLOQUE.includes(valor as TipoBloqueHorario) ? (valor as TipoBloqueHorario) : 'clase'
}

// Nunca lanza — misma disciplina que los otros parsers del proyecto:
// devuelve ParseResult y el agente decide. Descarta filas inválidas en vez
// de invalidar toda la respuesta: que el modelo lea mal UNA celda de la foto
// no debería tirar las otras diez que leyó bien (el usuario igual revisa
// todo en la grilla antes de guardar).
export class ClassScheduleOutputParser implements OutputParser<ClassScheduleParsedOutput> {
  parse(raw: unknown): ParseResult<ClassScheduleParsedOutput> {
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
    const bloquesRaw = obj.bloques

    const bloques: BloquePropuesto[] = []
    if (Array.isArray(bloquesRaw)) {
      for (const item of bloquesRaw.slice(0, MAX_BLOQUES)) {
        if (typeof item !== 'object' || item === null) continue
        const b = item as Record<string, unknown>

        const tipo = tipoValido(b.tipo)
        const materia = normalizar(b.materia)
        const diaSemana = diaValido(b.diaSemana)
        // Sin día, el bloque no se puede ni mostrar en la grilla ni guardar
        // — se descarta en vez de inventar un valor. Sin materia SOLO se
        // descarta cuando tipo es 'clase': un bloque especial nunca trae
        // materia (el prompt le pide mandar '' a propósito), así que exigir
        // una acá lo descartaría siempre.
        if (diaSemana === null) continue
        if (tipo === 'clase' && !materia) continue

        bloques.push({
          tipo,
          materia: materia ?? '',
          diaSemana,
          horaInicio: horaValida(b.horaInicio),
          horaFin: horaValida(b.horaFin),
          aula: normalizar(b.aula),
          confidence: clamp01(b.confidence),
        })
      }
    }

    // 'bloques' solo se infiere cuando de verdad hay filas; si el campo vino
    // ausente/inválido y no se leyó ninguna, el fallback seguro es
    // 'ilegible' (pedir otra foto), nunca 'no_es_horario' — acusar al
    // usuario de subir la foto equivocada es peor error que pedirla de nuevo.
    const tipoDeclarado = obj.tipoRespuesta
    const tipoRespuesta: TipoRespuestaHorario = TIPOS_RESPUESTA.includes(tipoDeclarado as TipoRespuestaHorario)
      ? (tipoDeclarado as TipoRespuestaHorario)
      : bloques.length > 0
        ? 'bloques'
        : 'ilegible'

    return { ok: true, data: { tipoRespuesta, mensaje: normalizar(obj.mensaje), bloques } }
  }
}
