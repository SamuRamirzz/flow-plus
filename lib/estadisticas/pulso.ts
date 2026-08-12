import type { Materia, Tarea } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import { diaISODeFecha } from '@/lib/horario/dias'

// Sprint Home / Parte A — "el pulso del día". PURO, mismo criterio que
// lib/horario/inferirFecha.ts: cero I/O, cero new Date()/Date.now() acá
// dentro. `hoy` y `horaActual` siempre llegan inyectados desde quien llama
// (en el cliente, hoyISOLocal() de lib/horario/hoy.ts — la hora local del
// usuario es exactamente lo correcto para "qué tan lejos está mi próxima
// clase", el mismo razonamiento que ya documenta ese archivo).

export type ProximaClase = {
  bloque: BloqueHorario
  materiaNombre: string
  minutosHasta: number
} | null

// 'HH:MM' → minutos desde medianoche. Aritmética de string, no Date: un
// bloque de horario ya guarda la hora como 'HH:MM' (ver lib/horario/tipos.ts),
// así que convertir a Date y de vuelta sería trabajo de más y una fuente de
// desfase de zona horaria que no hace falta correr.
function minutosDesdeMedianoche(horaHHMM: string): number {
  const [h, m] = horaHHMM.split(':').map(Number)
  return h * 60 + m
}

// Bloques de HOY que todavía no empezaron, ordenados por el que está más
// cerca. Bloques ya iniciados o terminados no cuentan como "próxima
// clase" — el pulso del día mira hacia adelante, no hacia atrás.
//
// Sprint Zonas de horario — solo bloques `tipo: 'clase'` cuentan como
// "próxima clase": un "Ingreso" o "Descanso" agendado antes de la clase
// real de hoy no debe robarle el lugar en esta tarjeta (y ni siquiera podría
// mostrarse bien — no tiene materia que buscar en `materias`).
export function proximaClaseHoy(horario: BloqueHorario[], materias: Materia[], hoy: string, horaActual: string): ProximaClase {
  const diaHoy = diaISODeFecha(hoy)
  const minutosAhora = minutosDesdeMedianoche(horaActual)

  const candidatos = horario
    .filter((b) => b.tipo === 'clase' && b.diaSemana === diaHoy && b.horaInicio !== null)
    .map((b) => ({ bloque: b, minutosInicio: minutosDesdeMedianoche(b.horaInicio as string) }))
    .filter((c) => c.minutosInicio > minutosAhora)
    .sort((a, b) => a.minutosInicio - b.minutosInicio)

  if (candidatos.length === 0) return null

  const elegido = candidatos[0]
  const materia = materias.find((m) => m.id === elegido.bloque.materiaId)

  return {
    bloque: elegido.bloque,
    materiaNombre: materia?.nombre ?? 'Materia',
    minutosHasta: elegido.minutosInicio - minutosAhora,
  }
}

export type Encabezado = { titulo: string; subtitulo?: string }

// Umbral: una clase "próxima" deja de sentirse inminente pasada la hora —
// más allá de eso, mencionar el conteo de tareas de hoy (si hay) o el
// mensaje neutro es más útil que anunciar algo que falta medio día.
const MINUTOS_CLASE_INMINENTE = 60

// Reglas, en orden — cada una su propio test en __tests__/pulso.test.ts:
//   1. Hay tareas pendientes con fecha_entrega === hoy → cuenta cuántas.
//      Gana siempre sobre la próxima clase: es más accionable (una entrega
//      hoy importa más que saber cuándo es la próxima clase).
//   2. Sin tareas hoy, pero hay una clase en <= 60 minutos → la anuncia.
//   3. Ninguna de las dos → mensaje neutro que invita a adelantar.
export function encabezadoVivo(tareas: Tarea[], proximaClase: ProximaClase, hoy: string): Encabezado {
  const tareasHoy = tareas.filter((t) => !t.completada && t.fecha_entrega === hoy)

  if (tareasHoy.length > 0) {
    return {
      titulo: `Tienes ${tareasHoy.length} tarea${tareasHoy.length === 1 ? '' : 's'} hoy`,
      subtitulo: tareasHoy.length === 1 ? tareasHoy[0].titulo : undefined,
    }
  }

  if (proximaClase !== null && proximaClase.minutosHasta <= MINUTOS_CLASE_INMINENTE) {
    return {
      titulo: `Tu próxima clase, ${proximaClase.materiaNombre}, es en ${proximaClase.minutosHasta} minuto${proximaClase.minutosHasta === 1 ? '' : 's'}`,
    }
  }

  return { titulo: 'Nada pendiente hoy, buen momento para adelantar' }
}

export type TareaProxima = { tarea: Tarea; materia: Materia | null }

// Lo que ve `ProximasTareas`: pendientes con fecha, hoy y mañana primero,
// las más urgentes arriba. `limite` acota la lista compacta (el detalle
// completo ya vive en TaskTable, más abajo en la página).
export function proximasTareas(tareas: Tarea[], materias: Materia[], hoy: string, limite = 5): TareaProxima[] {
  return tareas
    .filter((t) => !t.completada && t.fecha_entrega !== null)
    .sort((a, b) => (a.fecha_entrega as string).localeCompare(b.fecha_entrega as string))
    .slice(0, limite)
    .map((tarea) => ({ tarea, materia: materias.find((m) => m.id === tarea.materia_id) ?? null }))
}
