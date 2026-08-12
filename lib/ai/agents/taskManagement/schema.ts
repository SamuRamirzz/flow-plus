import type { JSONSchema, OutputParser, ParseResult } from '@/lib/ai/types'
import type { HomeworkPriority, HomeworkTaskType } from '../homework/types'
import type { TipoRespuestaGestion } from './types'

const PRIORIDADES: HomeworkPriority[] = ['baja', 'media', 'alta']
const TIPOS: HomeworkTaskType[] = ['ejercicios', 'examen', 'ensayo', 'lectura', 'proyecto', 'otro']
const TIPOS_RESPUESTA: TipoRespuestaGestion[] = ['operaciones', 'conversacional']
// Sprint Sistema de Notas Unificado (Parte E) — dos tipos nuevos:
// 'editar_nota'/'borrar_nota', mismo criterio de "reusar campos existentes
// con sentinela" que ya rige el resto de este schema.
const TIPOS_OPERACION = ['crear', 'modificar', 'borrar', 'ambiguo', 'sin_coincidencias', 'crear_nota', 'editar_nota', 'borrar_nota'] as const
type TipoOperacionRaw = (typeof TIPOS_OPERACION)[number]
const ACCIONES_ORIGINALES = ['modificar', 'borrar'] as const
// Sprint Sistema de Notas Unificado (Parte E) — a qué lista de índices
// apunta `indiceObjetivo`/`indicesCandidatos` cuando `tipo` es
// 'crear_nota'/'editar_nota'/'borrar_nota'. 'tarea'/'bloque_horario'/
// 'archivo' solo aplican a 'crear_nota' (una nota nueva puede anclarse a
// cualquiera de las tres); 'nota' solo aplica a 'editar_nota'/'borrar_nota'
// (esas dos siempre resuelven contra una nota YA existente, nunca contra
// dónde anclarla). 'archivo' se agregó DESPUÉS de verificar contra Gemini
// real que sin él, "agrega una nota a mi archivo X" devolvía
// sin_coincidencias siempre — el encargo asumía que ya funcionaba, no era
// cierto, y se cerró en el mismo sprint en vez de dejarlo pendiente.
const OBJETIVOS_TIPO = ['tarea', 'bloque_horario', 'archivo', 'nota'] as const

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
// nuevo requerido (`contenidoNota`), de 12 a 13 propiedades. Se trató como
// hipótesis NO verificada, no como hecho: el precedente de degeneración de
// arriba fue con ~16 campos mayormente OPCIONALES agregados a operaciones ya
// existentes; esto es un campo siempre-requerido-con-sentinel agregado por
// un miembro NUEVO de una unión discriminada — estructuralmente distinto.
// Se verificó con un stress test de 15-20 llamadas reales.
//
// Sprint Sistema de Notas Unificado (Parte E) — segunda extensión, mismo
// criterio de verificar antes de asumir: se agregó `objetivoTipo` (UN campo
// nuevo, 13→14) + DOS miembros nuevos de la unión (`editar_nota`,
// `borrar_nota`, que no suman campos propios — reusan `indiceObjetivo`/
// `indicesCandidatos`/`objetivoTipo` para resolver la nota, y
// `contenidoNota` para el contenido nuevo en `editar_nota`). `crear_nota`
// gana la capacidad de anclarse también a un bloque de horario (no solo a
// una tarea) — `objetivoTipo` decide contra qué lista (tareaExistentes,
// bloquesExistentes o notasExistentes, según el `tipo` de operación) se
// interpretan los índices. Verificado con un stress test propio de este
// sprint, incluyendo bloques especiales (ingreso/salida/descanso) — ver el
// registro de verificación.
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
              '"crear" para una tarea nueva. "modificar"/"borrar" cuando hay UNA sola tarea existente clara. "ambiguo" cuando la referencia calza con más de una tarea existente. "sin_coincidencias" cuando el usuario se refiere a una tarea que no está en la lista de tareas existentes. "crear_nota" cuando el usuario pide agregar una nota/anotación/comentario a una tarea, a un bloque de horario, o a un archivo existente (ej. "agrega una nota a mi tarea de Cálculo diciendo que faltó el punto 3", "agrega una nota a mi clase de Inglés de los lunes", "pon una nota en mi bloque de ingreso", "agrega una nota a mi archivo Collective Nouns") — identifica el objetivo con indiceObjetivo/indicesCandidatos, indicando en objetivoTipo si son índices de la lista de TAREAS, de BLOQUES DE HORARIO, o de ARCHIVOS. "editar_nota"/"borrar_nota" cuando el usuario pide cambiar o quitar una nota que YA EXISTE (ej. "cambia la nota de mi tarea de Historia a...", "borra la nota de mi clase de Inglés") — identifica la nota con indiceObjetivo/indicesCandidatos sobre la lista de NOTAS EXISTENTES (objetivoTipo "nota"). NUNCA crees una tarea nueva solo para adjuntarle una nota.',
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
              'Si tipo es "modificar"/"borrar"/"ambiguo"/"sin_coincidencias"/"crear_nota"/"editar_nota"/"borrar_nota": descripción breve en español de a qué se refería el usuario. Cadena vacía si tipo es "crear".',
          },
          indiceObjetivo: {
            type: 'number',
            description:
              'Si tipo es "modificar", "borrar", "crear_nota", "editar_nota" o "borrar_nota": el índice (de la lista correspondiente según objetivoTipo) del objetivo al que te refieres. -1 en cualquier otro caso, o si más de uno podría ser (usa indicesCandidatos en ese caso).',
          },
          indicesCandidatos: {
            type: 'array',
            items: { type: 'number' },
            description:
              'Si tipo es "ambiguo", o si tipo es "crear_nota"/"editar_nota"/"borrar_nota" y más de un objetivo podría ser el referido: todos los índices posibles (de la lista correspondiente según objetivoTipo). Vacío en cualquier otro caso.',
          },
          objetivoTipo: {
            type: 'string',
            enum: [...OBJETIVOS_TIPO, ''],
            description:
              'SOLO si tipo es "crear_nota"/"editar_nota"/"borrar_nota": a qué lista pertenecen indiceObjetivo/indicesCandidatos. Para "crear_nota": "tarea" si el usuario se refiere a una tarea existente, "bloque_horario" si se refiere a una clase/ingreso/salida/descanso de su horario, "archivo" si se refiere a un archivo suyo ya subido. Para "editar_nota"/"borrar_nota": SIEMPRE "nota" (resuelves contra la lista de notas ya existentes, nunca contra tareas, bloques ni archivos). Cadena vacía en cualquier otro caso.',
          },
          accionOriginal: {
            type: 'string',
            enum: [...ACCIONES_ORIGINALES, ''],
            description: 'Solo si tipo es "ambiguo": qué quería hacer el usuario con esa tarea. Cadena vacía en cualquier otro caso.',
          },
          contenidoNota: {
            type: 'string',
            description:
              'Si tipo es "crear_nota": el contenido de la nota nueva. Si tipo es "editar_nota": el contenido NUEVO que reemplaza al anterior. En español, redactado en base a lo que pidió el usuario. Cadena vacía en cualquier otro caso (incluido "borrar_nota", que no necesita contenido).',
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
          'objetivoTipo',
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

// Sprint Archivos / Fase 4.2, extendido en el Sprint Sistema de Notas
// Unificado — mismos tres campos de resolución que OperacionRefRaw
// (descripcion/indiceObjetivo/indicesCandidatos), más `objetivoTipo` (a qué
// lista pertenecen esos índices: 'tarea', 'bloque_horario' o 'archivo') y
// el contenido de la nota. Deliberadamente NO forma parte de
// `OperacionTarea` (types.ts) ni de lo que resolverOperaciones() devuelve —
// ver resolver.ts::resolverNotas.
export type OperacionCrearNotaRaw = {
  tipo: 'crear_nota'
  descripcion: string
  indiceObjetivo: number | null
  indicesCandidatos: number[]
  objetivoTipo: 'tarea' | 'bloque_horario' | 'archivo' | null
  contenidoNota: string
}

// Sprint Sistema de Notas Unificado — `editar_nota`/`borrar_nota` comparten
// exactamente esta forma (mismos campos de resolución, `objetivoTipo`
// siempre 'nota'; `contenidoNuevo` solo tiene sentido cuando `accion` es
// 'editar', viene `null` en 'borrar'). Un solo tipo para las dos evita
// duplicar la lógica de resolución en el parser/resolver.
export type OperacionNotaExistenteRaw = {
  tipo: 'editar_nota' | 'borrar_nota'
  descripcion: string
  indiceObjetivo: number | null
  indicesCandidatos: number[]
  contenidoNuevo: string | null
}

export type OperacionRaw = OperacionCrearRaw | OperacionRefRaw | OperacionSinCoincidenciasRaw | OperacionCrearNotaRaw | OperacionNotaExistenteRaw

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
          const objetivoTipoRaw = t.objetivoTipo
          operaciones.push({
            tipo: 'crear_nota',
            descripcion: normalizar(t.descripcion) ?? 'una tarea',
            indiceObjetivo: indiceValido(t.indiceObjetivo),
            indicesCandidatos: Array.isArray(t.indicesCandidatos)
              ? t.indicesCandidatos.map(indiceValido).filter((n): n is number => n !== null)
              : [],
            // Default 'tarea': mismo comportamiento de siempre para una
            // respuesta que no incluya el campo (compatibilidad con
            // cualquier caché/reintento de una llamada de antes de este
            // sprint) — 'tarea' era la única opción posible entonces.
            objetivoTipo: objetivoTipoRaw === 'bloque_horario' || objetivoTipoRaw === 'archivo' ? objetivoTipoRaw : 'tarea',
            contenidoNota,
          })
          continue
        }

        if (tipo === 'editar_nota' || tipo === 'borrar_nota') {
          // 'editar_nota' sin contenido nuevo no tiene sentido (no habría
          // nada que cambiar) — se descarta, mismo criterio que 'crear_nota'
          // sin contenidoNota. 'borrar_nota' nunca necesita contenido.
          const contenidoNuevo = normalizar(t.contenidoNota)
          if (tipo === 'editar_nota' && !contenidoNuevo) continue
          operaciones.push({
            tipo,
            descripcion: normalizar(t.descripcion) ?? 'una nota',
            indiceObjetivo: indiceValido(t.indiceObjetivo),
            indicesCandidatos: Array.isArray(t.indicesCandidatos)
              ? t.indicesCandidatos.map(indiceValido).filter((n): n is number => n !== null)
              : [],
            contenidoNuevo: tipo === 'editar_nota' ? contenidoNuevo : null,
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
