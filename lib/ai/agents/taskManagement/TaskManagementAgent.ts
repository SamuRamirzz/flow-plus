import type { AIAgent, AIAgentDefinition, AIContext, AIProvider, AIRequest, AgentResult } from '@/lib/ai/types'
import { AIValidationError } from '@/lib/ai/errors'
import { aiConfig } from '@/lib/ai/config'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import { GEMINI_PROVIDER_ID, normalizarAdjuntos, type ConversationTurnInput, type StructuredProviderMetadata } from '@/lib/ai/providers/gemini'
import { TASK_MANAGEMENT_OUTPUT_SCHEMA, TaskManagementOutputParser } from './schema'
import { resolverOperaciones, resolverNotas } from './resolver'
import { TASK_MANAGEMENT_AGENT_ID, TASK_MANAGEMENT_AGENT_TRIGGER_EVENT, type TareaContexto, type TaskManagementAgentOutput } from './types'

const definition: AIAgentDefinition = {
  id: TASK_MANAGEMENT_AGENT_ID,
  triggerEvents: [TASK_MANAGEMENT_AGENT_TRIGGER_EVENT],
  defaultProviderId: GEMINI_PROVIDER_ID,
  defaultModel: 'gemini-3.5-flash-lite',
  outputSchema: TASK_MANAGEMENT_OUTPUT_SCHEMA,
  // Sprint Archivos / Fase 4.3 — scope 'academic': notas ancladas a tareas
  // (lib/ai/context/loaders.ts::cargarAcademic), para poder responder
  // preguntas conversacionales sobre el contenido de una tarea ("¿qué me
  // faltaba de la tarea de Cálculo?"). Fase 5.3 — scope 'conversationHistory':
  // últimas conversaciones pasadas con la IA, para dar continuidad entre
  // sesiones del overlay. `run()` SÍ consume los dos (ver más abajo, pasados
  // a construirInstruccionSistema) — declarar un scope sin leerlo gastaría
  // una consulta a Postgres en cada llamada sin que el modelo viera nada
  // nuevo (error real que ya se documentó al agregar 'academic').
  contextScopes: ['academic', 'conversationHistory'],
  // Todo el resultado (crear/modificar/borrar) pasa por la misma revisión de
  // lote del overlay antes de aplicarse — nunca se escribe nada hasta que
  // el usuario confirma. Un solo nivel de autonomía por agente basta: lo
  // que distingue crear/modificar/borrar es el TRATAMIENTO VISUAL en la UI
  // (ver AIImmersiveOverlay/OperacionRow), no un autonomyLevel por
  // operación — el tipo AIAgentDefinition no modela eso, y el mecanismo de
  // confirmación real ya es el batch del overlay, no este campo.
  autonomyLevel: 'suggested_confirmation_required',
  executionQueue: 'interactive',
}

const parser = new TaskManagementOutputParser()

// Sprint 7.2 Parte A: el cliente manda el historial de la sesión actual del
// overlay (turnos previos, ambos roles) en request.metadata.historial — el
// agente no lo persiste ni lo toca entre requests, cada llamada es todavía
// stateless del lado del servidor (misma disciplina que el resto de
// lib/ai/). Ver GeminiProvider.ConversationTurnInput para el porqué de este
// shape angosto en vez de reusar `Step`/`Content` del SDK directamente.
function normalizarHistorial(metadata: Record<string, unknown> | undefined): ConversationTurnInput[] {
  const lista = metadata?.historial
  if (!Array.isArray(lista)) return []
  return lista.filter(
    (t): t is ConversationTurnInput =>
      typeof t === 'object' &&
      t !== null &&
      (t as ConversationTurnInput).rol !== undefined &&
      ['usuario', 'modelo'].includes((t as ConversationTurnInput).rol) &&
      typeof (t as ConversationTurnInput).texto === 'string' &&
      (t as ConversationTurnInput).texto.trim().length > 0
  )
}

function normalizarTareasExistentes(metadata: Record<string, unknown> | undefined): TareaContexto[] {
  const lista = metadata?.tareasExistentes
  if (!Array.isArray(lista)) return []
  return lista.filter(
    (t): t is TareaContexto =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as TareaContexto).id === 'string' &&
      typeof (t as TareaContexto).titulo === 'string'
  )
}

type NotaContexto = { titulo: string | null; contenido: string }

