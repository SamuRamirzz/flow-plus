import type { Puntualidad, EstadoDatos } from '@/lib/estadisticas/agregacion'

// Sprint 18a — Informes ejecutivos en PDF. Tipos compartidos entre el cálculo
// puro (lib/informes/*.ts), el render del PDF (lib/informes/pdf/*) y el
// Route Handler. Nada acá conoce React, Supabase ni el reloj.

export type Periodo = 'semanal' | 'mensual' | 'anual'

export const PERIODOS: Periodo[] = ['semanal', 'mensual', 'anual']

export function esPeriodo(valor: string): valor is Periodo {
  return (PERIODOS as string[]).includes(valor)
}

/** Rango de fechas ISO (YYYY-MM-DD), ambos extremos INCLUSIVE. */
export type RangoFechas = { desde: string; hasta: string }

/**
 * Una métrica comparada contra el periodo anterior.
 *
 * `comparable: false` cuando el periodo anterior no tiene con qué comparar
 * (el usuario empezó a usar la app este periodo). Es un estado DISTINTO de
 * "no cambió": mostrar "▲ 0 %" cuando en realidad no hay historial sería
 * inventar una comparación que nadie hizo.
 */
export type MetricaComparada = {
  actual: number
  anterior: number
  delta: number
  direccion: 'sube' | 'baja' | 'igual'
  comparable: boolean
}

/**
 * `porcentaje: null` significa "no aplica" (no había NADA que hacer en el
 * periodo), que es distinto de `0` ("había tareas y no completaste ninguna").
 * El PDF muestra "—" en el primer caso y "0 %" en el segundo — mentir ahí
 * sería el bug más fácil de cometer y el más difícil de notar.
 */
export type MetricasPeriodo = {
  completadas: number
  total: number
  porcentaje: number | null
  puntualidad: Puntualidad
  porcentajePuntualidad: number | null
  racha: number
}

export type FilaMateriaInforme = {
  materiaId: string
  nombre: string
  color: string
  completadas: number
  pendientes: number
  total: number
  porcentajePuntualidad: number | null
  tendencia: 'sube' | 'baja' | 'igual' | 'sin_comparacion'
}

export type PuntoTendencia = {
  /** Etiqueta corta para el eje X: 'L'…'D' | 'Sem 1'… | 'Ene'… */
  etiqueta: string
  /** Fecha ancla ISO del punto — hace los tests deterministas y legibles. */
  clave: string
  completadas: number
  total: number
}

export type Granularidad = 'dia' | 'semana' | 'mes'

export type SerieTendencia = { granularidad: Granularidad; puntos: PuntoTendencia[] }

export type ActividadPeriodo = {
  archivosSubidos: number
  notasCreadas: number
  resumenesIA: number
}

/** Solo para el informe anual — superlativos calculados, nunca interpretados. */
export type SuperlativosAnuales = {
  mejorMes: { etiqueta: string; porcentaje: number } | null
  peorMes: { etiqueta: string; porcentaje: number } | null
  materiaMasMejora: { nombre: string; deltaPuntos: number } | null
}

export type ItemProximo = {
  titulo: string
  materiaNombre: string | null
  fecha: string
  esExamen: boolean
  diasRestantes: number
}

/** Filas crudas que el informe necesita de `archivos` — solo estas columnas. */
export type FilaArchivoInforme = { created_at: string; analizado_en: string | null }

/** Filas crudas que el informe necesita de `notas`. */
export type FilaNotaInforme = { created_at: string }

export type DatosInforme = {
  periodo: Periodo
  rango: RangoFechas
  rangoPrevio: RangoFechas
  etiquetaPeriodo: string
  etiquetaPeriodoPrevio: string
  generadoEn: string
  usuario: { nombre: string | null }
  estadoDatos: EstadoDatos
  actual: MetricasPeriodo
  /** `null` = el periodo anterior no tiene ninguna tarea: no hay comparación posible. */
  previo: MetricasPeriodo | null
  comparacion: { completadas: MetricaComparada; puntualidad: MetricaComparada }
  materias: FilaMateriaInforme[]
  tendencia: SerieTendencia
  actividad: ActividadPeriodo
  actividadPrevia: ActividadPeriodo
  /** Solo cuando `periodo === 'anual'`. */
  superlativos: SuperlativosAnuales | null
  /** Vacío cuando `periodo === 'anual'` (ver calcular.ts). */
  proximos: ItemProximo[]
}

/**
 * Lo ÚNICO que ve el agente de IA. Deliberadamente agregados: ni un id, ni un
 * título de tarea, ni una fecha ISO — solo cifras ya calculadas y nombres de
 * materia. Reduce a casi cero la superficie de alucinación (no hay entidades
 * específicas que inventar) y de paso no expone datos personales al modelo.
 */
export type DatosSeccionIA = {
  periodo: Periodo
  etiquetaPeriodo: string
  completadas: { hechas: number; total: number; porcentaje: number | null }
  porcentajePuntualidad: number | null
  rachaDias: number
  deltaCompletadas: number | null
  deltaPuntualidad: number | null
  materias: { nombre: string; completadas: number; pendientes: number }[]
}
