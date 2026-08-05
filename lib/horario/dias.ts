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