// Sprint Archivos / Fase 4.3 — `context.academic` (ContextEngine) trae
// `{ notasPorTareaId: Record<tareaId, NotaContexto[]> }` — se normaliza acá
// con el mismo criterio defensivo que `normalizarTareasExistentes`/
// `normalizarHistorial`: cualquier forma inesperada se descarta en silencio
// en vez de lanzar, el agente nunca debe caerse por un contexto mal formado.
function normalizarNotasPorTarea(academic: Record<string, unknown> | undefined): Record<string, NotaContexto[]> {
  const raw = academic?.notasPorTareaId
  if (typeof raw !== 'object' || raw === null) return {}

  const resultado: Record<string, NotaContexto[]> = {}
  for (const [tareaId, notas] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(notas)) continue
    const validas = notas.filter(
      (n): n is NotaContexto => typeof n === 'object' && n !== null && typeof (n as NotaContexto).contenido === 'string'
    )
    if (validas.length > 0) resultado[tareaId] = validas
  }
  return resultado
}

// Mismo índice 0-based que listarTareasParaPrompt, para que el modelo pueda
// cruzar una nota con la tarea correspondiente sin ambigüedad. `null` (no
// una cadena vacía) cuando no hay ninguna nota que mostrar, para que el
// llamador pueda omitir el bloque entero del prompt en vez de mandar una
// sección vacía.
function listarNotasParaPrompt(tareas: TareaContexto[], notasPorTareaId: Record<string, NotaContexto[]>): string | null {
  const lineas: string[] = []
  tareas.forEach((t, i) => {
    const notas = notasPorTareaId[t.id]
    if (!notas) return
    for (const n of notas) {
      const titulo = n.titulo ? `${n.titulo}: ` : ''
      lineas.push(`${i} ("${t.titulo}"): ${titulo}${n.contenido}`)
    }
  })
  return lineas.length > 0 ? lineas.join('\n') : null
}

// Sprint Archivos / Fase 5.3 — `context.conversationHistory` trae
// `{ conversaciones: Array<{ resumen: string; fecha: string }> }` (ver
// lib/ai/context/loaders.ts::cargarConversationHistory). Mismo criterio
// defensivo que normalizarNotasPorTarea: cualquier forma inesperada se
// descarta en silencio.
type ConversacionPasada = { resumen: string; fecha: string }

function normalizarConversacionesPasadas(historial: Record<string, unknown> | undefined): ConversacionPasada[] {
  const lista = historial?.conversaciones
  if (!Array.isArray(lista)) return []
  return lista.filter(
    (c): c is ConversacionPasada =>
      typeof c === 'object' && c !== null && typeof (c as ConversacionPasada).resumen === 'string' && typeof (c as ConversacionPasada).fecha === 'string'
  )
}

function listarConversacionesParaPrompt(conversaciones: ConversacionPasada[]): string | null {
  if (conversaciones.length === 0) return null
  return conversaciones.map((c) => `- (${c.fecha.slice(0, 10)}) ${c.resumen}`).join('\n')
}

function listarTareasParaPrompt(tareas: TareaContexto[]): string {
  if (tareas.length === 0) return '(el usuario todavía no tiene ninguna tarea registrada)'
  return tareas
    .map((t, i) => {
      const materia = t.materia ? ` (${t.materia})` : ''
      const fecha = t.fecha ? `vence ${t.fecha}` : 'sin fecha'
      const estado = t.completada ? 'completada' : 'pendiente'
      return `${i}: "${t.titulo}"${materia} — ${fecha} — ${estado}`
    })
    .join('\n')
}

