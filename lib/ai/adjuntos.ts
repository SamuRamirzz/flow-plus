// PURO — sin I/O, sin importar nada que toque Supabase, a propósito: así se
// puede probar sin variables de entorno (mismo criterio que lib/horario/
// dias.ts o lib/ai/agents/calendar/validar.ts). La parte con I/O real
// (subir a Storage / leer el archivo) vive en ./procesarAdjunto.ts.

const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp']
const TIPO_PDF = 'application/pdf'

// Mismo límite que storage_tareas.sql (file_size_limit) — se valida acá
// también para dar el error ANTES de intentar subir, no después de que
// Storage lo rechace.
export const LIMITE_BINARIO_BYTES = 10 * 1024 * 1024
// .txt/.md nunca pasan por Storage (se leen en cliente y se concatenan al
// texto del mensaje) — el límite es generoso para un enunciado o apuntes,
// pero evita que alguien adjunte un archivo enorme como "texto" y reviente
// el prompt.
export const LIMITE_TEXTO_BYTES = 2 * 1024 * 1024

// Sub-sprint 7.3.1 — cuántos adjuntos admite UN mensaje. 5 es el mismo
// orden de magnitud que otros asistentes con adjuntos (alcanza para "las
// fotos de las 3 páginas del enunciado" + un par de archivos más) sin dejar
// que un mensaje mande demasiadas imágenes de una y reviente tokens/
// latencia de la llamada.
export const LIMITE_ADJUNTOS_POR_MENSAJE = 5

export type TipoAdjunto = 'imagen' | 'documento' | 'texto'

// Decide por MIME primero; .md a veces llega con mimeType vacío o distinto
// según el navegador, así que ahí se cae a la extensión.
export function tipoDeArchivo(archivo: File): TipoAdjunto | null {
  if (TIPOS_IMAGEN.includes(archivo.type)) return 'imagen'
  if (archivo.type === TIPO_PDF) return 'documento'
  if (archivo.type === 'text/plain' || archivo.type === 'text/markdown' || /\.(txt|md)$/i.test(archivo.name)) return 'texto'
  return null
}

// Para dar feedback inmediato al elegir/pegar/soltar un archivo (antes de
// intentar procesarlo). procesarAdjunto() la vuelve a llamar antes de subir/
// leer — no es redundante, es defensa en profundidad: nada impide que algo
// llame a procesarAdjunto sin pasar por la UI que ya validó.
export function validarAdjunto(archivo: File): string | null {
  const tipo = tipoDeArchivo(archivo)
  if (!tipo) return 'Solo se aceptan imágenes (PNG/JPG/WEBP), PDF, TXT o MD'
  if (tipo === 'documento' && archivo.size > LIMITE_BINARIO_BYTES) return 'El PDF pesa demasiado (máx. 10MB)'
  if (tipo === 'texto' && archivo.size > LIMITE_TEXTO_BYTES) return 'El archivo de texto pesa demasiado (máx. 2MB)'
  return null
}

// Adjunto binario (imagen/PDF): ya subido a Storage, listo para que el
// servidor lo descargue y arme un AdjuntoIA real (ver app/api/ai/tareas).
export type AdjuntoBinarioProcesado = { ok: true; tipo: 'imagen' | 'documento'; ruta: string }
// Adjunto de texto (.txt/.md): NUNCA toca Storage ni el mecanismo de
// adjuntos "visuales" del provider — se lee en cliente y quien llama lo
// concatena al texto del mensaje antes de mandarlo.
export type AdjuntoTextoProcesado = { ok: true; tipo: 'texto'; nombre: string; contenido: string }
export type AdjuntoProcesado = AdjuntoBinarioProcesado | AdjuntoTextoProcesado | { ok: false; error: string }

// Concatena el contenido de los adjuntos de texto al mensaje del usuario. El
// texto de cada archivo queda claramente delimitado para que el modelo no
// lo confunda con texto que el usuario escribió a mano.
export function concatenarTextoConAdjuntos(texto: string, textos: AdjuntoTextoProcesado[]): string {
  return textos.reduce((acc, t) => `${acc}\n\n--- Contenido de "${t.nombre}" ---\n${t.contenido}`, texto)
}
