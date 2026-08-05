// Lado más largo al que se reduce una foto antes de subirla. Una foto de
// celular moderna ronda 3-8MB y 4000px de lado; a 1600px el texto de un
// horario impreso sigue siendo legible para el modelo (verificado con la
// imagen de prueba del Sprint 8) y el archivo baja a unos cientos de KB —
// menos espera para el usuario y menos tokens de imagen por llamada.
export const LADO_MAXIMO = 1600

/** Calidad JPEG del reducido. 0.85 no deja artefactos visibles en texto. */
const CALIDAD = 0.85

/**
 * PURA: dado el tamaño original, devuelve el tamaño reducido conservando la
 * proporción. Nunca AGRANDA una imagen que ya es más chica que el máximo
 * (subir de resolución no añade información y sí peso).
 */
export function calcularTamanoReducido(ancho: number, alto: number, ladoMaximo: number = LADO_MAXIMO): { ancho: number; alto: number } {
  const ladoMayor = Math.max(ancho, alto)
  if (ladoMayor <= ladoMaximo) return { ancho, alto }
  const escala = ladoMaximo / ladoMayor
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) }
}

/**
 * Reduce una imagen a `LADO_MAXIMO` usando canvas. Solo navegador (usa
 * Image/canvas/URL.createObjectURL) — por eso la aritmética vive aparte en
 * calcularTamanoReducido(), que sí se puede probar sin DOM.
 */
export async function reducirImagen(archivo: File, ladoMaximo: number = LADO_MAXIMO): Promise<Blob> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('No se pudo leer la imagen'))
      el.src = url
    })

    const { ancho, alto } = calcularTamanoReducido(img.naturalWidth, img.naturalHeight, ladoMaximo)
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo preparar el lienzo para reducir la imagen')
    ctx.drawImage(img, 0, 0, ancho, alto)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', CALIDAD))
    if (!blob) throw new Error('No se pudo comprimir la imagen')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
