import type { Archivo, TipoDocumento } from './tipos'
import { formatearHora, type FormatoReloj } from '@/lib/hora'

// Sprint Archivos / Frontend — toda la lógica de presentación y filtrado de
// la sección Archivos, PURA y testeable. Mismo criterio que
// lib/estadisticas/agregacion.ts o lib/ajustes/busqueda.ts: sin React, sin
// fetch, sin `new Date()` implícito (la fecha de referencia siempre entra
// por parámetro), para poder probar los casos borde sin montar la pantalla.

// ═══════════════════════════════════════════════════════════════════════════
// Tamaño
// ═══════════════════════════════════════════════════════════════════════════

const KB = 1024
const MB = KB * 1024
const GB = MB * 1024

/**
 * "2.4 MB", "856 KB", "34 KB". Un decimal solo a partir de MB — "856.0 KB"
 * es ruido, "2 MB" pierde información que sí importa para un PDF.
 * `null` (tamaño desconocido) se muestra como guion, nunca como "0 B", que
 * afirmaría algo falso sobre el archivo.
 */
export function formatearTamano(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < KB) return `${bytes} B`
  if (bytes < MB) return `${Math.round(bytes / KB)} KB`
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`
  return `${(bytes / GB).toFixed(1)} GB`
}

/**
 * Porcentaje usado de la cuota de Drive, acotado a 0-100. Se acota porque
 * Drive puede reportar `usado > total` transitoriamente (cuota compartida
 * entre servicios), y una barra al 140% se vería rota.
 */
export function porcentajeUsado(usadoBytes: number, totalBytes: number): number {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 0
  return Math.max(0, Math.min(100, (usadoBytes / totalBytes) * 100))
}

// ═══════════════════════════════════════════════════════════════════════════
// Fechas
// ═══════════════════════════════════════════════════════════════════════════

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function mismaFecha(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * Columna "Última apertura" de la referencia: "Hoy, 9:41 a. m.", "Ayer,
 * 4:22 p. m.", "18 jul 2026". Un archivo nunca abierto devuelve '—' — es un
 * estado real (`ultima_apertura_en` es nullable), no un cero.
 *
 * `ahora` entra por parámetro para que "hoy"/"ayer" sean deterministas en
 * los tests. Reusa `formatearHora` para respetar la preferencia 12h/24h que
 * ya existe en Ajustes, en vez de inventar un segundo formato de hora.
 */
export function formatearUltimaApertura(iso: string | null, ahora: Date, formato: FormatoReloj = '24h'): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'

  const hhmm = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`
  const hora = formatearHora(hhmm, formato)

  if (mismaFecha(fecha, ahora)) return `Hoy, ${hora}`

  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  if (mismaFecha(fecha, ayer)) return `Ayer, ${hora}`

  return `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`
}

