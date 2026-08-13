import type { Materia, Tarea } from '@/lib/types'
import { calcularPuntualidad } from '@/lib/estadisticas/agregacion'
import { diasEntre, lunesDeSemana, sumarDias, sumarMeses, primerDiaDeMes, ultimoDiaDeMes, diaISODeFecha } from '@/lib/horario/dias'
import { inicialDia, nombreMesCorto, porcentaje } from './formato'
import { tareasDelRango, filasDelRango } from './rango'
import type {
  ActividadPeriodo,
  FilaArchivoInforme,
  FilaMateriaInforme,
  FilaNotaInforme,
  ItemProximo,
  MetricasPeriodo,
  Periodo,
  PuntoTendencia,
  RangoFechas,
  SerieTendencia,
  SuperlativosAnuales,
} from './tipos'

// Sprint 18a — PURO. Agregaciones que `lib/estadisticas/agregacion.ts` no
// puede dar porque ninguna de sus funciones acepta un rango arbitrario.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUÉ NO SE EXTIENDEN LAS FIRMAS DE agregacion.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ese módulo alimenta 6 componentes de Home que hoy funcionan y tiene su
// propia batería de tests. Añadirle parámetros de rango significa ramas nuevas
// de comportamiento que hay que probar en ambas direcciones, para un beneficio
// nulo en Home (que nunca pide un rango arbitrario). En vez de eso, se le
// PRE-FILTRA el array de tareas — que es exactamente el uso previsto de una
// función pura sin estado. `calcularPuntualidad` se reusa tal cual.

/** Métricas del conjunto de tareas YA filtrado al rango. */
export function metricasDeRango(tareasDelPeriodo: Tarea[], racha: number): MetricasPeriodo {
  const completadas = tareasDelPeriodo.filter((t) => t.completada).length
  const total = tareasDelPeriodo.length
  const puntualidad = calcularPuntualidad(tareasDelPeriodo)
  const conDato = puntualidad.aTiempo + puntualidad.tarde

  return {
    completadas,
    total,
    porcentaje: porcentaje(completadas, total),
    puntualidad,
    porcentajePuntualidad: porcentaje(puntualidad.aTiempo, conDato),
    racha,
  }
}

/**
 * Desglose por materia del periodo.
 *
 * NO reusa `desglosePorMateria` de agregacion.ts a propósito: esa función
 * FILTRA las materias con 0 pendientes (`.filter(m => m.pendientes > 0)`),
 * que es correcto para Home ("dónde te estás quedando atrás") y equivocado
 * para un informe — una materia con 5 de 5 completadas es justamente la fila
 * que el usuario quiere ver, no una que haya que esconder.
 */
