import type { Tarea } from '@/lib/types'
import { lunesDeSemana, domingoDeSemana, primerDiaDeMes, ultimoDiaDeMes, primerDiaDeAnio, ultimoDiaDeAnio, sumarDias, sumarMeses } from '@/lib/horario/dias'
import type { Periodo, RangoFechas } from './tipos'

// Sprint 18a — PURO. Toda la aritmética delega en lib/horario/dias.ts (epoch
// UTC), nunca en `new Date('YYYY-MM-DD')`: ese es el origen clásico del
// desfase de un día según el huso del proceso, y en el servidor el proceso
// corre en UTC mientras el usuario está en America/Bogota.

/** Rango del periodo que CONTIENE `fechaReferencia`. */
export function rangoDePeriodo(periodo: Periodo, fechaReferencia: string): RangoFechas {
  if (periodo === 'semanal') {
    return { desde: lunesDeSemana(fechaReferencia), hasta: domingoDeSemana(fechaReferencia) }
  }
  if (periodo === 'mensual') {
    return { desde: primerDiaDeMes(fechaReferencia), hasta: ultimoDiaDeMes(fechaReferencia) }
  }
  return { desde: primerDiaDeAnio(fechaReferencia), hasta: ultimoDiaDeAnio(fechaReferencia) }
}

/**
 * El periodo inmediatamente anterior, equivalente.
 *
 * Mensual y anual se desplazan por CALENDARIO, no por días fijos: el mes
 * anterior a marzo es febrero completo (28 o 29 días), nunca "marzo menos 30
 * días". Restar días daría rangos que se solapan o dejan huecos, y la
 * comparación mes-contra-mes dejaría de ser honesta.
 */
export function rangoAnterior(periodo: Periodo, rango: RangoFechas): RangoFechas {
  if (periodo === 'semanal') {
    return { desde: sumarDias(rango.desde, -7), hasta: sumarDias(rango.hasta, -7) }
  }
  if (periodo === 'mensual') {
    const mesPrevio = sumarMeses(rango.desde, -1)
    return { desde: primerDiaDeMes(mesPrevio), hasta: ultimoDiaDeMes(mesPrevio) }
  }
  const anioPrevio = `${Number(rango.desde.slice(0, 4)) - 1}-01-01`
  return { desde: primerDiaDeAnio(anioPrevio), hasta: ultimoDiaDeAnio(anioPrevio) }
}

/**
 * Tareas cuya FECHA DE ENTREGA cae dentro del rango.
 *
 * Criterio deliberadamente igual al de `tendenciaSemanal` (agregacion.ts): una
 * tarea cuenta en el periodo en que VENCÍA, no en el que se creó ni en el que
 * se completó. Es la pregunta que un calendario académico realmente hace
 * ("¿cumpliste lo que tenías esa semana?"), y mantiene el informe coherente
 * con lo que Home ya le muestra al usuario.
 */
export function tareasDelRango(tareas: Tarea[], rango: RangoFechas): Tarea[] {
  return tareas.filter((t) => t.fecha_entrega !== null && t.fecha_entrega >= rango.desde && t.fecha_entrega <= rango.hasta)
}

/**
 * Filas con `created_at` (timestamptz, con hora) dentro del rango.
 * Se compara por DÍA (`.slice(0, 10)`) contra un rango que es solo fecha —
 * mismo criterio que `calcularPuntualidad` con `completada_en`.
 */
export function filasDelRango<T extends { created_at: string }>(filas: T[], rango: RangoFechas): T[] {
  return filas.filter((f) => {
    const dia = f.created_at.slice(0, 10)
    return dia >= rango.desde && dia <= rango.hasta
  })
}
