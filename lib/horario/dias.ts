import type { DiaSemana } from './tipos'

// PURO: nunca llama a new Date()/Date.now() para "ahora" — toda fecha
// "actual" es un parámetro `hoy: string` inyectado por quien llama (ver
// lib/horario/hoy.ts para el único lugar donde sí se lee el reloj real).
//
// Toda la aritmética ocurre en milisegundos UTC (Date.UTC + getUTC*), nunca
// con new Date('YYYY-MM-DD') ni new Date(f + 'T00:00:00') — el resto del
// repo ya mezcla ambas formas (app/page.tsx, NotificationBell.tsx), que es
// justo la fuente típica de un desfase de un día según en qué huso corra
// el proceso. Tratar la fecha como "milisegundos UTC de medianoche" evita
// el problema por construcción: no hay huso horario que afecte el cálculo,
// y el rollover de mes/año/bisiesto lo resuelve el objeto Date nativo.
const MS_POR_DIA = 86_400_000

function aEpocaUTC(fechaISO: string): number {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  return Date.UTC(anio, mes - 1, dia)
}

function deEpocaUTC(epocaMs: number): string {
  const d = new Date(epocaMs)
  const anio = d.getUTCFullYear()
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(d.getUTCDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

// Días calendario entre dos fechas YYYY-MM-DD: positivo si `hasta` es
// posterior a `desde`, negativo si es anterior, 0 si son el mismo día.
// Misma aritmética en epoch UTC que el resto del módulo, así que el
// rollover de mes/año/bisiesto lo resuelve Date y no hay huso horario que
// pueda desplazar el resultado. Usado por el CalendarAgent (Sprint 10)
// para medir "qué tan lejos" está una fecha de hoy sin reimplementar la
// aritmética de fechas por tercera vez en el repo.
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aEpocaUTC(hasta) - aEpocaUTC(desde)) / MS_POR_DIA)
}

// Día de la semana de una fecha YYYY-MM-DD, en convención ISO (1=lunes).
// Date.getUTCDay() devuelve la convención de JS (0=domingo…6=sábado); acá
// se traduce una sola vez.
export function diaISODeFecha(fechaISO: string): DiaSemana {
  const diaJS = new Date(aEpocaUTC(fechaISO)).getUTCDay()
  return (diaJS === 0 ? 7 : diaJS) as DiaSemana
}

// Cuántos días hay que avanzar desde `hoy` para llegar al próximo `dia`.
// 0 si hoy mismo es ese día y `incluirHoy` es true; si no, siempre entre
// 1 y 7 (nunca 0 sin incluirHoy, para no devolver "hoy" quien pidió "la
// próxima vez").
export function diasHastaProximo(hoy: string, dia: DiaSemana, incluirHoy = false): number {
  const diaHoy = diaISODeFecha(hoy)
  let delta = (dia - diaHoy + 7) % 7
  if (delta === 0 && !incluirHoy) delta = 7
  return delta
}

// Fecha (YYYY-MM-DD) de la próxima ocurrencia de `dia` a partir de `hoy`.
export function siguienteOcurrencia(hoy: string, dia: DiaSemana, incluirHoy = false): string {
  const delta = diasHastaProximo(hoy, dia, incluirHoy)
  return deEpocaUTC(aEpocaUTC(hoy) + delta * MS_POR_DIA)
}

// ═══════════════════════════════════════════════════════════════════════════
// Sprint 18a (Informes PDF) — helpers que estaban PRIVADOS y DUPLICADOS.
// ═══════════════════════════════════════════════════════════════════════════
// `sumarDias` y `lunesDeSemana` vivían privados en lib/estadisticas/
// agregacion.ts, reimplementando la misma aritmética de epoch UTC que este
// módulo ya tenía en aEpocaUTC/deEpocaUTC. El comentario de aquel archivo lo
// admitía: "no existía un helper de esto en lib/horario/". Ahora sí — se
// mueven acá (su casa natural) y agregacion.ts los importa, en vez de tener
// una tercera copia de la misma cuenta.

/** Suma (o resta, con `dias` negativo) días calendario a una fecha ISO. */
export function sumarDias(fechaISO: string, dias: number): string {
  return deEpocaUTC(aEpocaUTC(fechaISO) + dias * MS_POR_DIA)
}

/**
 * Lunes (ISO) de la semana que contiene `fechaISO`. `diaISODeFecha` da 1..7
 * con 1=lunes, así que retroceder (diaISO - 1) días llega siempre al lunes.
 */
export function lunesDeSemana(fechaISO: string): string {
  return sumarDias(fechaISO, -(diaISODeFecha(fechaISO) - 1))
}

/** Domingo (ISO) de la semana que contiene `fechaISO` — el lunes + 6. */
export function domingoDeSemana(fechaISO: string): string {
  return sumarDias(lunesDeSemana(fechaISO), 6)
}

export function primerDiaDeMes(fechaISO: string): string {
  return `${fechaISO.slice(0, 7)}-01`
}

/**
 * Último día del mes que contiene `fechaISO`. Se calcula como "día 0 del mes
 * siguiente", que es como Date resuelve 28/29/30/31 y el año bisiesto sin
 * que haya que codificar ninguna tabla de longitudes de mes.
 */
export function ultimoDiaDeMes(fechaISO: string): string {
  const [anio, mes] = fechaISO.split('-').map(Number)
  return deEpocaUTC(Date.UTC(anio, mes, 0))
}

export function primerDiaDeAnio(fechaISO: string): string {
  return `${fechaISO.slice(0, 4)}-01-01`
}

export function ultimoDiaDeAnio(fechaISO: string): string {
  return `${fechaISO.slice(0, 4)}-12-31`
}

/** Suma meses conservando el "fin de mes": 31 ene + 1 mes → 28/29 feb. */
export function sumarMeses(fechaISO: string, meses: number): string {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  const objetivo = Date.UTC(anio, mes - 1 + meses, 1)
  const d = new Date(objetivo)
  const ultimoDelObjetivo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  return deEpocaUTC(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), Math.min(dia, ultimoDelObjetivo)))
}
