// Bugs pendientes / Parte 2 — PURO. Conversión HH:MM ↔ minutos desde
// medianoche, necesaria para recalcular una hora de fin al mover un bloque
// de horario (preservar duración cuando el usuario solo da la hora nueva de
// inicio o de fin). Extraído a su propio archivo en vez de vivir inline en
// el Route Handler para poder probarlo sin red, mismo criterio que el resto
// de lib/horario/ (dias.ts, diff.ts).

export function minutosDesdeHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Recorta al rango de un día (0-1439): un desplazamiento que empujara la
// hora fuera de "hoy" (ej. restar duración a una hora de fin muy temprano)
// no tiene una franja horaria representable en el modelo de datos actual
// (sin cruce de medianoche) — se recorta en vez de devolver un HH:MM
// inválido tipo "-1:30" o "25:00".
export function hhmmDesdeMinutos(totalMin: number): string {
  const clamp = Math.min(1439, Math.max(0, totalMin))
  const h = Math.floor(clamp / 60)
  const m = clamp % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
