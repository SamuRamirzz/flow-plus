import type { JSONSchema, OutputParser, ParseResult } from '@/lib/ai/types'
import { normalizarCamposExamen } from './normalizar'
import type { CamposExamen, FormatoExamen } from './types'

const FORMATOS: FormatoExamen[] = ['oral', 'escrito', 'proyecto', 'mixto']

// Schema DELIBERADAMENTE mínimo: tres propiedades, todas `required`, con
// centinelas ("" y 0) en vez de opcionales.
//
// La disciplina de "todas requeridas, nunca opcionales" no es preferencia de
// estilo: está documentada en taskManagement/schema.ts como una falla REAL
// contra Gemini 3.5 Flash-Lite — un schema con ~16 propiedades mayormente
// opcionales produjo una respuesta degenerada (la misma entrada repetida ~100
// veces hasta cortar por longitud). Este schema mantiene el conteo en 3 justo
// para no acercarse a ese terreno.
//
// Y es la razón de que ExamAgent sea una llamada SEPARADA en vez de tres
// campos más dentro del schema de TaskManagementAgent: ese ya tiene 12
// propiedades por operación, y sumarle 3 lo dejaría en 15, a un paso del
// número con el que se sabe que el modelo se degrada. Se prefirió no tocar un
// schema frágil que hoy funciona.
export const EXAM_OUTPUT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    temario: {
      type: 'string',
      description:
        'Qué contenido entra en el examen, tal como lo describe el usuario (ej. "capítulos 4 al 7", "todo lo visto desde el parcial"). Cadena vacía si el texto no lo menciona.',
    },
    formato: {
      type: 'string',
      enum: [...FORMATOS, ''],
      description:
        'Formato de la evaluación si el texto lo menciona: "oral" (exposición, defensa), "escrito" (teórico, test, desarrollo), "proyecto" (práctico, laboratorio, entrega) o "mixto". Cadena vacía si no se menciona.',
    },
    peso: {
      type: 'number',
      description:
        'Porcentaje que vale el examen en la nota final, de 1 a 100 (ej. 30 para "vale el 30%"). Usa 0 si el texto no lo menciona.',
    },
  },
  required: ['temario', 'formato', 'peso'],
}

// Nunca lanza — misma disciplina que HomeworkOutputParser y
// TaskManagementOutputParser. Y va un paso más allá que ellos: como los tres
// campos son OPCIONALES por naturaleza (el usuario casi nunca dicta los
// tres), un JSON ilegible no es un error del que haya que avisar — es
// simplemente "no se pudo enriquecer", y devolver los tres en null es una
// respuesta válida. Por eso este parser no tiene camino `ok: false`: el
// llamador nunca debería tener que decidir qué hacer ante un fallo de un
// enriquecimiento puramente aditivo.
export class ExamOutputParser implements OutputParser<CamposExamen> {
  parse(raw: unknown): ParseResult<CamposExamen> {
    if (typeof raw !== 'string') return { ok: true, data: { temario: null, formato: null, peso: null } }

    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return { ok: true, data: { temario: null, formato: null, peso: null } }
    }

    if (typeof json !== 'object' || json === null) {
      return { ok: true, data: { temario: null, formato: null, peso: null } }
    }

    // normalizarCamposExamen ya tolera cualquier basura y aplica los
    // sinónimos/rangos reales (ver normalizar.ts) — acá no se revalida nada.
    return { ok: true, data: normalizarCamposExamen(json as Record<string, unknown>) }
  }
}