export function materiasDeRango(
  tareasActual: Tarea[],
  tareasPrevias: Tarea[],
  materias: Materia[]
): FilaMateriaInforme[] {
  const porcentajePrevioPorMateria = new Map<string, number | null>()
  for (const m of materias) {
    const suyas = tareasPrevias.filter((t) => t.materia_id === m.id)
    porcentajePrevioPorMateria.set(m.id, porcentaje(suyas.filter((t) => t.completada).length, suyas.length))
  }

  return materias
    .map((m) => {
      const suyas = tareasActual.filter((t) => t.materia_id === m.id)
      const completadas = suyas.filter((t) => t.completada).length
      const pendientes = suyas.length - completadas
      const puntualidad = calcularPuntualidad(suyas)
      const conDato = puntualidad.aTiempo + puntualidad.tarde

      const pctActual = porcentaje(completadas, suyas.length)
      const pctPrevio = porcentajePrevioPorMateria.get(m.id) ?? null

      let tendencia: FilaMateriaInforme['tendencia'] = 'sin_comparacion'
      if (pctActual !== null && pctPrevio !== null) {
        const delta = pctActual - pctPrevio
        tendencia = Math.abs(delta) < UMBRAL_IGUAL_PP ? 'igual' : delta > 0 ? 'sube' : 'baja'
      }

      return {
        materiaId: m.id,
        nombre: m.nombre,
        color: m.color,
        completadas,
        pendientes,
        total: suyas.length,
        porcentajePuntualidad: porcentaje(puntualidad.aTiempo, conDato),
        tendencia,
      }
    })
    .filter((f) => f.total > 0) // una materia sin NADA en el periodo no aporta una fila
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Menos de 1 punto porcentual de diferencia se considera "igual". */
const UMBRAL_IGUAL_PP = 1

/**
 * Serie para el gráfico, con la granularidad que corresponde al periodo.
 * SIEMPRE devuelve la longitud completa del periodo (7 días, N semanas, 12
 * meses) aunque haya tramos en cero: un gráfico que solo dibuja los días con
 * datos miente sobre la forma de la semana.
 */
export function serieTendencia(tareasDelPeriodo: Tarea[], periodo: Periodo, rango: RangoFechas): SerieTendencia {
  if (periodo === 'semanal') return { granularidad: 'dia', puntos: puntosPorDia(tareasDelPeriodo, rango) }
  if (periodo === 'mensual') return { granularidad: 'semana', puntos: puntosPorSemana(tareasDelPeriodo, rango) }
  return { granularidad: 'mes', puntos: puntosPorMes(tareasDelPeriodo, rango) }
}

function contar(tareas: Tarea[], desde: string, hasta: string): { completadas: number; total: number } {
  const dentro = tareas.filter((t) => t.fecha_entrega !== null && t.fecha_entrega >= desde && t.fecha_entrega <= hasta)
  return { completadas: dentro.filter((t) => t.completada).length, total: dentro.length }
}

function puntosPorDia(tareas: Tarea[], rango: RangoFechas): PuntoTendencia[] {
  const puntos: PuntoTendencia[] = []
  const dias = diasEntre(rango.desde, rango.hasta)
  for (let i = 0; i <= dias; i++) {
    const fecha = sumarDias(rango.desde, i)
    puntos.push({ etiqueta: inicialDia(diaISODeFecha(fecha)), clave: fecha, ...contar(tareas, fecha, fecha) })
  }
  return puntos
}

function puntosPorSemana(tareas: Tarea[], rango: RangoFechas): PuntoTendencia[] {
  const puntos: PuntoTendencia[] = []
  // Arranca en el lunes de la semana del día 1: una semana que empieza en el
  // mes anterior sigue siendo "la semana 1" de este mes desde el punto de
  // vista del usuario, pero solo se cuentan las tareas DENTRO del rango.
  let inicio = lunesDeSemana(rango.desde)
  let n = 1
  while (inicio <= rango.hasta) {
    const finSemana = sumarDias(inicio, 6)
    const desde = inicio < rango.desde ? rango.desde : inicio
    const hasta = finSemana > rango.hasta ? rango.hasta : finSemana
    puntos.push({ etiqueta: `Sem ${n}`, clave: desde, ...contar(tareas, desde, hasta) })
    inicio = sumarDias(inicio, 7)
    n++
  }
  return puntos
}

function puntosPorMes(tareas: Tarea[], rango: RangoFechas): PuntoTendencia[] {
  const puntos: PuntoTendencia[] = []
  let mes = primerDiaDeMes(rango.desde)
  while (mes <= rango.hasta) {
    const fin = ultimoDiaDeMes(mes)
    const hasta = fin > rango.hasta ? rango.hasta : fin
    puntos.push({ etiqueta: nombreMesCorto(Number(mes.slice(5, 7))), clave: mes, ...contar(tareas, mes, hasta) })
    mes = primerDiaDeMes(sumarMeses(mes, 1))
  }
  return puntos
}

export function actividadDeRango(
  archivos: FilaArchivoInforme[],
  notas: FilaNotaInforme[],
  rango: RangoFechas
): ActividadPeriodo {
  const archivosDelRango = filasDelRango(archivos, rango)
  // Los resúmenes se cuentan por `analizado_en` (cuándo la IA lo analizó), no
  // por `created_at`: un archivo subido en julio y analizado en agosto es
  // actividad de IA de AGOSTO.
  const resumenesIA = archivos.filter((a) => {
    if (!a.analizado_en) return false
    const dia = a.analizado_en.slice(0, 10)
    return dia >= rango.desde && dia <= rango.hasta
  }).length

  return {
    archivosSubidos: archivosDelRango.length,
    notasCreadas: filasDelRango(notas, rango).length,
    resumenesIA,
  }
}

/**
 * Superlativos del informe anual. Son CÁLCULOS sobre datos reales
 * (max/min/mayor delta), nunca interpretación — por eso viven acá, en la capa
 * determinística, y no en la sección de IA.
 */
export function superlativosAnuales(
  puntosMensuales: PuntoTendencia[],
  materiasActual: FilaMateriaInforme[],
  tareasPrevias: Tarea[],
  materias: Materia[]
): SuperlativosAnuales {
  // Solo meses con tareas: un mes vacío no es "el peor mes", es un mes sin clases.
  const conDatos = puntosMensuales
    .filter((p) => p.total > 0)
    .map((p) => ({ etiqueta: p.etiqueta, porcentaje: porcentaje(p.completadas, p.total) as number }))

  const mejorMes = conDatos.length > 0 ? conDatos.reduce((a, b) => (b.porcentaje > a.porcentaje ? b : a)) : null
  const peorMes = conDatos.length > 1 ? conDatos.reduce((a, b) => (b.porcentaje < a.porcentaje ? b : a)) : null

  let materiaMasMejora: SuperlativosAnuales['materiaMasMejora'] = null
  for (const m of materias) {
    const previas = tareasPrevias.filter((t) => t.materia_id === m.id)
    const pctPrevio = porcentaje(previas.filter((t) => t.completada).length, previas.length)
    const fila = materiasActual.find((f) => f.materiaId === m.id)
    if (pctPrevio === null || !fila) continue
    const pctActual = porcentaje(fila.completadas, fila.total)
    if (pctActual === null) continue
    const delta = pctActual - pctPrevio
    if (delta > 0 && (materiaMasMejora === null || delta > materiaMasMejora.deltaPuntos)) {
      materiaMasMejora = { nombre: m.nombre, deltaPuntos: delta }
    }
  }

  return { mejorMes, peorMes, materiaMasMejora }
}

/** Próximos vencimientos DESPUÉS de `hoy` — exámenes primero a igual fecha. */
export function proximosItems(tareas: Tarea[], materias: Materia[], hoy: string, limite: number): ItemProximo[] {
  const nombrePorMateria = new Map(materias.map((m) => [m.id, m.nombre]))
  return tareas
    .filter((t) => !t.completada && t.fecha_entrega !== null && t.fecha_entrega > hoy)
    .sort((a, b) => {
      const f = (a.fecha_entrega as string).localeCompare(b.fecha_entrega as string)
      if (f !== 0) return f
      return Number(b.tipo === 'examen') - Number(a.tipo === 'examen')
    })
    .slice(0, limite)
    .map((t) => ({
      titulo: t.titulo,
      materiaNombre: t.materia_id ? (nombrePorMateria.get(t.materia_id) ?? null) : null,
      fecha: t.fecha_entrega as string,
      esExamen: t.tipo === 'examen',
      diasRestantes: diasEntre(hoy, t.fecha_entrega as string),
    }))
}

export { tareasDelRango }
