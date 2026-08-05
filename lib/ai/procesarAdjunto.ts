import { reducirImagen } from '@/lib/imagen'
import { subirArchivo } from '@/lib/storage'
import { tipoDeArchivo, validarAdjunto, type AdjuntoProcesado } from './adjuntos'

const BUCKET_TAREAS = 'tareas'
const TIPO_PDF = 'application/pdf'

// Nota sobre .docx (Word) — decisión explícita, no un olvido: el SDK de
// Gemini no lo soporta como DocumentContent (solo application/pdf, ver
// Sprint 8), así que la única vía sería extraer el texto en cliente. La
// librería estándar para eso (mammoth) arrastra jszip por dentro y suma un
// peso real al bundle por una necesidad angosta (leer Word) que ya tiene un
// atajo de 2 clics (exportar/imprimir a PDF, que SÍ se soporta). Se deja
// FUERA de alcance de este sub-sprint — revisar si en algún punto hay
// varios pedidos reales de esto antes de sumar la dependencia.
export async function procesarAdjunto(archivo: File): Promise<AdjuntoProcesado> {
  const errorValidacion = validarAdjunto(archivo)
  if (errorValidacion) return { ok: false, error: errorValidacion }

  const tipo = tipoDeArchivo(archivo)
  if (tipo === 'texto') {
    try {
      const contenido = await archivo.text()
      return { ok: true, tipo: 'texto', nombre: archivo.name, contenido }
    } catch {
      return { ok: false, error: `No se pudo leer "${archivo.name}"` }
    }
  }

  if (tipo === 'documento') {
    const subida = await subirArchivo(BUCKET_TAREAS, archivo, 'pdf', TIPO_PDF)
    return subida.ok ? { ok: true, tipo: 'documento', ruta: subida.ruta } : subida
  }

  // Imagen: se reduce en cliente (mismo criterio que horario, lib/imagen.ts)
  // antes de subir.
  let reducida: Blob
  try {
    reducida = await reducirImagen(archivo)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo procesar la imagen' }
  }
  const subida = await subirArchivo(BUCKET_TAREAS, reducida, 'jpg', 'image/jpeg')
  return subida.ok ? { ok: true, tipo: 'imagen', ruta: subida.ruta } : subida
}
