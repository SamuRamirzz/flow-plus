import type { Materia } from '@/lib/types'
import type { ConversationTurnInput } from '@/lib/ai/providers/gemini'
import type { OperacionTarea, TaskManagementAgentOutput } from '@/lib/ai/agents/taskManagement'
import { MATERIA_NUEVA } from '@/components/ui/MateriaPicker'
import { resumirOperaciones } from './overlayLogic'
import type { OperacionEditable } from './OperacionRow'

// Sprint 7.2 Parte A — un turno de la conversación DENTRO de una sesión del
// overlay. Vive solo en memoria de React mientras el overlay está montado
// (useState en AIImmersiveOverlay) — nunca en Supabase ni localStorage, a
// propósito: es memoria de sesión efímera, no la memoria persistente de 6
// scopes que sigue siendo Sprint 9. Al cerrar el overlay el componente se
// desmonta y el historial desaparece solo, sin lógica de "reset" explícita.
export type TurnoUsuario = { rol: 'usuario'; id: string; texto: string }

export type TurnoIA = {
  rol: 'ia'
  id: string
  // 'error' cubre tanto un fallo real (red/servidor) como "el usuario
  // quería hacer algo pero no se pudo resolver nada" (operaciones vacío) —
  // mismo tratamiento visual danger que ya existía para ambos casos antes
  // de que hubiera turnos, ahora unificado en un solo valor.
  tipoRespuesta: 'operaciones' | 'conversacional' | 'error'
  /** Conversacional: la respuesta natural. Error: el mensaje de error. */
  mensaje: string | null
  /** Solo si tipoRespuesta === 'operaciones' — resumirOperaciones() del resultado. */
  resumen: string | null
  operaciones: OperacionEditable[]
  aplicando: boolean
  aplicadoOk: boolean
}

export type Turno = TurnoUsuario | TurnoIA

// Traduce los turnos ya acumulados en la sesión al contrato angosto que
// entiende GeminiProvider (ver ConversationTurnInput ahí) — es lo que viaja
// como `historial` en el body de POST /api/ai/tareas antes de mandar el
// mensaje nuevo. PURO: solo lee los turnos, no hace I/O.
//
// El turno de la IA se representa con el mismo texto que el usuario ya vio
// en pantalla (mensaje conversacional o el resumen de operaciones) — no el
// JSON crudo del modelo ni los ids reales de las tareas: es suficiente para
// que el modelo mantenga contexto ("esa tarea que mencioné") sin filtrar
// datos que no hacían falta en la conversación misma. Un turno 'error' no
// se manda — no aporta contexto útil y solo ensuciaría la conversación.
export function historialParaAgente(turnos: Turno[]): ConversationTurnInput[] {
  const historial: ConversationTurnInput[] = []
  for (const turno of turnos) {
    if (turno.rol === 'usuario') {
      historial.push({ rol: 'usuario', texto: turno.texto })
      continue
    }
    if (turno.tipoRespuesta === 'error') continue
    const texto = turno.tipoRespuesta === 'conversacional' ? turno.mensaje : turno.resumen
    if (texto) historial.push({ rol: 'modelo', texto })
  }
  return historial
}

// Resuelve el nombre de materia que devuelve el agente contra la lista real
// del usuario (case-insensitive) — si ya existe, se referencia por id; si
// no, queda como "nueva materia" con el nombre tal cual, mismo patrón que
// ya usaba HomeworkAgent antes de que existiera esta conversación por turnos.
export function materiaParaNombre(nombre: string | null, materias: Materia[]): { materiaId: string; nuevaMateria: string } {
  if (!nombre) return { materiaId: MATERIA_NUEVA, nuevaMateria: '' }
  const existente = materias.find((m) => m.nombre.toLowerCase() === nombre.toLowerCase())
  return existente ? { materiaId: existente.id, nuevaMateria: '' } : { materiaId: MATERIA_NUEVA, nuevaMateria: nombre }
}

function operacionesAEditable(ops: OperacionTarea[], materias: Materia[], textoOrigen: string): OperacionEditable[] {
  return ops.map((op): OperacionEditable => {
    if (op.tipo === 'crear') {
      return {
        tipo: 'crear',
        id: op.id,
        titulo: op.titulo,
        fecha: op.fecha ?? '',
        prioridad: op.prioridad,
        tipoTarea: op.tipoTarea,
        textoOrigen,
        ...materiaParaNombre(op.materia, materias),
      }
    }
    if (op.tipo === 'modificar') return { tipo: 'modificar', id: op.id, tareaId: op.tareaId, antes: op.antes, cambios: op.cambios }
    if (op.tipo === 'borrar') return { tipo: 'borrar', id: op.id, tareaId: op.tareaId, antes: op.antes }
    if (op.tipo === 'ambiguo') {
      return {
        tipo: 'ambiguo',
        id: op.id,
        descripcion: op.descripcion,
        accionOriginal: op.accionOriginal,
        cambiosPropuestos: op.cambiosPropuestos,
        candidatos: op.candidatos,
      }
    }
    return { tipo: 'sin_coincidencias', id: op.id, descripcion: op.descripcion }
  })
}

// Traduce la salida ya exitosa del agente a un turno de IA listo para
// mostrar y, si aplica, aplicar — PURO (nada de fetch acá, eso es del
// llamador). El caso de fallo de red/servidor no pasa por acá: se arma un
// TurnoIA 'error' directamente en el sitio de la llamada, es un objeto
// literal de 3 campos que no amerita su propia función ni test.
export function construirTurnoIA(id: string, output: TaskManagementAgentOutput, materias: Materia[], textoOrigen = ''): TurnoIA {
  if (output.tipoRespuesta === 'conversacional') {
    return {
      rol: 'ia',
      id,
      tipoRespuesta: 'conversacional',
      mensaje: output.mensaje ?? 'Puedo ayudarte a gestionar tus tareas — cuéntame qué quieres crear, cambiar o borrar.',
      resumen: null,
      operaciones: [],
      aplicando: false,
      aplicadoOk: false,
    }
  }
  if (output.operaciones.length === 0) {
    return {
      rol: 'ia',
      id,
      tipoRespuesta: 'error',
      mensaje: 'No entendí qué querías hacer con tus tareas — intenta ser más específico.',
      resumen: null,
      operaciones: [],
      aplicando: false,
      aplicadoOk: false,
    }
  }
  return {
    rol: 'ia',
    id,
    tipoRespuesta: 'operaciones',
    mensaje: null,
    resumen: resumirOperaciones(output.operaciones),
    operaciones: operacionesAEditable(output.operaciones, materias, textoOrigen),
    aplicando: false,
    aplicadoOk: false,
  }
}
