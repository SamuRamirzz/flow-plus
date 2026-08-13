import type { Materia, Tarea } from '@/lib/types'
import { calcularRacha, evaluarSuficiencia } from '@/lib/estadisticas/agregacion'
import { actividadDeRango, materiasDeRango, metricasDeRango, proximosItems, serieTendencia, superlativosAnuales } from './agregacionRango'
import { compararMetricas } from './comparar'
import { etiquetaPeriodo } from './formato'
import { rangoAnterior, rangoDePeriodo, tareasDelRango } from './rango'
import type { DatosInforme, DatosSeccionIA, FilaArchivoInforme, FilaNotaInforme, Periodo } from './tipos'

// Sprint 18a — LA función central. 100 % PURA: recibe todo ya cargado (mismo
// patrón puro/impuro del resto del repo), no toca Supabase, no llama a
// `new Date()`. `fechaReferencia` se inyecta ya resuelta en la zona horaria
// del usuario (hoyEnZona) desde el Route Handler.

/** Máximo de ítems en "Lo que viene" — cabe en el pie de página sin desbordar. */
const MAX_PROXIMOS = 5

export type EntradaCalculoInforme = {
  periodo: Periodo
  fechaReferencia: string
  nombreUsuario: string | null
  tareas: Tarea[]
  materias: Materia[]
  archivos: FilaArchivoInforme[]
  notas: FilaNotaInforme[]
}

export function calcularDatosInforme(entrada: EntradaCalculoInforme): DatosInforme {
  const { periodo, fechaReferencia, tareas, materias, archivos, notas } = entrada

  const rango = rangoDePeriodo(periodo, fechaReferencia)
  const rangoPrevio = rangoAnterior(periodo, rango)

  const delRango = tareasDelRango(tareas, rango)
  const delRangoPrevio = tareasDelRango(tareas, rangoPrevio)

  // ⚠️ `calcularRacha` y `evaluarSuficiencia` reciben el historial COMPLETO,
  // no el filtrado: una racha se corta con tareas de ANTES del periodo, y la
  // suficiencia de datos es una propiedad del usuario, no del rango. Filtrar
  // acá daría una racha falsamente larga al principio de cada periodo.
  const racha = calcularRacha(tareas, fechaReferencia).diasSinVencidas
  const estadoDatos = evaluarSuficiencia(tareas)

  const actual = metricasDeRango(delRango, racha)
  const hayDatosPrevios = delRangoPrevio.length > 0
  const previo = hayDatosPrevios ? metricasDeRango(delRangoPrevio, racha) : null

  const tendencia = serieTendencia(delRango, periodo, rango)
  const filasMaterias = materiasDeRango(delRango, delRangoPrevio, materias)

  return {
    periodo,
    rango,
    rangoPrevio,
    etiquetaPeriodo: etiquetaPeriodo(periodo, rango),
    etiquetaPeriodoPrevio: etiquetaPeriodo(periodo, rangoPrevio),
    generadoEn: fechaReferencia,
    usuario: { nombre: entrada.nombreUsuario },
    estadoDatos,
    actual,
    previo,
    comparacion: {
      completadas: compararMetricas(actual.porcentaje, previo?.porcentaje ?? null, hayDatosPrevios),
      puntualidad: compararMetricas(actual.porcentajePuntualidad, previo?.porcentajePuntualidad ?? null, hayDatosPrevios),
    },
    materias: filasMaterias,
    tendencia,
    actividad: actividadDeRango(archivos, notas, rango),
    actividadPrevia: actividadDeRango(archivos, notas, rangoPrevio),
    superlativos: periodo === 'anual' ? superlativosAnuales(tendencia.puntos, filasMaterias, delRangoPrevio, materias) : null,
    // "Lo que viene" NO aplica al informe anual: el periodo llega hasta el 31
    // de diciembre, así que lo que "viene" ya está dentro del propio rango.
    // Ese espacio lo ocupan los superlativos, que solo existen en anual.
    proximos: periodo === 'anual' ? [] : proximosItems(tareas, materias, fechaReferencia, MAX_PROXIMOS),
  }
}

/**
 * Proyecta el informe a lo ÚNICO que puede ver el agente de IA: agregados.
 * Ni un id, ni un título de tarea, ni una fecha ISO — solo cifras ya
 * calculadas y nombres de materia. Si un dato no está acá, la IA no puede
 * citarlo, y la validación posterior lo descarta.
 */
export function datosParaIA(datos: DatosInforme): DatosSeccionIA {
  return {
    periodo: datos.periodo,
    etiquetaPeriodo: datos.etiquetaPeriodo,
    completadas: { hechas: datos.actual.completadas, total: datos.actual.total, porcentaje: datos.actual.porcentaje },
    porcentajePuntualidad: datos.actual.porcentajePuntualidad,
    rachaDias: datos.actual.racha,
    deltaCompletadas: datos.comparacion.completadas.comparable ? datos.comparacion.completadas.delta : null,
    deltaPuntualidad: datos.comparacion.puntualidad.comparable ? datos.comparacion.puntualidad.delta : null,
    materias: datos.materias.map((m) => ({ nombre: m.nombre, completadas: m.completadas, pendientes: m.pendientes })),
  }
}