/** Versión corta para las tarjetas de actividad: "Hace 2 horas", "Ayer", "18 jul". */
export function formatearRelativo(iso: string, ahora: Date): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'

  const minutos = Math.floor((ahora.getTime() - fecha.getTime()) / 60000)
  if (minutos < 1) return 'Recién'
  if (minutos < 60) return `Hace ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (mismaFecha(fecha, ahora)) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`

  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  if (mismaFecha(fecha, ayer)) return 'Ayer'

  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}`
}

// ═══════════════════════════════════════════════════════════════════════════
// Tipo de archivo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Familia visual de un archivo. Deliberadamente corta: es lo que decide el
 * ícono, el color y el chip de filtro, no una taxonomía exhaustiva de MIME.
 */
export type FamiliaArchivo = 'pdf' | 'imagen' | 'documento' | 'texto' | 'calendario' | 'otro'

const MIME_IMAGEN = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/heic']
const MIME_TEXTO = ['text/plain', 'text/markdown', 'text/csv', 'application/json']
const MIME_DOC = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

export function familiaDeArchivo(mimeType: string | null, nombre = ''): FamiliaArchivo {
  const mime = (mimeType ?? '').toLowerCase()
  if (mime === 'application/pdf') return 'pdf'
  if (MIME_IMAGEN.includes(mime) || mime.startsWith('image/')) return 'imagen'
  if (MIME_TEXTO.includes(mime)) return 'texto'
  if (MIME_DOC.includes(mime)) return 'documento'
  if (mime === 'text/calendar') return 'calendario'

  // Fallback por extensión: Storage puede entregar `application/octet-stream`
  // para formatos que el navegador no reconoció al subir (.md y .ics son los
  // casos reales que aparecen en este proyecto).
  const ext = nombre.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].includes(ext)) return 'imagen'
  if (['md', 'txt', 'csv', 'json'].includes(ext)) return 'texto'
  if (['doc', 'docx', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'documento'
  if (ext === 'ics') return 'calendario'
  return 'otro'
}

/**
 * Formatos que el panel de detalle puede previsualizar de verdad hoy.
 * `documento` (.docx/.xlsx) queda fuera a propósito: son ZIPs de XML, no hay
 * forma de renderizarlos en el navegador sin una dependencia pesada — mismo
 * motivo por el que `politicaDeAnalisis` los excluye del análisis de IA.
 */
export function sePuedePrevisualizar(mimeType: string | null, nombre = ''): boolean {
  const familia = familiaDeArchivo(mimeType, nombre)
  return familia === 'pdf' || familia === 'imagen' || familia === 'texto'
}

// ═══════════════════════════════════════════════════════════════════════════
// Etiqueta de IA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * La etiqueta de la columna "IA" de la tabla.
 *
 * `GET /api/archivos/actividad` ya deriva esta MISMA etiqueta en el servidor
 * para sus tarjetas; acá se replica para `GET /api/archivos`, que devuelve
 * la fila cruda sin etiqueta. Las dos derivaciones tienen que coincidir
 * exactamente — un archivo no puede decir "Resumen disponible" en la tabla y
 * "Texto analizado" en la franja de actividad. Los tests fijan esa
 * equivalencia; si el servidor cambia su criterio, este archivo cambia con él.
 *
 * `null` significa "sin análisis todavía" — la tabla muestra un guion, no
 * una etiqueta inventada.
 */
export function etiquetaIA(archivo: Pick<Archivo, 'tareas_detectadas' | 'tipo_documento' | 'resumen_ia' | 'analizado_en' | 'analisis_error'>): string | null {
  if (!archivo.analizado_en) return archivo.analisis_error ? 'No se pudo analizar' : null

  const nTareas = Array.isArray(archivo.tareas_detectadas) ? archivo.tareas_detectadas.length : 0
  if (nTareas > 0) return `${nTareas} ${nTareas === 1 ? 'tarea detectada' : 'tareas detectadas'}`
  if (archivo.tipo_documento === 'examen') return 'Examen encontrado'
  if (archivo.tipo_documento === 'horario') return 'Horario analizado'
  if (archivo.resumen_ia) return 'Resumen disponible'
  return 'Texto analizado'
}

/** Tono visual de la etiqueta — coral para lo accionable, muted para lo informativo. */
export function tonoEtiquetaIA(etiqueta: string | null): 'accion' | 'info' | 'error' | 'ninguno' {
  if (!etiqueta) return 'ninguno'
  if (etiqueta === 'No se pudo analizar') return 'error'
  if (etiqueta.includes('tarea') || etiqueta === 'Examen encontrado') return 'accion'
  return 'info'
}

export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  examen: 'Examen',
  guia: 'Guía',
  apuntes: 'Apuntes',
  enunciado: 'Enunciado',
  horario: 'Horario',
  otro: 'Documento',
}

// ═══════════════════════════════════════════════════════════════════════════
// Búsqueda y filtros
// ═══════════════════════════════════════════════════════════════════════════

const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

const PALABRAS_INTERROGATIVAS = ['que', 'cual', 'cuales', 'cuando', 'donde', 'como', 'por que', 'porque', 'quien', 'cuanto', 'cuanta', 'resume', 'resumeme', 'explicame', 'explica', 'dime', 'muestrame', 'hazme', 'busca']

/**
 * Distingue "estoy buscando un archivo por su nombre" de "le estoy hablando
 * a la IA". Criterio deliberadamente simple y explicable (signos de
 * interrogación, o una palabra interrogativa al principio + varias palabras),
 * no un clasificador: el costo de equivocarse es cero — la tabla se filtra
 * igual, y lo único que cambia es que además aparece la opción de mandar la
 * frase a la IA. Nunca reemplaza la búsqueda, solo la acompaña.
 *
 * Exige más de dos palabras para no disparar con "que" suelto, que es un
 * prefijo legítimo de nombre de archivo.
 */
export function pareceUnaPregunta(texto: string): boolean {
  const q = normalizar(texto)
  if (q.length < 6) return false
  if (q.includes('?') || q.includes('¿')) return true

  const palabras = q.split(' ')
  if (palabras.length < 3) return false
  return PALABRAS_INTERROGATIVAS.some((p) => q.startsWith(`${p} `))
}

/** Los chips de filtro rápido por tipo de archivo. */
export type ChipFiltro = 'todos' | 'pdf' | 'imagen' | 'documento' | 'texto'

export const CHIPS: { id: ChipFiltro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'imagen', label: 'Imágenes' },
  { id: 'documento', label: 'Documentos' },
  { id: 'texto', label: 'Texto' },
]

/**
 * Carpeta seleccionada en el sidebar interno.
 *
 * `{tipo:'materia'}` corresponde 1:1 con una subcarpeta REAL de Google Drive
 * (`materias.drive_folder_id`), creada dentro de "Flow+" la primera vez que se
 * sube un archivo de esa materia.
 *
 * Las otras tres son vistas derivadas, no ubicaciones: `sin-materia` son los
 * archivos que viven en la raíz "Flow+", y `analizados`/`horarios` cruzan
 * archivos de cualquier carpeta. Ver el comentario de SidebarCarpetas.tsx
 * para por qué el sidebar se construye desde `materia_id` y no listando Drive.
 */
export type CarpetaId = { tipo: 'todos' } | { tipo: 'materia'; materiaId: string } | { tipo: 'sin-materia' } | { tipo: 'analizados' } | { tipo: 'horarios' }

export function mismaCarpeta(a: CarpetaId, b: CarpetaId): boolean {
  if (a.tipo !== b.tipo) return false
  if (a.tipo === 'materia' && b.tipo === 'materia') return a.materiaId === b.materiaId
  return true
}

function perteneceACarpeta(archivo: Archivo, carpeta: CarpetaId): boolean {
  switch (carpeta.tipo) {
    case 'todos':
      return true
    case 'materia':
      return archivo.materia_id === carpeta.materiaId
    case 'sin-materia':
      return archivo.materia_id === null
    case 'analizados':
      return archivo.analizado_en !== null
    case 'horarios':
      return archivo.tipo_documento === 'horario'
  }
}

function coincideChip(archivo: Archivo, chip: ChipFiltro): boolean {
  if (chip === 'todos') return true
  return familiaDeArchivo(archivo.mime_type, archivo.nombre) === chip
}

/**
 * Filtra la lista con los tres controles combinados en AND: carpeta ∧ chip ∧
 * texto. Se eligió AND y no exclusión mutua porque cada control responde una
 * pregunta distinta (dónde vive, de qué tipo es, cómo se llama) y el usuario
 * espera poder decir "los PDFs de Cálculo" — con exclusión mutua, elegir un
 * chip borraría la carpeta que acababa de elegir, que se siente como un bug.
 *
 * La búsqueda de texto mira nombre Y resumen de IA: si la IA ya resumió un
 * archivo, buscar por una palabra del resumen es exactamente la clase de
 * búsqueda que esta sección promete.
 */
export function filtrarArchivos(archivos: Archivo[], carpeta: CarpetaId, chip: ChipFiltro, busqueda: string): Archivo[] {
  const q = normalizar(busqueda)
  return archivos.filter((a) => {
    if (!perteneceACarpeta(a, carpeta)) return false
    if (!coincideChip(a, chip)) return false
    if (q.length === 0) return true
    return normalizar(a.nombre).includes(q) || (a.resumen_ia ? normalizar(a.resumen_ia).includes(q) : false)
  })
}

/** Cuántos archivos hay en cada carpeta — el contador del sidebar interno. */
export function contarPorCarpeta(archivos: Archivo[], carpeta: CarpetaId): number {
  return archivos.filter((a) => perteneceACarpeta(a, carpeta)).length
}
