// `import type` a propósito, NO un import normal: lib/tasks.ts importa
// lib/supabase.ts, que crea un cliente Supabase en tiempo de módulo (mismo
// problema ya documentado en lib/useRealtimeSync.ts/realtimeReconciliar.ts)
// y rompe Vitest en el entorno 'node' por defecto de este proyecto —
// verificado: sin este cambio, cargar este archivo en un test lanza
// "Your project's URL and API key are required...". `import type` se borra
// del todo en compilación, así que no hay import real en runtime. Quien SÍ
// necesita las funciones reales (components/invitado/SincronizadorInvitado.tsx,
// un 'use client', nunca corre en el entorno de test) las importa y arma el
// objeto `acciones` ahí — este archivo no trae ningún valor por defecto.
import type { crearMateria, crearTarea, actualizarTarea } from '@/lib/tasks'
import type { crearBloqueHorario } from '@/lib/horario/mutar'
import type { DatosInvitado } from './tipos'

// Inyectables — mismo patrón "inyectar funciones reales, no mockear red"
// que ya usan los tests de IA de este proyecto.
export type AccionesSincronizacion = {
  crearMateria: typeof crearMateria
  crearTarea: typeof crearTarea
  actualizarTarea: typeof actualizarTarea
  crearBloqueHorario: typeof crearBloqueHorario
}

export type ResultadoSincronizacion =
  | { ok: true; resumen: { materias: number; tareas: number; bloques: number } }
  | { ok: false; error: string; parcial: boolean }

// Reusa los mismos endpoints REALES que ya usan AddTaskBar/app/horario/
// page.tsx contra la cuenta recién creada — no hay Route Handler nuevo, no
// hay columna nueva en la base. De paso, el enriquecimiento que solo existe
// para cuentas reales (ícono por IA si el determinístico no matcheó, dedup
// semántico de CalendarAgent, ExamAgent si hay tareas tipo examen) se
// aplica gratis acá, aunque nunca se aplicó mientras la tarea vivía en modo
// invitado.
//
// Riesgo aceptado y documentado, no resuelto con infraestructura nueva: si
// esto falla a mitad de camino y se reintenta, los ítems que ya se habían
// creado antes de la falla se crearían de nuevo (no hay dedup de tareas por
// título en el servidor). Dado el volumen esperado — pocos ítems, una sola
// vez, al registrarse — se documenta como límite conocido en vez de
// construir un sistema de idempotencia para un caso raro.
export async function sincronizarInvitado(datos: DatosInvitado, acciones: AccionesSincronizacion): Promise<ResultadoSincronizacion> {
  if (datos.materias.length === 0 && datos.tareas.length === 0 && datos.horario.length === 0) {
    return { ok: true, resumen: { materias: 0, tareas: 0, bloques: 0 } }
  }

  const mapaMaterias = new Map<string, string>()
  for (const m of datos.materias) {
    const r = await acciones.crearMateria(m.nombre)
    if (!r.ok) return { ok: false, error: r.error, parcial: mapaMaterias.size > 0 }
    mapaMaterias.set(m.id, r.materia.id)
  }

  let tareasCreadas = 0
  for (const t of datos.tareas) {
    const materiaId = t.materia_id ? (mapaMaterias.get(t.materia_id) ?? null) : null
    const r = await acciones.crearTarea(
      { titulo: t.titulo, materiaId, nuevaMateria: null, fecha: t.fecha_entrega ?? '', prioridad: t.prioridad, tipo: t.tipo },
      []
    )
    if (!r.ok) return { ok: false, error: r.error, parcial: true }
    if (t.completada) await acciones.actualizarTarea(r.tareaCreada.id, { completada: true })
    tareasCreadas++
  }

  let bloquesCreados = 0
  for (const b of datos.horario) {
    // Sprint Zonas de horario — un bloque especial (tipo !== 'clase') no
    // tiene materia local que remapear: se sincroniza directo con
    // materiaId: null, mismo criterio que el resto del proyecto.
    if (b.tipo !== 'clase') {
      const r = await acciones.crearBloqueHorario({ tipo: b.tipo, materiaId: null, diaSemana: b.diaSemana, horaInicio: b.horaInicio, horaFin: b.horaFin })
      if (r.ok) bloquesCreados++
      continue
    }

    const materiaId = b.materiaId ? mapaMaterias.get(b.materiaId) : undefined
    if (!materiaId) continue // defensivo: no debería pasar, cada bloque local de clase referencia una materia local
    const r = await acciones.crearBloqueHorario({ tipo: 'clase', materiaId, diaSemana: b.diaSemana, horaInicio: b.horaInicio, horaFin: b.horaFin })
    if (r.ok) bloquesCreados++
  }

  return { ok: true, resumen: { materias: mapaMaterias.size, tareas: tareasCreadas, bloques: bloquesCreados } }
}
