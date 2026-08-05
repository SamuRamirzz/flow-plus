import type { Materia, Tarea } from '@/lib/types'
import { diaISODeFecha, diasEntre } from '@/lib/horario/dias'

// Sprint Home / Parte B — informes de rendimiento. PURO, mismo criterio que
// todo lib/horario/: cero I/O, cero new Date() acá dentro, `hoy` siempre
// inyectado. La aritmética de fechas reusa diaISODeFecha/diasEntre
// (lib/horario/dias.ts) en vez de reimplementar suma de fechas por tercera
// vez en el repo.

// Lunes (ISO) de la semana que contiene `fechaISO`. No existía un helper de
// esto en lib/horario/ — se construye acá con las piezas que sí existen:
// diaISODeFecha da 1..7 (1=lunes), así que retroceder (diaISO - 1) días
// desde `fechaISO` llega siempre al lunes de esa semana.
function lunesDeSemana(fechaISO: string): string {
  const diaISO = diaISODeFecha(fechaISO)
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  const epoca = Date.UTC(anio, mes - 1, dia) - (diaISO - 1) * 86_400_000
  const d = new Date(epoca)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function sumarDias(fechaISO: string, dias: number): string {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  const d = new Date(Date.UTC(anio, mes - 1, dia) + dias * 86_400_000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export type SemanaCumplimiento = {
  /** Lunes ISO de esa semana — la etiqueta de la barra en la gráfica. */
  inicioSemana: string
  completadas: number
  total: number
}

// Últimas `semanas` semanas (incluida la actual), agrupando por
// `fecha_entrega`: una tarea cuenta en la semana en la que vencía, no en la
// que se creó ni en la que se completó — es "qué tan bien cumpliste lo que
// tenías que entregar esa semana", que es la pregunta que un calendario
// académico realmente hace.
export function tendenciaSemanal(tareas: Tarea[], hoy: string, semanas: number): SemanaCumplimiento[] {
  const lunesActual = lunesDeSemana(hoy)

  // De más antigua a más reciente, para que la gráfica se lea de izquierda
  // a derecha como "el tiempo avanza".
  const semanasOrdenadas: string[] = []
  for (let i = semanas - 1; i >= 0; i--) {
    semanasOrdenadas.push(sumarDias(lunesActual, -7 * i))
  }

  return semanasOrdenadas.map((inicioSemana) => {
    const finSemana = sumarDias(inicioSemana, 6)
    const deEstaSemana = tareas.filter((t) => t.fecha_entrega !== null && t.fecha_entrega >= inicioSemana && t.fecha_entrega <= finSemana)
    return {
      inicioSemana,
      completadas: deEstaSemana.filter((t) => t.completada).length,
      total: deEstaSemana.length,
    }
  })
}

export type DesgloseMateria = {
  materiaId: string
  nombre: string
  color: string
  pendientes: number
  vencidas: number
}

// Ordenado por vencidas desc, luego pendientes desc: lo primero que se
// quiere ver es dónde el usuario se está quedando atrás DE VERDAD (vencida),
// no solo dónde tiene más trabajo por delante (pendiente, pero a tiempo
// todavía).
export function desglosePorMateria(tareas: Tarea[], materias: Materia[], hoy: string): DesgloseMateria[] {
  return materias
    .map((m) => {
      const deLaMateria = tareas.filter((t) => t.materia_id === m.id && !t.completada)
      const vencidas = deLaMateria.filter((t) => t.fecha_entrega !== null && t.fecha_entrega < hoy).length
      return { materiaId: m.id, nombre: m.nombre, color: m.color, pendientes: deLaMateria.length, vencidas }
    })
    .filter((m) => m.pendientes > 0)
    .sort((a, b) => (b.vencidas !== a.vencidas ? b.vencidas - a.vencidas : b.pendientes - a.pendientes))
}

export type Puntualidad = { aTiempo: number; tarde: number; sinDato: number }

// `completada_en` es un timestamp con hora; `fecha_entrega` es solo fecha.
// Se compara por el DÍA de completada_en contra fecha_entrega (no la hora
// exacta) — completar a las 23:50 del día que vencía sigue siendo "a
// tiempo", no "tarde por minutos".
export function calcularPuntualidad(tareas: Tarea[]): Puntualidad {
  let aTiempo = 0
  let tarde = 0
  let sinDato = 0

  for (const t of tareas) {
    if (!t.completada) continue
    if (t.completada_en === null || t.fecha_entrega === null) {
      sinDato++
      continue
    }
    const diaCompletado = t.completada_en.slice(0, 10)
    if (diaCompletado <= t.fecha_entrega) aTiempo++
    else tarde++
  }

  return { aTiempo, tarde, sinDato }
}

export type Racha = { diasSinVencidas: number }

// Días consecutivos hacia atrás desde `hoy` (sin incluir hoy — todavía
// puede pasar algo hoy) sin ninguna tarea que haya vencido ese día sin
// completarse. Se corta en el primer día con al menos una tarea así,
// retrocediendo. Tope de 365 días: una racha no puede crecer para siempre
// sin límite en el cálculo, y un año es más que suficiente para "no importa
// ya, la racha es larga" en la UI.
const TOPE_DIAS_RACHA = 365

export function calcularRacha(tareas: Tarea[], hoy: string): Racha {
  const vencidasPorFecha = new Map<string, number>()
  for (const t of tareas) {
    if (t.completada || t.fecha_entrega === null) continue
    vencidasPorFecha.set(t.fecha_entrega, (vencidasPorFecha.get(t.fecha_entrega) ?? 0) + 1)
  }
  // Tareas completadas TARDE también rompen la racha en el día en que
  // vencían: la racha mide "nunca dejé pasar una fecha límite", no "nunca
  // quedó nada pendiente" — si se completó después de vencer, ese día sí
  // se dejó pasar la fecha.
  for (const t of tareas) {
    if (!t.completada || t.fecha_entrega === null || t.completada_en === null) continue
    if (t.completada_en.slice(0, 10) > t.fecha_entrega) {
      vencidasPorFecha.set(t.fecha_entrega, (vencidasPorFecha.get(t.fecha_entrega) ?? 0) + 1)
    }
  }

  let dias = 0
  for (let i = 1; i <= TOPE_DIAS_RACHA; i++) {
    const fecha = sumarDias(hoy, -i)
    if (vencidasPorFecha.has(fecha)) break
    dias++
  }
  return { diasSinVencidas: dias }
}

export type EstadoDatos = 'sin_datos' | 'insuficiente' | 'completo'

const DIAS_HISTORIAL_MINIMO = 14

// 'sin_datos': nunca se completó nada — no hay ninguna tendencia que
//   mostrar, ni siquiera una mala.
// 'insuficiente': hay algo completado, pero el rango de fechas que cubre es
//   menor a DIAS_HISTORIAL_MINIMO — una "tendencia" de 3 días no es una
//   tendencia, es ruido.
// 'completo': el resto.
export function evaluarSuficiencia(tareas: Tarea[]): EstadoDatos {
  const completadas = tareas.filter((t) => t.completada && t.fecha_entrega !== null)
  if (completadas.length === 0) return 'sin_datos'

  const fechas = completadas.map((t) => t.fecha_entrega as string).sort()
  const rango = diasEntre(fechas[0], fechas[fechas.length - 1])
  return rango < DIAS_HISTORIAL_MINIMO ? 'insuficiente' : 'completo'
}
