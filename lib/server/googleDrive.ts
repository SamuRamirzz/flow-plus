import { supabaseServer } from './supabaseServer'
import { obtenerAccessTokenValido, invalidarAccessTokenCacheado } from './integracionGoogle'
import {
  BASE_DRIVE_API,
  BASE_DRIVE_UPLOAD,
  MIME_TYPE_CARPETA,
  construirMetadataArchivo,
  escaparValorConsultaDrive,
  interpretarErrorDrive,
  parsearEspacioUsado,
  type ClaseErrorDrive,
  type ResultadoDrive,
} from '@/lib/integraciones/googleDrive'

// Sprint Archivos / Fase 2 — la costura con I/O real de Google Drive API v3.
// Toda la interpretación de errores/payloads vive en lib/integraciones/googleDrive.ts
// (puro, sin red); acá solo queda pedir el access token, hacer el fetch, y leer
// la respuesta. Mismo corte que lib/server/integracionGoogle.ts frente a
// lib/integraciones/oauthGoogle.ts.

const PROVEEDOR = 'google'
const TABLA_INTEGRACION = 'integraciones_externas'
const LIMITE_METADATA_MS = 15_000
/** Subir/bajar archivos académicos reales (PDFs, fotos) puede tardar más que una llamada de metadata. */
const LIMITE_TRANSFERENCIA_MS = 60_000

type ResultadoToken = { ok: true; accessToken: string } | { ok: false; clase: ClaseErrorDrive; detalle: string }

async function tokenOFallo(userId: string): Promise<ResultadoToken> {
  const token = await obtenerAccessTokenValido(userId)
  if (token.estado === 'ok') return { ok: true, accessToken: token.accessToken }
  if (token.estado === 'sin_vinculacion') return { ok: false, clase: 'permisos', detalle: 'No hay una cuenta de Google Drive vinculada' }
  if (token.estado === 'revocada') return { ok: false, clase: 'permisos', detalle: token.detalle }
  // 'error' agrupa causas heterogéneas (red a Google, cifrado, config faltante)
  // que obtenerAccessTokenValido no distingue más — se trata como transitorio
  // (503) en vez de un 500 definitivo, porque la mayoría sí lo son.
  return { ok: false, clase: 'transitorio', detalle: token.detalle }
}

/**
 * Único punto de fetch contra Drive. Reintenta UNA vez si Drive devuelve 401
 * a mitad de operación (el access token estaba cacheado como vigente pero
 * Google ya no lo acepta — p. ej. el usuario revocó el acceso hace un
 * segundo) invalidando la caché y pidiendo un token nuevo.
 */
async function fetchDrive(
  userId: string,
  url: string,
  init: RequestInit = {},
  timeoutMs: number = LIMITE_METADATA_MS,
  permitirReintento = true,
): Promise<ResultadoDrive<Response>> {
  const token = await tokenOFallo(userId)
  if (!token.ok) return token

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token.accessToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    return { ok: false, clase: 'transitorio', detalle: `No se pudo contactar con Drive: ${error instanceof Error ? error.message : String(error)}` }
  }

  if (res.status === 401 && permitirReintento) {
    await invalidarAccessTokenCacheado(userId)
    return fetchDrive(userId, url, init, timeoutMs, false)
  }

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null)
    const { clase, detalle } = interpretarErrorDrive(res.status, cuerpo)
    return { ok: false, clase, detalle }
  }

  return { ok: true, datos: res }
}

/**
 * Idempotente: reusa `carpeta_raiz_id` si ya está guardado. Si no, busca por
 * nombre en Drive antes de crear (evita duplicar la carpeta si una corrida
 * anterior la creó pero falló al guardar el id) y persiste el id encontrado
 * o creado.
 */
