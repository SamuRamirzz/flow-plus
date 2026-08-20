// Tipos compartidos cliente/servidor — sin I/O, sin imports de
// lib/server/* (ese archivo usa supabaseServer, service_role, y nunca debe
// llegar al bundle del cliente). Mismo criterio que lib/api/schemas.ts:
// el borde HTTP y quien lo consume del lado del cliente comparten forma.

export type TipoNotificacion =
  | 'tarea_vencida'
  | 'tarea_proxima'
  | 'recordatorio_horario'
  | 'nota_agregada'
  | 'mensaje_ia'
  | 'sistema'

export type EntidadTipoNotificacion = 'tarea' | 'bloque_horario' | 'archivo' | 'nota'

export type FilaNotificacion = {
  id: string
  user_id: string
  tipo: TipoNotificacion
  titulo: string
  cuerpo: string | null
  entidad_tipo: EntidadTipoNotificacion | null
  entidad_id: string | null
  leida: boolean
  creada_en: string
  canal: 'app' | 'whatsapp'
}
