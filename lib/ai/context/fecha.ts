/** Zona horaria si el usuario no tiene perfil todavía. Mismo valor que el
 *  `default` de `perfil_academico.zona_horaria` en la migración. */
export const ZONA_HORARIA_POR_DEFECTO = 'America/Bogota'

// PURA respecto a sus entradas: `ahora` se inyecta, nunca se llama a
// new Date() aquí dentro (misma disciplina que lib/horario/dias.ts).
//
// Resuelve la limitación que lib/horario/hoy.ts documenta desde el Sprint 7:
// el servidor calculaba "hoy" con el reloj del proceso de Node, que en
// producción no tiene por qué coincidir con el huso del usuario — cerca de
// medianoche eso desplaza un día la fecha de entrega inferida. Con
// `perfil_academico.zona_horaria` ya existe la pieza que faltaba.
//
// `en-CA` a propósito: es el locale cuyo formato de fecha corto ES
// YYYY-MM-DD, así que no hay que reordenar partes a mano.
export function hoyEnZona(ahora: Date, zonaHoraria: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(ahora)
  } catch {
    // Una zona inválida guardada en la base (escrita a mano, un typo) no
    // debe tumbar la construcción del contexto: se cae a UTC, que al menos
    // es determinista y explicable, en vez de propagar la excepción.
    return ahora.toISOString().slice(0, 10)
  }
}

// Sprint 11 — hora "HH:MM" (24h) en la zona del usuario, para que el cron
// de recordatorios compare su propio momento de ejecución contra
// perfil_academico.no_molestar_desde/hasta (columnas `time`). Mismo
// criterio que hoyEnZona: PURA respecto a `ahora` (se inyecta, nunca
// new Date() acá dentro), mismo fallback a UTC si la zona guardada es
// inválida, por la misma razón (no tumbar el cron por un typo en la base).
//
// `hourCycle: 'h23'` a propósito, no `hour12: false`: en Node/ICU
// `hour12: false` a veces igual deja pasar "24:00" para la medianoche en
// vez de "00:00" según la implementación — h23 fuerza el rango 00-23 sin
// ambigüedad, que es lo que una comparación de string tipo "22:00" <=
// hora <= "23:59" necesita para no fallar justo a medianoche.
export function horaEnZona(ahora: Date, zonaHoraria: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zonaHoraria,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    }).format(ahora)
  } catch {
    return ahora.toISOString().slice(11, 16)
  }
}