export async function asegurarCarpetaRaiz(userId: string): Promise<ResultadoDrive<{ carpetaId: string }>> {
  const { data, error } = await supabaseServer
    .from(TABLA_INTEGRACION)
    .select('carpeta_raiz_id, carpeta_raiz_nombre')
    .eq('user_id', userId)
    .eq('proveedor', PROVEEDOR)
    .maybeSingle<{ carpeta_raiz_id: string | null; carpeta_raiz_nombre: string }>()

  if (error) return { ok: false, clase: 'transitorio', detalle: `No se pudo leer la vinculación: ${error.message}` }
  if (!data) return { ok: false, clase: 'permisos', detalle: 'No hay una cuenta de Google Drive vinculada' }
  if (data.carpeta_raiz_id) return { ok: true, datos: { carpetaId: data.carpeta_raiz_id } }

  const nombre = data.carpeta_raiz_nombre
  const q = `mimeType='${MIME_TYPE_CARPETA}' and name='${escaparValorConsultaDrive(nombre)}' and trashed=false`
  const busqueda = await fetchDrive(userId, `${BASE_DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)`)
  if (!busqueda.ok) return busqueda

  const cuerpoBusqueda = (await busqueda.datos.json()) as { files?: Array<{ id: string }> }
  let carpetaId = cuerpoBusqueda.files?.[0]?.id ?? null

  if (!carpetaId) {
    const creacion = await fetchDrive(userId, `${BASE_DRIVE_API}/files?fields=id`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(construirMetadataArchivo({ nombre, mimeType: MIME_TYPE_CARPETA })),
    })
    if (!creacion.ok) return creacion
    const cuerpoCreacion = (await creacion.datos.json()) as { id: string }
    carpetaId = cuerpoCreacion.id
  }

  const { error: errorUpdate } = await supabaseServer
    .from(TABLA_INTEGRACION)
    .update({ carpeta_raiz_id: carpetaId, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('proveedor', PROVEEDOR)
  // No bloquea el resultado: la carpeta ya existe en Drive, solo se pierde la
  // caché del id (la próxima llamada la vuelve a buscar por nombre).
  if (errorUpdate) console.error('[googleDrive] no se pudo guardar carpeta_raiz_id:', errorUpdate.message)

  return { ok: true, datos: { carpetaId } }
}

/**
 * Sprint Archivos / Fase 4.1 — misma idea que `asegurarCarpetaRaiz` (buscar
 * por nombre antes de crear, idempotente), generalizada a una subcarpeta
 * dentro de otra. Usada hoy para "Notas" dentro de "Flow+".
 *
 * A diferencia de `asegurarCarpetaRaiz`, esta NO cachea el id en
 * `integraciones_externas` — cada llamada busca por nombre en Drive. Es una
 * simplificación deliberada: la frecuencia de este tipo de subcarpeta (una
 * por categoría, ej. "Notas") es baja, no justifica todavía una columna de
 * caché nueva. Si el volumen lo pidiera, se puede agregar caché con el mismo
 * criterio que ya tiene la carpeta raíz.
 */
export async function asegurarSubcarpeta(userId: string, nombre: string, carpetaPadreId: string): Promise<ResultadoDrive<{ carpetaId: string }>> {
  const q = `mimeType='${MIME_TYPE_CARPETA}' and name='${escaparValorConsultaDrive(nombre)}' and '${escaparValorConsultaDrive(carpetaPadreId)}' in parents and trashed=false`
  const busqueda = await fetchDrive(userId, `${BASE_DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)`)
  if (!busqueda.ok) return busqueda

  const cuerpoBusqueda = (await busqueda.datos.json()) as { files?: Array<{ id: string }> }
  const existente = cuerpoBusqueda.files?.[0]?.id
  if (existente) return { ok: true, datos: { carpetaId: existente } }

  const creacion = await fetchDrive(userId, `${BASE_DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(construirMetadataArchivo({ nombre, mimeType: MIME_TYPE_CARPETA, carpetaId: carpetaPadreId })),
  })
  if (!creacion.ok) return creacion
  const cuerpoCreacion = (await creacion.datos.json()) as { id: string }
  return { ok: true, datos: { carpetaId: cuerpoCreacion.id } }
}

/**
 * Sprint Archivos / Subcarpetas por materia — devuelve el id de la subcarpeta
 * REAL de Drive de una materia, creándola dentro de "Flow+" la primera vez.
 *
 * ── Por qué vive acá y no en lib/integraciones/googleDrive.ts ─────────────
 * El encargo la ubicaba en el módulo `lib/integraciones/`, pero ese archivo es
 * PURO por diseño (sin red, sin Postgres — solo interpreta payloads y errores,
 * y por eso tiene 20 tests que corren sin tocar nada). Esta función hace las
 * dos cosas que ese módulo no puede hacer: llama a la API de Drive y escribe
 * en Postgres. Ponerla ahí rompería el corte que sostiene todo el módulo. Va
 * donde ya vive el resto del I/O de Drive, junto a `asegurarSubcarpeta`, sobre
 * la que se apoya.
 *
 * Idempotente en dos niveles: reusa `materias.drive_folder_id` si ya está
 * guardado, y si no, `asegurarSubcarpeta` busca por nombre antes de crear —
 * así una corrida anterior que creó la carpeta pero falló al guardar el id no
 * termina duplicando la carpeta en el Drive del usuario.
 *
 * No renombra la carpeta si la materia cambia de nombre después: el id
 * guardado sigue apuntando a la carpeta correcta, solo que su nombre en Drive
 * queda desactualizado. Es un límite conocido y barato de vivir (los archivos
 * nunca se pierden); resolverlo pediría un `files.update` de nombre en el
 * endpoint de materias, que es trabajo aparte y no se pidió.
 */
export async function obtenerOCrearCarpetaMateria(userId: string, materiaId: string, nombreMateria: string): Promise<ResultadoDrive<{ carpetaId: string }>> {
  const { data, error } = await supabaseServer
    .from('materias')
    .select('drive_folder_id')
    .eq('id', materiaId)
    .eq('user_id', userId)
    .maybeSingle<{ drive_folder_id: string | null }>()

  if (error) return { ok: false, clase: 'transitorio', detalle: `No se pudo leer la materia: ${error.message}` }
  if (!data) return { ok: false, clase: 'permisos', detalle: 'La materia no existe o no es tuya' }
  if (data.drive_folder_id) return { ok: true, datos: { carpetaId: data.drive_folder_id } }

  const raiz = await asegurarCarpetaRaiz(userId)
  if (!raiz.ok) return raiz

  const sub = await asegurarSubcarpeta(userId, nombreMateria, raiz.datos.carpetaId)
  if (!sub.ok) return sub

  const { error: errorUpdate } = await supabaseServer
    .from('materias')
    .update({ drive_folder_id: sub.datos.carpetaId })
    .eq('id', materiaId)
    .eq('user_id', userId)
  // Mismo criterio que `asegurarCarpetaRaiz`: la carpeta ya existe en Drive,
  // perder la caché del id solo cuesta una búsqueda por nombre la próxima vez.
  if (errorUpdate) console.error('[googleDrive] no se pudo guardar materias.drive_folder_id:', errorUpdate.message)

  return { ok: true, datos: { carpetaId: sub.datos.carpetaId } }
}

/**
 * Mueve un archivo ya existente entre carpetas de Drive.
 *
 * Usa `files.update` con `addParents`/`removeParents` — NO vuelve a subir el
 * binario. Un archivo de 10 MB movido de carpeta no debe costar 10 MB de
 * tráfico ni cambiar su `drive_file_id` (que es la clave con la que la fila de
 * `archivos` lo referencia; re-subir la invalidaría).
 *
 * `removeParents` se calcula pidiendo los padres actuales en vez de asumir la
 * raíz: un archivo puede estar en cualquier carpeta según de dónde venga, y
 * pasar un padre equivocado a `removeParents` deja el archivo en dos carpetas
 * a la vez (Drive lo permite) en vez de moverlo.
 */
export async function moverArchivoDeCarpeta(userId: string, driveFileId: string, carpetaDestinoId: string): Promise<ResultadoDrive<{ movido: boolean }>> {
  const actual = await fetchDrive(userId, `${BASE_DRIVE_API}/files/${encodeURIComponent(driveFileId)}?fields=parents`)
  if (!actual.ok) return actual

  const { parents = [] } = (await actual.datos.json()) as { parents?: string[] }
  if (parents.length === 1 && parents[0] === carpetaDestinoId) {
    return { ok: true, datos: { movido: false } }
  }

  const params = new URLSearchParams({ addParents: carpetaDestinoId, fields: 'id,parents' })
  if (parents.length > 0) params.set('removeParents', parents.join(','))

  const res = await fetchDrive(userId, `${BASE_DRIVE_API}/files/${encodeURIComponent(driveFileId)}?${params.toString()}`, { method: 'PATCH' })
  if (!res.ok) return res

  return { ok: true, datos: { movido: true } }
}

/**
 * Upload multipart simple (`uploadType=multipart`) — un solo request, cuerpo
 * `multipart/related` con una parte JSON de metadata y una parte binaria.
 * No resumable: razonable para los tamaños de este tramo (bucket de staging
 * limitado a 50MB); un archivo mucho más grande sería un caso a resolver con
 * upload resumable en un sprint aparte, documentado como límite conocido.
 */
export async function subirArchivo(
  userId: string,
  input: { bytes: Blob; nombre: string; mimeType: string; carpetaId: string },
): Promise<ResultadoDrive<{ driveFileId: string; webViewLink: string | null; tamanoBytes: number }>> {
  const boundary = `flowplus-${crypto.randomUUID()}`
  const metadata = JSON.stringify(construirMetadataArchivo({ nombre: input.nombre, mimeType: input.mimeType, carpetaId: input.carpetaId }))
  const cuerpo = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
    input.bytes,
    `\r\n--${boundary}--`,
  ])

  const resultado = await fetchDrive(
    userId,
    `${BASE_DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink,size`,
    { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body: cuerpo },
    LIMITE_TRANSFERENCIA_MS,
  )
  if (!resultado.ok) return resultado

  const datos = (await resultado.datos.json()) as { id: string; webViewLink?: string; size?: string }
  return {
    ok: true,
    datos: { driveFileId: datos.id, webViewLink: datos.webViewLink ?? null, tamanoBytes: datos.size ? Number(datos.size) : input.bytes.size },
  }
}

/** Devuelve el cuerpo como stream — nunca bufferiza el archivo completo en memoria del servidor. */
export async function descargarArchivoStream(
  userId: string,
  driveFileId: string,
): Promise<ResultadoDrive<{ cuerpo: ReadableStream<Uint8Array>; mimeType: string | null }>> {
  const resultado = await fetchDrive(userId, `${BASE_DRIVE_API}/files/${encodeURIComponent(driveFileId)}?alt=media`, {}, LIMITE_TRANSFERENCIA_MS)
  if (!resultado.ok) return resultado
  if (!resultado.datos.body) return { ok: false, clase: 'transitorio', detalle: 'Drive respondió sin cuerpo' }
  return { ok: true, datos: { cuerpo: resultado.datos.body, mimeType: resultado.datos.headers.get('content-type') } }
}

export async function listarArchivosDrive(
  userId: string,
  carpetaId: string,
): Promise<ResultadoDrive<{ archivos: Array<{ id: string; nombre: string; mimeType: string; tamanoBytes: number | null; webViewLink: string | null }> }>> {
  const q = `'${escaparValorConsultaDrive(carpetaId)}' in parents and trashed=false`
  const resultado = await fetchDrive(userId, `${BASE_DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,webViewLink)`)
  if (!resultado.ok) return resultado

  const cuerpo = (await resultado.datos.json()) as { files?: Array<{ id: string; name: string; mimeType: string; size?: string; webViewLink?: string }> }
  const archivos = (cuerpo.files ?? []).map((f) => ({
    id: f.id,
    nombre: f.name,
    mimeType: f.mimeType,
    tamanoBytes: f.size ? Number(f.size) : null,
    webViewLink: f.webViewLink ?? null,
  }))
  return { ok: true, datos: { archivos } }
}

/** Idempotente: un 404 (el archivo ya no existe) se trata como éxito, no como error. */
export async function borrarArchivo(userId: string, driveFileId: string): Promise<ResultadoDrive<Record<string, never>>> {
  const resultado = await fetchDrive(userId, `${BASE_DRIVE_API}/files/${encodeURIComponent(driveFileId)}`, { method: 'DELETE' })
  if (!resultado.ok) {
    if (resultado.clase === 'no_encontrado') return { ok: true, datos: {} }
    return resultado
  }
  return { ok: true, datos: {} }
}

/** Sin caché: el espacio usado cambia con cualquier subida de cualquier app, cachearlo mentiría. */
export async function obtenerEspacioUsado(userId: string): Promise<ResultadoDrive<{ usadoBytes: number; totalBytes: number | null }>> {
  const resultado = await fetchDrive(userId, `${BASE_DRIVE_API}/about?fields=storageQuota`)
  if (!resultado.ok) return resultado

  const cuerpo = await resultado.datos.json()
  const espacio = parsearEspacioUsado(cuerpo)
  if (!espacio) return { ok: false, clase: 'configuracion', detalle: 'Drive respondió sin storageQuota interpretable' }
  return { ok: true, datos: espacio }
}
