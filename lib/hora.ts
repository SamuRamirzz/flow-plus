// Sección Ajustes — preferencia de formato de reloj (12h/24h). PURA a
// propósito, mismo criterio que lib/horario/dias.ts: sin Intl/Date, solo
// aritmética sobre el string 'HH:MM' que ya usa toda la app internamente
// (bloques de horario, inputs, la base) — el formato es puramente de
// PRESENTACIÓN, nunca cambia cómo se guarda o se compara una hora.

export type FormatoReloj = '12h' | '24h'

// '24h' es passthrough (es el formato canónico interno). '12h' construye
// "h:mm a. m./p. m." — con el punto después de "a"/"p" y espacio antes de
// "m.", que es la forma que usa el locale es-ES/es-CO para el meridiano
// (evita inventar una abreviatura propia tipo "AM"/"PM" que no coincide
// con el resto de la app, ya en español).
export function formatearHora(hhmm: string, formato: FormatoReloj): string {
  if (formato === '24h') return hhmm

  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return hhmm

  const horas24 = Number(m[1])
  const minutos = m[2]
  const meridiano = horas24 < 12 ? 'a. m.' : 'p. m.'
  const horas12 = horas24 % 12 === 0 ? 12 : horas24 % 12

  return `${horas12}:${minutos} ${meridiano}`
}
