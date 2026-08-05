import type { Materia, Tarea } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import { leerDatosInvitado, guardarDatosInvitado } from './almacen'
import {
  crearMateriaPura,
  crearTareaPura,
  actualizarTareaPura,
  eliminarTareaPura,
  agregarBloquePura,
  actualizarBloquePura,
  eliminarBloquePura,
  type NuevaTareaInvitadoInput,
  type CambiosTareaInvitado,
  type NuevoBloqueInvitadoInput,
  type CambiosBloqueInvitado,
} from './operaciones'

// API async con la MISMA forma que lib/tasks.ts / lib/horario/{cargar,mutar}.ts
// — así las ramas invitado que se agregan ahí (`if (await esInvitado())
// return xInvitado(...)`) son un simple redirect, sin que el llamador note
// diferencia. Cada función acá: lee el blob completo, aplica la operación
// PURA correspondiente (operaciones.ts), guarda el blob actualizado.

export async function cargarMateriasInvitado(): Promise<Materia[]> {
  return leerDatosInvitado().materias
}

export async function cargarTareasInvitado(): Promise<Tarea[]> {
  return leerDatosInvitado().tareas
}

export async function cargarHorarioInvitado(): Promise<BloqueHorario[]> {
  return leerDatosInvitado().horario
}

export async function crearMateriaInvitado(nombre: string): Promise<{ ok: true; materia: Materia; posibleDuplicado: null } | { ok: false; error: string }> {
  const datos = leerDatosInvitado()
  const resultado = crearMateriaPura(datos, nombre)
  guardarDatosInvitado(resultado.datos)
  return { ok: true, materia: resultado.materia, posibleDuplicado: null }
}

export type CrearTareaInvitadoResultado =
  | {
      ok: true
      materiaCreada?: Materia
      tareaCreada: Tarea
      fechaInferida?: undefined
      avisoFecha: null
      colisiones: []
      posibleDuplicado: null
    }
  | { ok: false; error: string }

export async function crearTareaInvitado(input: NuevaTareaInvitadoInput): Promise<CrearTareaInvitadoResultado> {
  const datos = leerDatosInvitado()
  const resultado = crearTareaPura(datos, input)
  if (!resultado.ok) return { ok: false, error: resultado.error }
  guardarDatosInvitado(resultado.datos)
  return {
    ok: true,
    tareaCreada: resultado.tarea,
    materiaCreada: resultado.materiaCreada ?? undefined,
    avisoFecha: null,
    colisiones: [],
    posibleDuplicado: null,
  }
}

export type ActualizarTareaInvitadoResultado =
  | { ok: true; tarea: Tarea; avisoFecha: null; colisiones: []; posibleDuplicado: null }
  | { ok: false; error: string }

export async function actualizarTareaInvitado(id: string, cambios: CambiosTareaInvitado): Promise<ActualizarTareaInvitadoResultado> {
  const datos = leerDatosInvitado()
  const resultado = actualizarTareaPura(datos, id, cambios)
  if (!resultado) return { ok: false, error: 'Tarea no encontrada' }
  guardarDatosInvitado(resultado.datos)
  return { ok: true, tarea: resultado.tarea, avisoFecha: null, colisiones: [], posibleDuplicado: null }
}

export async function eliminarTareaInvitado(id: string): Promise<{ ok: true; tareaEliminada: Tarea } | { ok: false; error: string }> {
  const datos = leerDatosInvitado()
  const resultado = eliminarTareaPura(datos, id)
  if (!resultado) return { ok: false, error: 'Tarea no encontrada' }
  guardarDatosInvitado(resultado.datos)
  return { ok: true, tareaEliminada: resultado.tareaEliminada }
}

export async function crearBloqueHorarioInvitado(input: NuevoBloqueInvitadoInput): Promise<{ ok: true; bloque: BloqueHorario } | { ok: false; error: string }> {
  const datos = leerDatosInvitado()
  const resultado = agregarBloquePura(datos, input)
  guardarDatosInvitado(resultado.datos)
  return { ok: true, bloque: resultado.bloque }
}

export async function actualizarBloqueHorarioInvitado(
  id: string,
  cambios: CambiosBloqueInvitado
): Promise<{ ok: true; bloque: BloqueHorario } | { ok: false; error: string }> {
  const datos = leerDatosInvitado()
  const resultado = actualizarBloquePura(datos, id, cambios)
  if (!resultado) return { ok: false, error: 'Bloque no encontrado' }
  guardarDatosInvitado(resultado.datos)
  return { ok: true, bloque: resultado.bloque }
}

export async function eliminarBloqueHorarioInvitado(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const datos = leerDatosInvitado()
  const resultado = eliminarBloquePura(datos, id)
  if (!resultado) return { ok: false, error: 'Bloque no encontrado' }
  guardarDatosInvitado(resultado)
  return { ok: true }
}
