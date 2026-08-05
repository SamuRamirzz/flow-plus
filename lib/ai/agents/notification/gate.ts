import type { CandidatoNotificacion, DecisionNotificacion, NotificacionYaEnviada } from './types'

// PURO — sin I/O. Implementa las tres condiciones que
// docs/ai-architecture/03-catalogo-agentes.md le asigna al Notification
// Agent (confianza/utilidad/no-redundancia, Parte 2.4), en su mitad
// determinística: acá no hay "confianza de un modelo" que evaluar (no se
// llama a ningún proveedor en este sprint, mismo criterio que
// calendar/validar.ts), así que las tres condiciones reales que aplican
// son no-redundancia, tope diario y agrupación.

const ORDEN_URGENCIA: Record<CandidatoNotificacion['urgencia'], number> = { alta: 0, media: 1, baja: 2 }

// 1. No redundancia — ya existe una fila en notificaciones_enviadas para
// esa (tarea, tipo) en la fecha que el llamador ya filtró.
function noEsRedundante(candidato: CandidatoNotificacion, yaEnviadas: NotificacionYaEnviada[]): boolean {
  return !yaEnviadas.some((e) => e.tareaId === candidato.tareaId && e.tipo === candidato.tipo)
}

// 2. Tope diario — `yaEnviadas.length` ya cuenta lo que otra corrida del
// cron mandó HOY (el llamador filtra por fecha antes de pasarlo), así que
// el cupo de ESTA corrida es lo que falta para llegar al tope, no
// `maxPorDia` completo de nuevo — evita que dos corridas el mismo día
// sumen entre ambas más de `maxPorDia`.
//
// Desempate cuando sobran candidatos al mismo nivel de urgencia: por
// `tareaId` (orden alfabético) — mismo criterio de determinismo que
// inferirFechaEntrega (Sprint 7) y detectarColisiones (Sprint 10): un
// desempate arbitrario pero ESTABLE, para que correr el gate dos veces con
// la misma entrada dé siempre la misma salida.
function priorizar(candidatos: CandidatoNotificacion[]): CandidatoNotificacion[] {
  return [...candidatos].sort((a, b) => {
    const porUrgencia = ORDEN_URGENCIA[a.urgencia] - ORDEN_URGENCIA[b.urgencia]
    if (porUrgencia !== 0) return porUrgencia
    return a.tareaId < b.tareaId ? -1 : a.tareaId > b.tareaId ? 1 : 0
  })
}

// 3. Agrupación — "el mismo día" es el día en que CORRE el cron (todos los
// candidatos de una misma llamada a decidirNotificar comparten ese día por
// construcción, el cron corre una vez), no la fecha de entrega de cada
// tarea: si esta corrida aprueba 2+ notificaciones, se marcan todas para
// combinarse en un solo mensaje ("Tienes 3 tareas próximas") en vez de
// mandar una por tarea; si aprueba solo 1, va sola.
export function decidirNotificar(
  candidatos: CandidatoNotificacion[],
  yaEnviadas: NotificacionYaEnviada[],
  maxPorDia: number
): DecisionNotificacion[] {
  const nuevos = candidatos.filter((c) => noEsRedundante(c, yaEnviadas))
  const cupo = Math.max(0, maxPorDia - yaEnviadas.length)
  const aprobados = priorizar(nuevos).slice(0, cupo)

  const agrupar = aprobados.length > 1
  return aprobados.map((c) => ({ tareaId: c.tareaId, agrupar }))
}
