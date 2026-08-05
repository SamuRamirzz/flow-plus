import type { CamposExamen, FormatoExamen } from './types'

// PURO — sin I/O, sin new Date(), nunca lanza. Misma disciplina que
// calendar/validar.ts y reminder/ventanas.ts.
//
// Existe porque lo que dice un modelo (o un usuario) sobre el formato y el
// peso de un examen NO calza directo con lo que la base acepta:
// `tareas.formato` tiene un CHECK de 4 valores y `tareas.peso` uno de 0-100.
// Sin esta capa, un "vale 30%" o un "es de desarrollo" haría fallar el insert
// — o peor, guardaría basura. Normalizar acá (puro y testeable) en vez de
// dentro del agente permite probar todos estos casos sin red.

const FORMATOS: FormatoExamen[] = ['oral', 'escrito', 'proyecto', 'mixto']

// Sinónimos reales del español académico → el valor cerrado que guarda la
// base. La lista no pretende ser exhaustiva: lo que no calza cae en `null`
// (campo vacío), que es el resultado correcto para "no se sabe" — nunca se
// adivina un formato, porque un formato equivocado es peor que ninguno.
const SINONIMOS: Record<string, FormatoExamen> = {
  oral: 'oral',
  exposicion: 'oral',
  exposición: 'oral',
  presentacion: 'oral',
  presentación: 'oral',
  defensa: 'oral',
  escrito: 'escrito',
  teorico: 'escrito',
  teórico: 'escrito',
  desarrollo: 'escrito',
  ensayo: 'escrito',
  test: 'escrito',
  quiz: 'escrito',
  'opcion multiple': 'escrito',
  'opción múltiple': 'escrito',
  proyecto: 'proyecto',
  practico: 'proyecto',
  práctico: 'proyecto',
  laboratorio: 'proyecto',
  lab: 'proyecto',
  entrega: 'proyecto',
  mixto: 'mixto',
  combinado: 'mixto',
  'oral y escrito': 'mixto',
}

// Quita acentos para que "teórico" y "teorico" caigan en la misma entrada sin
// duplicar cada clave del mapa. NFD + rango de diacríticos combinantes: es la
// forma estándar sin dependencias.
function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function normalizarFormato(valor: unknown): FormatoExamen | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim().toLowerCase()
  if (limpio.length === 0) return null
  if (FORMATOS.includes(limpio as FormatoExamen)) return limpio as FormatoExamen

  // Coincidencia exacta primero (con y sin acentos), después por palabra
  // contenida — "examen escrito de química" debe resolver a 'escrito'.
  const directo = SINONIMOS[limpio] ?? SINONIMOS[sinAcentos(limpio)]
  if (directo) return directo

  const limpioSinAcentos = sinAcentos(limpio)
  for (const [clave, formato] of Object.entries(SINONIMOS)) {
    const claveSinAcentos = sinAcentos(clave)
    // \b para no confundir "lab" dentro de "labor" o "elaborar".
    if (new RegExp(`\\b${claveSinAcentos}\\b`).test(limpioSinAcentos)) return formato
  }
  return null
}

// Acepta 30, "30", "30%", "0.3" y "vale el 30% de la nota". Devuelve siempre
// PORCENTAJE 0-100 o null.
export function normalizarPeso(valor: unknown): number | null {
  let n: number | null = null

  if (typeof valor === 'number') {
    n = valor
  } else if (typeof valor === 'string') {
    const limpio = valor.trim()
    if (limpio.length === 0) return null
    // Primer número del texto, admitiendo coma decimal ("0,3").
    const m = limpio.replace(',', '.').match(/-?\d+(\.\d+)?/)
    if (!m) return null
    n = Number(m[0])
  }

  if (n === null || !Number.isFinite(n)) return null
  // Un valor negativo no es un peso; 0 tampoco aporta información útil y es
  // el centinela que usa el schema para "no lo dijo".
  if (n <= 0) return null

  // Fracción → porcentaje: solo por debajo de 1, donde es inequívoco ("0.3"
  // solo puede querer decir 30%). A partir de 1 se toma literal, porque "1"
  // sí puede ser un examen que vale el 1%.
  if (n < 1) n = n * 100

  if (n > 100) return null
  // Dos decimales: "33.333" no aporta precisión real sobre una nota.
  return Math.round(n * 100) / 100
}

export function normalizarTemario(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  // Colapsa saltos de línea y espacios repetidos: el modelo a veces devuelve
  // el temario como lista multilínea y guardarlo así rompe el layout de una
  // sola línea en la UI.
  const limpio = valor.replace(/\s+/g, ' ').trim()
  return limpio.length > 0 ? limpio : null
}

/** Normaliza los tres campos a la vez. Nunca lanza; lo que no se entiende
 *  queda en `null`, que es lo que la columna acepta. */
export function normalizarCamposExamen(bruto: { temario?: unknown; formato?: unknown; peso?: unknown }): CamposExamen {
  return {
    temario: normalizarTemario(bruto.temario),
    formato: normalizarFormato(bruto.formato),
    peso: normalizarPeso(bruto.peso),
  }
}

/** `true` si al menos un campo trae información — lo usa el llamador para no
 *  emitir un UPDATE que no cambia nada. */
export function tieneAlgunCampo(campos: CamposExamen): boolean {
  return campos.temario !== null || campos.formato !== null || campos.peso !== null
}
