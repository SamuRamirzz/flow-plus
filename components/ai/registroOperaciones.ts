import type { Tarea } from '@/lib/types'
import type { CambiosTarea as CambiosTareaAPI, NuevaTareaInput } from '@/lib/tasks'
import type { CambiosTarea as CambiosTareaAgente } from '@/lib/ai/agents/taskManagement'

// Sprint 7.2 Parte B — registro de operaciones REALES ya aplicadas contra
// Supabase en esta sesión (a diferencia de OperacionEditable/Turno, que son
// propuestas todavía sin aplicar). Vive en app/ai/page.tsx, no en el
// overlay: a propósito sobrevive a que el overlay se cierre — el panel de
// tareas de la página (fuera del overlay) también debe poder mostrar
// "esto se modificó/borró recién" y ofrecer Deshacer después de cerrar, que
// es justo para lo que existe ese panel. Es de sesión igual: vive solo
// mientras el usuario sigue en /ai (se pierde al recargar o navegar fuera),
// nunca se persiste — ver nota de alcance en el registro de operaciones del
// plan (memoria de sesión, no la memoria persistente del Sprint 9).
export type RegistroCrear = { id: string; tipo: 'crear'; tareaId: string; titulo: string; deshecho: boolean }
export type RegistroModificar = {
  id: string
  tipo: 'modificar'
  tareaId: string
  titulo: string
  estadoAnterior: Tarea
  // Forma "agente" (materia = nombre legible), no la forma "API" (materiaId)
  // — es exactamente lo que ya traía OperacionModificarEditable.cambios
  // antes de aplicar, y es lo que chipsDeCambios (OperacionRow.tsx) ya sabe
  // mostrar como "antes → después" sin tener que resolver un id a nombre.
  cambiosAplicados: CambiosTareaAgente
  deshecho: boolean
}
export type RegistroBorrar = { id: string; tipo: 'borrar'; tareaId: string; titulo: string; tareaEliminada: Tarea; deshecho: boolean }

export type RegistroOperacion = RegistroCrear | RegistroModificar | RegistroBorrar

// Lo que hay que hacer para revertir un registro — deliberadamente NO sabe
// nada de fetch/URLs, eso ya vive en lib/tasks.ts (actualizarTarea/
// eliminarTarea/crearTarea); esta función solo decide QUÉ payload mandarles,
// para no duplicar la lógica de escritura. PURA: ni un await adentro.
export type AccionDeshacer =
  | { tipo: 'eliminar'; tareaId: string }
  | { tipo: 'actualizar'; tareaId: string; cambios: CambiosTareaAPI }
  | { tipo: 'recrear'; input: NuevaTareaInput }

export function payloadDeshacer(registro: RegistroOperacion): AccionDeshacer {
  if (registro.tipo === 'crear') {
    // Deshacer una creación es borrar lo que se creó.
    return { tipo: 'eliminar', tareaId: registro.tareaId }
  }
  if (registro.tipo === 'modificar') {
    // Deshacer una modificación es volver a poner el estado ANTERIOR
    // completo — no solo los campos que cambiaron — así una cadena de
    // deshacer-rehacer-deshacer no puede dejar campos a medio revertir.
    const t = registro.estadoAnterior
    return {
      tipo: 'actualizar',
      tareaId: registro.tareaId,
      cambios: { titulo: t.titulo, materiaId: t.materia_id, fecha: t.fecha_entrega ?? '', prioridad: t.prioridad, completada: t.completada },
    }
  }
  // Deshacer un borrado es recrear la tarea con sus datos reales. La tarea
  // recreada tendrá un id NUEVO (no hay forma de forzar el id original a
  // través de POST /api/tareas) — limitación documentada, no un bug: nada
  // en esta sesión vuelve a referenciar el id viejo salvo este mismo
  // registro, que se marca `deshecho` y deja de usarse.
  const t = registro.tareaEliminada
  return {
    tipo: 'recrear',
    input: { titulo: t.titulo, materiaId: t.materia_id, nuevaMateria: null, fecha: t.fecha_entrega ?? '', prioridad: t.prioridad },
  }
}
