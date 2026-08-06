import type { JSONSchema, OutputParser, ParseResult } from '@/lib/ai/types'
import type { HomeworkPriority, HomeworkTaskType } from '../homework/types'
import type { TipoRespuestaGestion } from './types'

const PRIORIDADES: HomeworkPriority[] = ['baja', 'media', 'alta']
const TIPOS: HomeworkTaskType[] = ['ejercicios', 'examen', 'ensayo', 'lectura', 'proyecto', 'otro']
const TIPOS_RESPUESTA: TipoRespuestaGestion[] = ['operaciones', 'conversacional']
const TIPOS_OPERACION = ['crear', 'modificar', 'borrar', 'ambiguo', 'sin_coincidencias', 'crear_nota'] as const
type TipoOperacionRaw = (typeof TIPOS_OPERACION)[number]
const ACCIONES_ORIGINALES = ['modificar', 'borrar'] as const

// Máximo de operaciones por respuesta — tope defensivo, ver comentario en
// el parser (`.slice(0, MAX_OPERACIONES)`) sobre por qué existe.
const MAX_OPERACIONES = 20

// PRIMER INTENTO de este schema (ver git history si hace falta) tenía ~16
// propiedades por item, la mayoría OPCIONALES (`nuevoTitulo`, `nuevaFecha`,
// etc., presentes solo cuando aplicaban). Contra Gemini 3.5 Flash-Lite real
// eso produjo una respuesta degenerada: la misma operación repetida ~100
// veces hasta cortar por longitud. El schema de HomeworkAgent (todas las
// propiedades REQUERIDAS, nunca opcionales) nunca mostró ese problema con
// el mismo modelo. La forma de abajo sigue esa misma disciplina: TODAS las
// propiedades son `required`, reusando el mismo campo para "valor nuevo"
// tanto al crear como al modificar (titulo/materia/fecha/prioridad), con
// centinelas ("", -1, [], enum vacío) en vez de omitir el campo cuando no
// aplica — igual que "" → null ya establecido en HomeworkAgent. Además se
// puso maxItems como segunda red de seguridad, y el parser trunca de forma
// defensiva sin importar qué límite respete o no el modelo.
//
// Sprint Archivos / Fase 4.2 — se agregó `tipo:'crear_nota'` + UN campo
// nuevo requerido (`contenidoNota`), de 12 a 13 propiedades. Se trata como
// hipótesis NO verificada, no como hecho: el precedente de degeneración de
// arriba fue con ~16 campos mayormente OPCIONALES agregados a operaciones ya
// existentes; esto es un campo siempre-requerido-con-sentinel agregado por
// un miembro NUEVO de una unión discriminada — estructuralmente distinto,
// pero nadie en este código probó esa distinción contra el modelo real antes
// de este cambio. Se verificó con un stress test de 15-20 llamadas reales
// variando todos los tipos de operación en la misma sesión (ver el registro
// de verificación de este sprint). `crear_nota` reusa `descripcion`/
// `indiceObjetivo`/`indicesCandidatos` — los mismos tres campos que ya usan
// modificar/borrar/ambiguo para resolver a qué tarea se refiere el usuario —
// así que no hizo falta un campo nuevo para eso, solo para el contenido de
// la nota en sí.
export const TASK_MANAGEMENT_OUTPUT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    tipoRespuesta: {
      type: 'string',
      enum: TIPOS_RESPUESTA,
      description:
        '"operaciones" si el texto describe al menos una acción sobre tareas (crear, modificar o borrar), aunque no puedas resolverla del todo; "conversacional" si el texto no es un intento de gestionar tareas (saludo, pregunta, charla).',
    },
    mensaje: {
      type: 'string',
      description: 'Solo si tipoRespuesta es "conversacional": respuesta breve y natural. Cadena vacía en cualquier otro caso.',
    },
    operaciones: {
      type: 'array',
      description:
        'Una entrada por cada acción DISTINTA que el usuario pidió (normalmente 1, rara vez más de 2 o 3). NUNCA repitas la misma operación más de una vez.',
      items: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: TIPOS_OPERACION,
            description:
              '"crear" para una tarea nueva. "modificar"/"borrar" cuando hay UNA sola tarea existente clara. "ambiguo" cuando la referencia calza con más de una tarea existente. "sin_coincidencias" cuando el usuario se refiere a una tarea que no está en la lista de tareas existentes. "crear_nota" cuando el usuario pide agregar una nota/anotación/comentario a una tarea existente (ej. "agrega una nota a mi tarea de Cálculo diciendo que faltó el punto 3") — identifica la tarea igual que en "modificar"/"borrar" (indiceObjetivo o indicesCandidatos), NUNCA crees una tarea nueva solo para adjuntarle una nota.',
          },
          titulo: {
            type: 'string',
            description:
              'Si tipo es "crear": título de la tarea nueva. Si tipo es "modificar" (o "ambiguo" con accionOriginal "modificar") y el título cambia: el nuevo título. Cadena vacía en cualquier otro caso.',
          },
          materia: {
            type: 'string',
            description: 'Igual que "titulo" pero para la materia (nombre, no id). Cadena vacía si no aplica o no cambia.',
          },
          fecha: {
            type: 'string',
            description: 'Igual que "titulo" pero para la fecha, formato YYYY-MM-DD. Cadena vacía si no aplica o no cambia.',
          },
          prioridad: {
            type: 'string',
            enum: [...PRIORIDADES, ''],
            description: 'Igual que "titulo" pero para la prioridad. Cadena vacía si no aplica o no cambia.',
          },
          tipoTarea: {
            type: 'string',
            enum: [...TIPOS, ''],
            description: 'Solo si tipo es "crear": tipo de la tarea. Cadena vacía en cualquier otro caso.',
          },
          confidence: {
            type: 'number',
            description: 'Solo si tipo es "crear": confianza de 0 a 1 en la extracción. 0 en cualquier otro caso.',
          },
          completada: {
            type: 'string',
            enum: ['', 'true', 'false'],
            description:
              'Solo si tipo es "modificar" (o "ambiguo" con accionOriginal "modificar") y el usuario pide marcar como completada o pendiente: "true" o "false". Cadena vacía si no aplica.',
          },
          descripcion: {
            type: 'string',
            description:
              'Si tipo es "modificar"/"borrar"/"ambiguo"/"sin_coincidencias"/"crear_nota": descripción breve en español de a qué tarea se refería el usuario. Cadena vacía si tipo es "crear".',
          },
          indiceObjetivo: {
            type: 'number',
            description:
              'Si tipo es "modificar", "borrar" o "crear_nota": el índice (de la lista numerada de tareas existentes que se te dio) de la tarea a la que te refieres. -1 en cualquier otro caso.',
          },
          indicesCandidatos: {
            type: 'array',
            items: { type: 'number' },
            description:
              'Si tipo es "ambiguo", o si tipo es "crear_nota" y más de una tarea existente podría ser la referida: todos los índices de tareas existentes que podrían ser. Vacío en cualquier otro caso.',
          },
          accionOriginal: {
            type: 'string',
            enum: [...ACCIONES_ORIGINALES, ''],
            description: 'Solo si tipo es "ambiguo": qué quería hacer el usuario con esa tarea. Cadena vacía en cualquier otro caso.',
          },
          contenidoNota: {
            type: 'string',
            description: 'Solo si tipo es "crear_nota": el contenido de la nota, en español, redactado en base a lo que pidió el usuario. Cadena vacía en cualquier otro caso.',
          },
        },
        required: [
          'tipo',
          'titulo',
          'materia',
          'fecha',
          'prioridad',
          'tipoTarea',
          'confidence',
          'completada',
          'descripcion',
          'indiceObjetivo',
          'indicesCandidatos',
          'accionOriginal',
          'contenidoNota',
        ],
      },
    },
  },
  required: ['tipoRespuesta', 'mensaje', 'operaciones'],
}

