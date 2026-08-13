// Sprint Rediseño /ai — Parte A.5. Red de seguridad, NO un reemplazo del
// sistema de bloques.
//
// El bug real que arregla: hoy el texto de la IA se pinta con `{m.texto}` en
// un <p>, así que si el modelo devuelve "**BIOLOGÍA**" el usuario ve los
// asteriscos literales en pantalla. Los bloques estructurados son la
// solución de fondo (el modelo ya no NECESITA markdown para dar estructura),
// pero nada garantiza que nunca se le escape uno.
//
// PURO y deliberadamente MÍNIMO: negrita, cursiva y código en línea. No es un
// parser de markdown — no hay enlaces, ni encabezados, ni tablas, ni
// anidamiento. Añadir eso sería reimplementar `marked` a mano, y para eso
// están los bloques.

export type FragmentoTexto = {
  texto: string
  negrita?: boolean
  cursiva?: boolean
  codigo?: boolean
}

// Se procesan en orden de precedencia: `**` antes que `*` (si no, el primer
// asterisco de `**x**` se comería como cursiva y quedaría un `*` suelto).
const MARCAS: { patron: RegExp; estilo: keyof Omit<FragmentoTexto, 'texto'> }[] = [
  { patron: /\*\*([^*]+)\*\*/, estilo: 'negrita' },
  { patron: /__([^_]+)__/, estilo: 'negrita' },
  { patron: /`([^`]+)`/, estilo: 'codigo' },
  { patron: /(?<![*\w])\*([^*\n]+)\*(?!\w)/, estilo: 'cursiva' },
  { patron: /(?<![_\w])_([^_\n]+)_(?!\w)/, estilo: 'cursiva' },
]

/**
 * Parte una línea en fragmentos con estilo. Un texto sin marcas devuelve un
 * único fragmento sin estilos — el camino normal, sin coste.
 */
export function fragmentosDeLinea(linea: string): FragmentoTexto[] {
  for (const { patron, estilo } of MARCAS) {
    const m = patron.exec(linea)
    if (!m || m.index === undefined) continue

    const antes = linea.slice(0, m.index)
    const despues = linea.slice(m.index + m[0].length)

    return [
      ...(antes ? fragmentosDeLinea(antes) : []),
      { texto: m[1], [estilo]: true },
      ...(despues ? fragmentosDeLinea(despues) : []),
    ]
  }

  return linea.length > 0 ? [{ texto: linea }] : []
}

export type LineaTexto = {
  /** `true` si la línea empezaba con "- " o "* " (viñeta de markdown). */
  vinieta: boolean
  fragmentos: FragmentoTexto[]
}

/**
 * Parte un texto en líneas, detectando viñetas de markdown para que se
 * rendericen como lista real y no como un guion suelto dentro de un párrafo.
 * Las líneas vacías se descartan (colapsar saltos dobles es lo que se ve
 * bien en una burbuja de chat).
 */
export function lineasDeTexto(texto: string): LineaTexto[] {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => {
      const esVinieta = /^[-*•]\s+/.test(l)
      const contenido = esVinieta ? l.replace(/^[-*•]\s+/, '') : l
      return { vinieta: esVinieta, fragmentos: fragmentosDeLinea(contenido) }
    })
}
