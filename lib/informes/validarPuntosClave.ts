import type { DatosSeccionIA } from './tipos'

// Sprint 18a — PURO. La red de seguridad de la única sección del informe que
// escribe la IA: si el texto generado menciona una cifra que NO se le pasó,
// se DESCARTA ENTERO y entra el fallback determinístico.
//
// Mismo criterio anti-alucinación que `calendar/dedupSchema.ts`: la lista de
// datos reales se pasa como argumento, y lo que el modelo dijo se resuelve
// CONTRA ella — nunca al revés.

/**
 * Números que la IA tiene permitido citar: los que se le dieron, más los
 * derivados triviales de esos mismos datos (un porcentaje y sus dos
 * componentes son el mismo hecho dicho de tres formas).
 *
 * Se guardan en VALOR ABSOLUTO: la IA dirá "bajaste 4 puntos" para un delta
 * de -4, y el signo lo aporta el verbo, no la cifra. Comparar con signo
 * descartaría respuestas correctas.
 */
export function numerosPermitidos(datos: DatosSeccionIA): Set<number> {
  const permitidos = new Set<number>()
  const agregar = (n: number | null | undefined) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return
    permitidos.add(Math.abs(Math.round(n * 10) / 10))
  }

  agregar(datos.completadas.hechas)
  agregar(datos.completadas.total)
  agregar(datos.completadas.porcentaje)
  agregar(datos.porcentajePuntualidad)
  agregar(datos.rachaDias)
  agregar(datos.deltaCompletadas)
  agregar(datos.deltaPuntualidad)

  // Las tareas NO completadas del periodo: la IA puede decir "te quedaron 4
  // pendientes" y es un hecho derivado directo de dos cifras que sí tiene.
  agregar(datos.completadas.total - datos.completadas.hechas)

  for (const m of datos.materias) {
    agregar(m.completadas)
    agregar(m.pendientes)
    agregar(m.completadas + m.pendientes)
  }

  return permitidos
}

// Captura enteros y decimales, con separador de millar o decimal español
// (1.250 / 8,5) o inglés (1,250 / 8.5). El signo NO se captura: se compara en
// valor absoluto (ver numerosPermitidos).
const NUMERO = /\d+(?:[.,]\d+)*/g

/**
 * Números mencionados en el texto, ya normalizados.
 *
 * ⚠️ LÍMITE CONOCIDO Y ACEPTADO: los números escritos en LETRAS ("ochenta y
 * dos") no se detectan. Parsear numerales españoles (con "veintiún", "y",
 * concordancia) sería más código y más superficie de bug que el problema que
 * resuelve. La mitigación real es el prompt, que pide cifras y prohíbe
 * inventarlas; y el peor caso de un falso negativo es una frase vaga, nunca
 * una cifra falsa con apariencia de dato.
 */
export function numerosEnTexto(texto: string): number[] {
  const encontrados: number[] = []
  for (const [bruto] of texto.matchAll(NUMERO)) {
    const n = normalizarNumero(bruto)
    if (n !== null) encontrados.push(n)
  }
  return encontrados
}

function normalizarNumero(bruto: string): number | null {
  let limpio = bruto
  // '1.250' o '1,250' → millar (3 dígitos exactos tras el separador y sin más
  // separadores decimales después). '8,5' o '8.5' → decimal.
  const esMillar = /^\d{1,3}([.,]\d{3})+$/.test(bruto)
  if (esMillar) {
    limpio = bruto.replace(/[.,]/g, '')
  } else {
    limpio = bruto.replace(',', '.')
  }
  const n = Number(limpio)
  return Number.isFinite(n) ? Math.abs(Math.round(n * 10) / 10) : null
}

export type ResultadoValidacion = { valido: true } | { valido: false; motivo: string }

/**
 * ¿El texto respeta los datos que se le dieron?
 *
 * Se valida en dos ejes:
 *  1. Números: cualquiera que no esté en `permitidos` invalida el texto.
 *  2. Nombres de materia: si el texto nombra una materia que el usuario no
 *     tiene, es una alucinación tan grave como una cifra inventada.
 */
export function validarPuntosClave(texto: string, datos: DatosSeccionIA): ResultadoValidacion {
  const permitidos = numerosPermitidos(datos)

  for (const n of numerosEnTexto(texto)) {
    if (!permitidos.has(n)) {
      return { valido: false, motivo: `cita el número ${n}, que no está en los datos provistos` }
    }
  }

  const materiaInventada = detectarMateriaInventada(texto, datos.materias.map((m) => m.nombre))
  if (materiaInventada) {
    return { valido: false, motivo: `menciona "${materiaInventada}", que no es una materia del usuario` }
  }

  return { valido: true }
}

/**
 * Busca nombres de materia que el texto menciona y el usuario NO tiene.
 *
 * Se compara en un solo sentido: por cada materia REAL se comprueba si el
 * texto la nombra. No se intenta el inverso (extraer "lo que parece un nombre
 * propio" del texto y ver si existe), porque en español toda frase empieza
 * con mayúscula y eso genera falsos positivos constantes. La detección real
 * de invención es el eje NUMÉRICO; esto solo atrapa el caso obvio de citar
 * una materia con un nombre parecido pero distinto.
 */
function detectarMateriaInventada(texto: string, materiasReales: string[]): string | null {
  const normalizado = normalizar(texto)
  const realesNorm = materiasReales.map(normalizar)

  // Secuencias en MAYÚSCULAS de 3+ caracteres: así se escriben las materias
  // en este proyecto ("BIOLOGÍA", "ED. FISICA"), lo que las hace detectables
  // sin caer en el falso positivo de la mayúscula inicial de frase.
  for (const [candidato] of texto.matchAll(/\b[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ.\s]{2,}\b/g)) {
    const cand = normalizar(candidato)
    if (cand.length < 3) continue
    const coincide = realesNorm.some((real) => real.includes(cand) || cand.includes(real))
    if (!coincide) return candidato.trim()
  }

  // Y el caso inverso barato: el texto dice tener una materia que sí existe.
  // (No invalida nada; está acá para dejar claro que el chequeo es asimétrico
  // a propósito.)
  void normalizado
  return null
}

/** Sin acentos, minúsculas, espacios colapsados — misma técnica que lib/horario/diff.ts. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