// --- Forma "cruda" que produce el parser: solo valida tipos/forma, no
// resuelve índices contra tareas reales (eso es lib/ai/agents/taskManagement/
// resolver.ts, una función pura separada — el parser no conoce la lista de
// tareas existentes, y OutputParser.parse(raw) solo recibe `raw`). ---
export type OperacionCrearRaw = {
  tipo: 'crear'
  titulo: string
  materia: string | null
  fecha: string | null
  prioridad: HomeworkPriority
  tipoTarea: HomeworkTaskType
  confidence: number
}

export type CambiosRaw = {
  titulo?: string
  materia?: string
  fecha?: string
  prioridad?: HomeworkPriority
  completada?: boolean
}

export type OperacionRefRaw = {
  tipo: 'modificar' | 'borrar' | 'ambiguo'
  descripcion: string
  indiceObjetivo: number | null
  indicesCandidatos: number[]
  accionOriginal: 'modificar' | 'borrar' | null
  cambios: CambiosRaw
}

export type OperacionSinCoincidenciasRaw = { tipo: 'sin_coincidencias'; descripcion: string }

// Sprint Archivos / Fase 4.2 — mismos tres campos de resolución que
// OperacionRefRaw (descripcion/indiceObjetivo/indicesCandidatos: la misma
// tarea real a la que ya sabe apuntar modificar/borrar), más el contenido de
// la nota. Deliberadamente NO forma parte de `OperacionTarea` (types.ts) ni
// de lo que resolverOperaciones() devuelve — ver resolver.ts::resolverNotas.
export type OperacionCrearNotaRaw = {
  tipo: 'crear_nota'
  descripcion: string
  indiceObjetivo: number | null
  indicesCandidatos: number[]
  contenidoNota: string
}

export type OperacionRaw = OperacionCrearRaw | OperacionRefRaw | OperacionSinCoincidenciasRaw | OperacionCrearNotaRaw

