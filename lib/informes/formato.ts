import type { Periodo, RangoFechas } from './tipos'

// Sprint 18a — PURO. Formateo legible en español para el PDF. No existía nada
// así en el repo (lo más cercano era `etiquetaSemana` en GraficaTendencia.tsx,
// que solo hace DD/MM). Deliberadamente SIN Intl.DateTimeFormat: acá la
// entrada es un string 'YYYY-MM-DD', y pasarlo por `new Date()` reintroduce
// justo el desfase de huso que lib/horario/dias.ts evita por construcción.

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Iniciales de día para el eje X del gráfico semanal (ISO: 1=lunes). */
const DIAS_INICIAL = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function nombreMes(mes1a12: number): string {
  return MESES[mes1a12 - 1] ?? ''
}

export function nombreMesCorto(mes1a12: number): string {
  return MESES_CORTOS[mes1a12 - 1] ?? ''
}

export function inicialDia(diaISO: number): string {
  return DIAS_INICIAL[diaISO - 1] ?? ''
}

/** '2026-08-12' → '12 de agosto de 2026'. */
export function fechaLegible(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  return `${dia} de ${nombreMes(mes)} de ${anio}`
}

/** '2026-08-12' → '12 ago'. Para listas compactas ("Lo que viene"). */
export function fechaCorta(fechaISO: string): string {
  const [, mes, dia] = fechaISO.split('-').map(Number)
  return `${dia} ${nombreMesCorto(mes).toLowerCase()}`
}

/**
 * Etiqueta del periodo cubierto. Colapsa lo redundante:
 *   semanal, mismo mes  → '10 – 16 de agosto de 2026'
 *   semanal, cruza mes  → '28 de septiembre – 4 de octubre de 2026'
 *   semanal, cruza año  → '29 de diciembre de 2025 – 4 de enero de 2026'
 *   mensual             → 'agosto de 2026'
 *   anual               → '2026'
 */
export function etiquetaPeriodo(periodo: Periodo, rango: RangoFechas): string {
  if (periodo === 'anual') return rango.desde.slice(0, 4)

  const [anioD, mesD, diaD] = rango.desde.split('-').map(Number)
  if (periodo === 'mensual') return `${nombreMes(mesD)} de ${anioD}`

  const [anioH, mesH, diaH] = rango.hasta.split('-').map(Number)
  if (anioD !== anioH) return `${diaD} de ${nombreMes(mesD)} de ${anioD} – ${diaH} de ${nombreMes(mesH)} de ${anioH}`
  if (mesD !== mesH) return `${diaD} de ${nombreMes(mesD)} – ${diaH} de ${nombreMes(mesH)} de ${anioH}`
  return `${diaD} – ${diaH} de ${nombreMes(mesD)} de ${anioD}`
}

/**
 * Porcentaje entero. Devuelve `null` cuando el total es 0 — "no había nada
 * que hacer" NO es lo mismo que "0 %", y un NaN se renderizaría literalmente
 * como "NaN" en el PDF.
 */
export function porcentaje(parte: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((parte / total) * 100)
}

/** Formatea un porcentaje que puede no aplicar: 82 → '82 %', null → '—'. */
export function textoPorcentaje(valor: number | null): string {
  return valor === null ? '—' : `${valor} %`
}

/** '18 de 22'. */
export function fraccion(parte: number, total: number): string {
  return `${parte} de ${total}`
}

/**
 * Nombre del archivo descargado. Sin acentos ni espacios: viaja por un header
 * HTTP y termina siendo un nombre de archivo en el disco del usuario.
 */
export function nombreArchivoInforme(periodo: Periodo, rango: RangoFechas): string {
  return `flowplus-informe-${periodo}-${rango.desde}.pdf`
}