// Ajuste (post 7.5) Parte 1-bis — `fechaISO` YA llega resuelta en zona
// horaria (ver la llamada en run(), vía hoyEnZona), nunca se calcula acá
// dentro. Antes esta función recibía un `Date` crudo y hacía
// `.toISOString().slice(0, 10)` — eso es la fecha UTC, no la fecha LOCAL
// del estudiante: cerca de medianoche en Colombia (UTC-5), la fecha UTC ya
// es "mañana" respecto a la real, así que "hoy es <UTC+1 día>" hacía que
// el modelo calculara "mañana" como HOY_REAL + 2. Bug real, reproducido:
// a las 23:59 hora de Bogotá, `new Date().toISOString()` ya daba el día
// siguiente. Mismo bug que HomeworkAgent ya había corregido en el Sprint 9
// (ver su fechaDeReferencia) — este agente nunca recibió ese fix porque no
// pasa por ContextEngine (no tiene contextScopes, ver comentario de la
// clase más abajo); se corrige acá con el mismo helper (hoyEnZona) en vez
// de duplicar su lógica.
function construirInstruccionSistema(
  fechaISO: string,
  tareasExistentes: TareaContexto[],
  hayHistorial: boolean,
  hayAdjunto: boolean,
  notasTexto: string | null,
  conversacionesTexto: string | null
): string {
  return [
    'Eres el motor de gestión de tareas de Flow+, una app de agenda académica para estudiantes.',
    `La fecha de hoy es ${fechaISO}. Úsala para resolver cualquier fecha relativa mencionada ("el viernes", "mañana").`,
    // Ajuste (post 7.5) Parte 1 — instrucción explícita añadida como
    // refuerzo defensivo: 9 pruebas reales contra Gemini (incluida una donde
    // el mensaje mencionaba a la vez la fecha de entrega Y el día de clase
    // de la materia, y otra de corrección en un turno de seguimiento) NUNCA
    // reprodujeron que el horario pisara una fecha explícita — el campo
    // "fecha" del modelo ya llegaba correcto en todos los casos, y
    // TaskManagementAgent no recibe el horario del estudiante (no tiene
    // contextScopes), así que no puede "preferirlo" aunque quisiera. Aun así
    // se deja esta regla sin ambigüedad, con la redacción que pidió el
    // usuario: el horario es una decisión exclusiva del servidor
    // (inferirFechaEntrega en POST /api/tareas), nunca del modelo.
    'Para el campo "fecha": si el usuario menciona una fecha o día específico (aunque sea relativo, como "el viernes" o "mañana"), calcúlala con la fecha de hoy de arriba y repórtala en el campo de fecha (YYYY-MM-DD). Si el usuario NO menciona ninguna fecha ni día, deja el campo vacío ("") — nunca la inventes ni la calcules por tu cuenta a partir de cuándo se dicta la materia; de eso se encarga el sistema después, no tú.',
    ...(hayHistorial
      ? [
          'Esta conversación ya tiene mensajes previos (te los paso como turnos anteriores) — puedes usarlos para entender referencias como "esa tarea", "la que mencioné antes" o "cámbiala también". Si el usuario se refiere a algo de un turno anterior tuyo, resuélvelo contra la lista de tareas existentes de abajo (los índices son siempre los de ESA lista, no de un turno anterior).',
        ]
      : []),
    ...(hayAdjunto
      ? [
          'El usuario adjuntó una imagen o PDF junto con su mensaje (foto de un enunciado, una hoja de instrucciones, una captura de un portal universitario). Léelo como fuente adicional de información: si describe una o más tareas, trátalas igual que si el texto las describiera directamente (usa tipo "crear" para cada una). Si el adjunto no tiene relación con una tarea académica, ignóralo y responde según el texto solamente.',
        ]
      : []),
    'El usuario puede pedir crear tareas nuevas, modificar tareas existentes (fecha, materia, título, prioridad, marcar como completada/pendiente) y/o borrar tareas existentes — todo en el mismo mensaje si quiere ("crea una tarea de X y borra la de Y").',
    'Estas son las tareas que el usuario ya tiene registradas, numeradas — usa SIEMPRE ese índice para referirte a una de ellas, nunca inventes uno:',
    listarTareasParaPrompt(tareasExistentes),
    ...(notasTexto
      ? [
          'El usuario tiene notas guardadas sobre algunas de estas tareas (mismo índice de arriba). Si pregunta algo sobre el contenido o progreso de una tarea, respóndele con tipoRespuesta "conversacional" citando el contenido real de la nota — nunca inventes contenido que no esté acá:',
          notasTexto,
        ]
      : []),
    ...(conversacionesTexto
      ? [
          'El sistema de Flow+ (no vos) registró y preparó automáticamente estos resúmenes de sesiones anteriores de este usuario con el asistente, más recientes primero. Es información real e ingresada por el sistema, igual que la lista de tareas de arriba — no es tu memoria personal, es un dato que se te está entregando ahora mismo. Si el usuario pregunta algo relacionado con una sesión anterior, respondé usando esta información directamente, con naturalidad (nunca dupliques la existencia de esta información ni digas frases como "no tengo memoria" o "no guardo historial" — el sistema SÍ lo guardó y te lo está pasando):',
          conversacionesTexto,
        ]
      : []),
    'Primero decide tipoRespuesta: "operaciones" si el texto pide crear, modificar o borrar algo relacionado a tareas (aunque no logres resolverlo del todo); "conversacional" en cualquier otro caso — en ese caso "mensaje" lleva una respuesta breve y natural, y "operaciones" va vacío. Para una respuesta "conversacional": si el usuario pregunta algo que SÍ podés responder con las notas o el historial de conversaciones que se te dan más abajo (si existen), respondé usando esa información directamente, con naturalidad, SIN aclarar límites de tu función. Aclará que tu función es gestionar tareas académicas SOLO cuando el mensaje de verdad no tiene relación con nada de lo anterior (un saludo suelto, una pregunta totalmente ajena) — no la repitas como muletilla en cada respuesta conversacional.',
    'Cada objeto de "operaciones" tiene SIEMPRE las mismas propiedades — completa TODAS en cada entrada, usando "" (o -1, o [], o el enum vacío) en las que no apliquen para ese tipo. NUNCA omitas una propiedad.',
    'Agrega UNA entrada en "operaciones" por cada acción DISTINTA que el usuario pidió (normalmente 1; si pide varias cosas en el mismo mensaje, una por cada una — nunca repitas la misma acción más de una vez):',
    '- tipo "crear": para una tarea nueva que no existía. titulo/materia/fecha/prioridad/tipoTarea/confidence son los de la tarea nueva (igual que si la extrajeras de cero). No inventes fechas ni materias no respaldadas por el texto. descripcion/completada/indiceObjetivo(-1)/indicesCandidatos([])/accionOriginal("") no aplican.',
    '- tipo "modificar" o "borrar": cuando el texto se refiere CLARAMENTE a UNA sola tarea de la lista de arriba — indiceObjetivo es su índice. Si es "modificar", pon en titulo/materia/fecha/prioridad/completada SOLO los campos que cambian (el resto en ""); completada es "true"/"false" si se pide marcar como completada/pendiente, "" si no. Si es "borrar", todos esos campos van vacíos — solo importa indiceObjetivo.',
    '- tipo "ambiguo": cuando la referencia del usuario ("la de matemáticas") calza con MÁS DE UNA tarea de la lista. indicesCandidatos lleva todos los índices que podrían ser, accionOriginal indica si el usuario quería modificar o borrar, y si es modificar los cambios propuestos van en titulo/materia/fecha/prioridad/completada igual que arriba.',
    '- tipo "sin_coincidencias": cuando el usuario se refiere a una tarea que NO está en la lista de arriba — descripcion explica a qué se refería.',
    '- tipo "crear_nota": cuando el usuario pide agregar una nota, anotación o comentario a una tarea existente (ej. "agrega una nota a mi tarea de Cálculo diciendo que faltó el punto 3"). indiceObjetivo (o indicesCandidatos si más de una tarea podría ser) identifica la tarea igual que en "modificar"/"borrar". contenidoNota lleva el contenido de la nota, redactado en español a partir de lo que pidió el usuario. NUNCA crees una tarea nueva solo para poder agregarle una nota — si la tarea no está en la lista, usa "sin_coincidencias" en su lugar.',
    'Nunca inventes un índice que no esté en la lista. Ante la duda entre "ambiguo" y adivinar, usa "ambiguo".',
    'Responde únicamente con el JSON solicitado.',
  ].join('\n')
}