export type TaskManagementParsedOutput = {
  tipoRespuesta: TipoRespuestaGestion
  mensaje: string | null
  operaciones: OperacionRaw[]
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

function indiceValido(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isInteger(n) && n >= 0 ? n : null
}

// Traduce el shape "plano y reusado" (titulo/materia/fecha/prioridad como
// campo único, con "" de centinela) a los `cambios` que de verdad importan
// para un modificar — solo entran los campos con valor real.
function cambiosDesde(t: Record<string, unknown>): CambiosRaw {
  const cambios: CambiosRaw = {}
  const titulo = normalizar(t.titulo)
  if (titulo !== null) cambios.titulo = titulo
  const materia = normalizar(t.materia)
  if (materia !== null) cambios.materia = materia
  const fecha = normalizar(t.fecha)
  if (fecha !== null) cambios.fecha = fecha
  if (PRIORIDADES.includes(t.prioridad as HomeworkPriority)) cambios.prioridad = t.prioridad as HomeworkPriority
  if (t.completada === 'true') cambios.completada = true
  else if (t.completada === 'false') cambios.completada = false
  return cambios
}

// Nunca lanza — misma disciplina que HomeworkOutputParser. Solo valida
// FORMA: que cada operación tenga un `tipo` reconocido y campos del tipo
// correcto. No sabe nada de qué tareas existen de verdad — eso lo resuelve
// resolver.ts con la lista real, después de este parse.
export class TaskManagementOutputParser implements OutputParser<TaskManagementParsedOutput> {
  parse(raw: unknown): ParseResult<TaskManagementParsedOutput> {
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
    const operacionesRaw = obj.operaciones

    const operaciones: OperacionRaw[] = []
    if (Array.isArray(operacionesRaw)) {
      // Red de seguridad defensiva independiente de maxItems del schema:
      // un modelo desviado puede ignorar el schema — nunca se confía solo
      // en que lo respete (mismo motivo por el que existe MAX_OPERACIONES).
      for (const item of operacionesRaw.slice(0, MAX_OPERACIONES)) {
        if (typeof item !== 'object' || item === null) continue
        const t = item as Record<string, unknown>
        const tipo = TIPOS_OPERACION.includes(t.tipo as TipoOperacionRaw) ? (t.tipo as TipoOperacionRaw) : null
        if (!tipo) continue

        if (tipo === 'crear') {
          const titulo = normalizar(t.titulo)
          if (!titulo) continue
          operaciones.push({
            tipo: 'crear',
            titulo,
            materia: normalizar(t.materia),
            fecha: normalizar(t.fecha),
            prioridad: PRIORIDADES.includes(t.prioridad as HomeworkPriority) ? (t.prioridad as HomeworkPriority) : 'media',
            tipoTarea: TIPOS.includes(t.tipoTarea as HomeworkTaskType) ? (t.tipoTarea as HomeworkTaskType) : 'otro',
            confidence: clamp01(t.confidence),
          })
          continue
        }

        if (tipo === 'sin_coincidencias') {
          operaciones.push({ tipo: 'sin_coincidencias', descripcion: normalizar(t.descripcion) ?? 'una tarea' })
          continue
        }

        if (tipo === 'crear_nota') {
          const contenidoNota = normalizar(t.contenidoNota)
          if (!contenidoNota) continue
          operaciones.push({
            tipo: 'crear_nota',
            descripcion: normalizar(t.descripcion) ?? 'una tarea',
            indiceObjetivo: indiceValido(t.indiceObjetivo),
            indicesCandidatos: Array.isArray(t.indicesCandidatos)
              ? t.indicesCandidatos.map(indiceValido).filter((n): n is number => n !== null)
              : [],
            contenidoNota,
          })
          continue
        }

        // modificar | borrar | ambiguo — todas referencian tarea(s) existente(s)
        const indicesCandidatos = Array.isArray(t.indicesCandidatos)
          ? t.indicesCandidatos.map(indiceValido).filter((n): n is number => n !== null)
          : []
        operaciones.push({
          tipo,
          descripcion: normalizar(t.descripcion) ?? 'una tarea',
          indiceObjetivo: indiceValido(t.indiceObjetivo),
          indicesCandidatos,
          accionOriginal: ACCIONES_ORIGINALES.includes(t.accionOriginal as (typeof ACCIONES_ORIGINALES)[number])
            ? (t.accionOriginal as 'modificar' | 'borrar')
            : null,
          cambios: cambiosDesde(t),
        })
      }
    }

    // Igual que en HomeworkAgent (Sprint 7.1 Parte 1): 'conversacional' SOLO
    // lo declara el modelo explícitamente, nunca se infiere — si el campo
    // viene ausente o inválido, el fallback seguro es 'operaciones' (aunque
    // termine vacío), no asumir silenciosamente que era una charla.
    const tipoDeclarado = obj.tipoRespuesta
    const tipoRespuesta: TipoRespuestaGestion = TIPOS_RESPUESTA.includes(tipoDeclarado as TipoRespuestaGestion)
      ? (tipoDeclarado as TipoRespuestaGestion)
      : 'operaciones'

    return { ok: true, data: { tipoRespuesta, mensaje: normalizar(obj.mensaje), operaciones } }
  }
}
