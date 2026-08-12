// Sprint Archivos / Frontend — la forma EXACTA de la fila `archivos` tal
// como la devuelven los endpoints (`select('*')`, snake_case crudo de
// Postgres). No se camelCasea al vuelo: el resto del proyecto ya convive con
// ambas convenciones según de dónde venga el dato (ver `FilaHorario` vs
// `BloqueHorario`), y acá no hay ninguna transformación de dominio que
// justifique una capa de mapeo — la UI lee estos campos tal cual.

/** Enum cerrado, espejo de `archivos_tipo_documento_chk` (migración 20260809000400). */
export type TipoDocumento = 'examen' | 'guia' | 'apuntes' | 'enunciado' | 'horario' | 'otro'

/**
 * Tarea que la IA detectó DENTRO de un archivo. Misma forma que
 * `DetectedTask` de HomeworkAgent — llega como jsonb en
 * `archivos.tareas_detectadas`, así que se declara acá en vez de importarse
 * de `lib/ai/` (ese módulo arrastra el registro de agentes al bundle del
 * cliente, que no tiene nada que hacer acá).
 */
export type TareaDetectada = {
  id: string
  titulo: string
  materia: string | null
  fecha: string | null
  prioridad: string
  tipo: string
  confidence: number
}

export type Archivo = {
  id: string
  nombre: string
  mime_type: string | null
  tamano_bytes: number | null
  tarea_id: string | null
  materia_id: string | null
  categoria: string | null
  origen: 'usuario' | 'ia'
  drive_file_id: string | null
  drive_web_view_link: string | null
  created_at: string
  updated_at: string | null

  // Columnas de análisis (Fase 7). `analizado_en` y `analisis_error` son dos
  // columnas y no un booleano a propósito: "todavía no se analizó" y "se
  // intentó y falló" son estados distintos que la UI explica distinto.
  resumen_ia: string | null
  tipo_documento: TipoDocumento | null
  tareas_detectadas: TareaDetectada[] | null
  analizado_en: string | null
  analisis_error: string | null
  analisis_intentos: number
  ultima_apertura_en: string | null
}

/** Una tarjeta de la franja "Actividad de IA reciente" (`GET /api/archivos/actividad`). */
export type ActividadIA = {
  archivoId: string
  nombre: string
  mimeType: string | null
  materiaId: string | null
  tipoDocumento: TipoDocumento | null
  resumen: string | null
  tareasDetectadas: number
  /** Etiqueta ya derivada EN EL SERVIDOR — misma fuente que la columna "IA" de la tabla. */
  etiqueta: string
  analizadoEn: string
}

/** `GET /api/archivos/espacio` — cifras reales de la cuenta de Drive vinculada. */
export type EspacioDrive = {
  usadoBytes: number
  totalBytes: number
}

/** Un turno del hilo de `GET`/`POST /api/archivos/[id]/preguntar`. */
export type MensajeArchivo = {
  rol: 'usuario' | 'ia'
  texto: string
  en: string
}

/** Fila cruda de `notas` — mismo criterio snake_case que `Archivo`. */
export type Nota = {
  id: string
  titulo: string | null
  contenido: string
  tarea_id: string | null
  bloque_horario_id: string | null
  archivo_id: string | null
  drive_file_id: string | null
  drive_sync_error: string | null
  creado_por: 'usuario' | 'ia'
  created_at: string
  updated_at: string
}

/** Estado de la vinculación con Google Drive (`GET /api/integraciones/google-drive`). */
export type EstadoDrive = {
  estado: 'vinculada' | 'sin_vinculacion' | 'revocada' | string
  cuentaEmail?: string | null
}

export type VistaArchivos = 'lista' | 'grid'
