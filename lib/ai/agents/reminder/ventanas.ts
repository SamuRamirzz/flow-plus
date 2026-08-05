import { diasEntre } from '@/lib/horario/dias'
import type { ResultadoVentana, TareaParaRecordatorio, Urgencia } from './types'

// PURO — sin I/O, sin new Date() (misma disciplina que lib/horario/dias.ts
// y calendar/validar.ts): `hoy` siempre llega inyectado, calculado por el
// llamador con hoyEnZona() en la zona del usuario, nunca acá dentro.
//
// Reemplaza la heurística fija de components/ui/NotificationBell.tsx
// (alta=3, media=2, baja=1 días antes) — se mantienen esos mismos valores
// base a propósito: el objetivo de este sprint es mover el cálculo al
// servidor y hacerlo testeable, no cambiar cuándo empieza a avisar una
// tarea que ya funcionaba bien.
const VENTANA_BASE: Record<string, number> = { alta: 3, media: 2, baja: 1 }

// Un examen necesita más margen de preparación que un ejercicio de la misma
// prioridad — estudiar toma más tiempo que terminar una entrega puntual.
// +2 días sobre la ventana base de su prioridad (alta+examen=5,
// media+examen=4, baja+examen=3). No estaba en el comportamiento anterior
// (NotificationBell no distinguía tipo) — es la mejora que este sprint
// añade a propósito, documentada como tal.
const BONUS_EXAMEN_DIAS = 2

// Más allá de esto, una tarea vencida se asume abandonada o ya vista por el
// usuario — sin este límite, una tarea vencida hace 200 días seguiría
// generando "recordatorio" cada día para siempre. NotificationBell.tsx
// (cliente, cálculo en vivo bajo demanda) no tenía este problema porque no
// persiste nada; notificaciones_enviadas si acumula una fila por día, así
// que el corte es necesario acá aunque no existiera antes.
const LIMITE_VENCIDA_DIAS = 7

// Divide la ventana en tercios para escalar la urgencia de forma
// proporcional a lo ancha que sea (una ventana de 1 día para baja no tiene
// espacio para "tibio", una de 5 para alta+examen sí): "venze hoy o mañana"
// siempre es alta sin importar el tamaño de la ventana; lo que resta se
// divide a la mitad entre media/baja. Coincide con el ejemplo del propio
// documento de arquitectura para el Reminder Agent ("7 días antes:
// mencionar; 2 días antes: recordar con más énfasis; día de: recordatorio
// final" — mencionar≈baja, énfasis≈media, final≈alta).
function calcularUrgencia(dias: number, ventana: number): Urgencia {
  if (dias <= 1) return 'alta'
  if (dias <= Math.ceil(ventana / 2)) return 'media'
  return 'baja'
}

export function calcularVentanaRecordatorio(tarea: TareaParaRecordatorio, hoy: string): ResultadoVentana {
  if (!tarea.fecha) return { debeRecordar: false, diasRestantes: null, urgencia: 'baja' }

  const dias = diasEntre(hoy, tarea.fecha)
  if (dias < -LIMITE_VENCIDA_DIAS) return { debeRecordar: false, diasRestantes: dias, urgencia: 'baja' }

  const base = VENTANA_BASE[tarea.prioridad] ?? VENTANA_BASE.baja
  const ventana = tarea.tipo === 'examen' ? base + BONUS_EXAMEN_DIAS : base
  const debeRecordar = dias <= ventana

  return { debeRecordar, diasRestantes: dias, urgencia: debeRecordar ? calcularUrgencia(dias, ventana) : 'baja' }
}
