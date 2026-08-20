import { sumarDias, siguienteOcurrencia } from '@/lib/horario/dias'
import type { DiaSemana } from '@/lib/horario/tipos'

// Sprint 2/3 — resolución DETERMINÍSTICA de fechas en lenguaje natural
// simple, para el canal de WhatsApp.
//
// Por qué existe: se verificó (no se asumió) que hoy TODA la resolución de
// fechas relativas del proyecto la hace Gemini dentro del prompt de
// TaskManagementAgent ("La fecha de hoy es X. Úsala para resolver cualquier
// fecha relativa mencionada"), no un parser propio. En el canal de WhatsApp
// eso no se puede usar: la política de Meta vigente desde el 15/01/2026
// prohíbe los chatbots de propósito general sobre la WhatsApp Business
// Platform, y este canal debe ser automatización determinística. Así que
// acá va una versión MÍNIMA a propósito — cubre lo que un usuario escribe
// de verdad por WhatsApp, no un parser de lenguaje natural completo.
//
// PURO: cero I/O, cero `new Date()` para "ahora" — `hoy` siempre entra
// inyectado, misma disciplina que lib/horario/dias.ts y
// lib/estadisticas/pulso.ts. La aritmética se delega en `sumarDias` y
// `siguienteOcurrencia`, que ya resuelven el rollover de mes/año/bisiesto
// en epoch UTC; acá no se reimplementa ninguna cuenta de días.

// Mismo patrón de normalización (NFD + quitar diacríticos + minúsculas)
// que ya repiten en privado lib/horario/diff.ts, lib/ajustes/busqueda.ts,
// lib/archivos/formato.ts y 3 más. Se replica en vez de extraerlo a un
// módulo común: unificar los 6 es un refactor propio que nadie pidió en
// este sprint, y tocarlos de paso arriesgaría 4 baterías de tests ajenas.
const DIACRITICOS = /[̀-ͯ]/g

export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Convención ISO 1=lunes, la MISMA que usa `horario.dia_semana` y todo
// lib/horario — no se inventa una numeración nueva para este canal.
const DIAS_SEMANA: Record<string, DiaSemana> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
}

function esFechaISOValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [anio, mes, dia] = texto.split('-').map(Number)
  if (mes < 1 || mes > 12 || dia < 1) return false
  // Día real del mes (cubre 31 de febrero, 31 de abril y bisiestos) — se
  // construye la fecha en UTC y se comprueba que no haya "rodado" a otro
  // mes, que es como Date normaliza un día que no existe.
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

/**
 * Texto → fecha `YYYY-MM-DD`, o `null` si no se reconoce NADA de fecha.
 *
 * Devolver `null` (en vez de adivinar) es deliberado: una tarea sin fecha
 * es un estado válido en este proyecto (`tareas.fecha_entrega` es
 * nullable, e `inferirFechaEntrega` ya sabe deducirla del horario después).
 * Inventar una fecha sería peor que no poner ninguna.
 *
 * Formatos soportados, a propósito acotados:
 *   · "hoy", "mañana", "pasado mañana"
 *   · nombres de día ("viernes", "el viernes") → la PRÓXIMA ocurrencia,
 *     sin incluir hoy: si hoy es viernes y escribes "el viernes", te
 *     refieres al que viene, no a dentro de un rato.
 *   · "2026-08-25" (ISO, validada de verdad, no solo por forma)
 *   · "25/8", "25-08", "25/08/2026" (día/mes, el orden natural en
 *     español — NUNCA mes/día). Sin año explícito se asume el año en
 *     curso, y si esa fecha ya pasó, el siguiente: escribir "3/1" en
 *     diciembre casi siempre significa el 3 de enero que viene.
 */
export function resolverFechaNatural(texto: string, hoy: string): string | null {
  const t = normalizar(texto)
  if (t.length === 0) return null

  if (t === 'hoy') return hoy
  if (t === 'manana') return sumarDias(hoy, 1)
  if (t === 'pasado manana') return sumarDias(hoy, 2)

  const sinArticulo = t.replace(/^(el|este|proximo|el proximo) /, '')
  const dia = DIAS_SEMANA[sinArticulo]
  if (dia !== undefined) return siguienteOcurrencia(hoy, dia)

  if (esFechaISOValida(t)) return t

  const numerica = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/)
  if (numerica) {
    const d = Number(numerica[1])
    const m = Number(numerica[2])
    const anioExplicito = numerica[3] ? Number(numerica[3]) : null
    const anioBase = anioExplicito ?? Number(hoy.slice(0, 4))

    const candidata = `${anioBase}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (!esFechaISOValida(candidata)) return null
    if (anioExplicito !== null) return candidata

    // Sin año: si ya pasó, se entiende el año que viene. Comparación de
    // strings ISO, que ordena igual que cronológicamente para este formato.
    if (candidata >= hoy) return candidata
    const siguiente = `${anioBase + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return esFechaISOValida(siguiente) ? siguiente : null
  }

  return null
}

/** Nombre de día → número ISO, para `/horario viernes`. `null` si no es un día. */
export function diaSemanaDeTexto(texto: string): DiaSemana | null {
  const t = normalizar(texto).replace(/^(el|este|proximo|el proximo) /, '')
  return DIAS_SEMANA[t] ?? null
}