// Agente nuevo, no una extensión de HomeworkAgent (Sprint 7.1 Parte 2):
// necesita contexto que HomeworkAgent no usa (la lista de tareas existentes
// del usuario, para resolver referencias ambiguas) y su contrato de salida
// es estructuralmente distinto (lista heterogénea de operaciones, no un
// arreglo plano de tareas nuevas) — mismo criterio de "un agente, una
// responsabilidad" del documento de arquitectura. HomeworkAgent se deja
// intacto (sigue probado y funcionando); /ai ahora llama a este agente
// porque es un superconjunto de su capacidad (también puede crear).
//
// Lectura de tareas existentes: NO pasa por ContextEngine — es una consulta
// puntual que hace el Route Handler (app/api/ai/tareas/route.ts) antes de
// llamar a aiOrchestrator.execute(), pasada como
// request.metadata.tareasExistentes. `TareaContexto` necesita más campos
// puntuales (fecha, completada) de los que un scope genérico de
// ContextEngine modela hoy, y ya existía antes de Sprint 9 — no vale la pena
// migrarlo solo por consistencia.
//
// Lectura de NOTAS (Sprint Archivos / Fase 4.3) sí pasa por ContextEngine
// (`contextScopes: ['academic']`, ver la definición arriba) — a diferencia
// de tareasExistentes, esto sí se agregó DESPUÉS de que ContextEngine
// implementara loaders reales (Sprint 9), así que no había motivo para
// reinventar una consulta puntual nueva.
class TaskManagementAgentImpl implements AIAgent<TaskManagementAgentOutput> {
  readonly definition = definition

