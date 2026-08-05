export type Urgencia = 'baja' | 'media' | 'alta'

/** La tarea tal como la necesita calcularVentanaRecordatorio — mismo
 *  criterio de "solo los campos que hacen falta" que TareaNuevaParaColision
 *  en calendar/types.ts, no el tipo completo de lib/types.ts. */
export type TareaParaRecordatorio = { fecha: string | null; prioridad: string; tipo: string }

export type ResultadoVentana = {
  debeRecordar: boolean
  /** Días hasta la fecha de entrega (negativo = vencida). `null` solo si
   *  la tarea no tiene fecha. */
  diasRestantes: number | null
  urgencia: Urgencia
}
