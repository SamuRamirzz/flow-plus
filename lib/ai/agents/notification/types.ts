import type { Urgencia } from '../reminder/types'

export type CandidatoNotificacion = { tareaId: string; urgencia: Urgencia; tipo: string }

/** Fila ya existente en notificaciones_enviadas — el llamador la trae
 *  PRE-FILTRADA a la fecha de hoy (misma responsabilidad de "filtrar antes
 *  de llamar a la función pura" que ya usa POST /api/tareas con las
 *  colisiones del mismo día, ver calendar/validar.ts). decidirNotificar no
 *  sabe de fechas, solo compara contra lo que se le pasó. */
export type NotificacionYaEnviada = { tareaId: string; tipo: string }

export type DecisionNotificacion = { tareaId: string; agrupar: boolean }