  async run(request: AIRequest, context: AIContext, provider: AIProvider): Promise<AgentResult<TaskManagementAgentOutput>> {
    const startedAt = Date.now()
    const textoUsuario = typeof request.input === 'string' ? request.input.trim() : ''
    const adjuntos = normalizarAdjuntos(request.metadata)

    if (!textoUsuario && adjuntos.length === 0) {
      throw new AIValidationError('TaskManagementAgent requiere texto y/o un adjunto en request.input / metadata.adjuntos')
    }
    // Sub-sprint 7.3: mismo chequeo que ClassScheduleAgent — un agente que
    // manda imágenes/PDF debe comprobar que el proveedor las soporta, no
    // asumirlo. A diferencia de ClassScheduleAgent, acá el adjunto es
    // OPCIONAL (el flujo normal sigue siendo solo texto), así que el chequeo
    // también lo es.
    if (adjuntos.length > 0 && !provider.capabilities.supportsVision) {
      throw new AIValidationError(`El proveedor "${provider.id}" no soporta imágenes ni documentos`)
    }

    // Un mensaje puede ser SOLO el adjunto (el usuario no escribió nada) —
    // el texto real que se manda al modelo y que queda como `originalText`
    // nunca queda vacío en ese caso.
    const text = textoUsuario || 'Analiza el archivo adjunto y extrae la(s) tarea(s) que describe.'

    const tareasExistentes = normalizarTareasExistentes(request.metadata)
    const historial = normalizarHistorial(request.metadata)
    const notasPorTareaId = normalizarNotasPorTarea(context.academic)
    const notasTexto = listarNotasParaPrompt(tareasExistentes, notasPorTareaId)
    const conversacionesPasadas = normalizarConversacionesPasadas(context.conversationHistory)
    const conversacionesTexto = listarConversacionesParaPrompt(conversacionesPasadas)

    const metadata: StructuredProviderMetadata = {
      systemInstruction: construirInstruccionSistema(
        hoyEnZona(new Date(), ZONA_HORARIA_POR_DEFECTO),
        tareasExistentes,
        historial.length > 0,
        adjuntos.length > 0,
        notasTexto,
        conversacionesTexto
      ),
      outputSchema: TASK_MANAGEMENT_OUTPUT_SCHEMA,
      // Sin adjuntos: ninguna de las dos claves se agrega (undefined se
      // descarta al hacer spread más abajo), así que la llamada de
      // texto-solo sigue siendo byte-idéntica a antes de este sub-sprint —
      // misma propiedad de seguridad que ya vale para construirInput().
      ...(adjuntos.length > 0 ? { adjuntos, model: aiConfig.modeloVision } : {}),
    }

    // Sin historial: `input` sigue siendo el string plano (ruta ya probada,
    // sin cambios). Con historial: se arma la conversación completa —
    // turnos previos + el mensaje actual como último turno 'usuario' — y
    // GeminiProvider la traduce a la forma real de la Interactions API.
    const inputConHistorial: ConversationTurnInput[] | undefined =
      historial.length > 0 ? [...historial, { rol: 'usuario', texto: text }] : undefined

    const response = await provider.send({
      ...request,
      input: inputConHistorial ?? text,
      metadata: { ...request.metadata, ...metadata },
    })
    const parsed = parser.parse(response.content)

    if (!parsed.ok) {
      throw new AIValidationError(`Gemini devolvió una salida que no se pudo validar: ${parsed.error}`)
    }

    const operaciones = resolverOperaciones(parsed.data.operaciones, tareasExistentes)
    const notasParaCrear = resolverNotas(parsed.data.operaciones, tareasExistentes)
    const output: TaskManagementAgentOutput = {
      originalText: text,
      tipoRespuesta: parsed.data.tipoRespuesta,
      mensaje: parsed.data.mensaje,
      operaciones,
      notasParaCrear,
    }

    const confidencesCrear = operaciones.filter((op) => op.tipo === 'crear').map((op) => op.confidence)
    const confidencePromedio = confidencesCrear.length > 0 ? confidencesCrear.reduce((a, b) => a + b, 0) / confidencesCrear.length : undefined

    return {
      agentId: definition.id,
      requestId: request.id,
      status: 'success',
      output,
      confidence: confidencePromedio,
      startedAt,
      finishedAt: Date.now(),
    }
  }
}

export const taskManagementAgent: AIAgent<TaskManagementAgentOutput> = new TaskManagementAgentImpl()
