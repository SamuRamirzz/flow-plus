import type { MetricaComparada } from './tipos'

// Sprint 18a — PURO.

/**
 * Menos de 1 punto porcentual se considera "igual". Sin este umbral, el
 * informe mostraría "▲ 0 %" (por un delta de 0.4 redondeado) que no dice
 * nada y además se contradice a sí mismo: una flecha hacia arriba junto a un
 * cero.
 */
const UMBRAL_IGUAL_PP = 1

/**
 * `hayDatosPrevios` es un parámetro aparte y no se infiere de
 * `anterior === 0`: "el periodo anterior no existió" y "el periodo anterior
 * fue 0 %" son estados distintos que el informe muestra distinto.
 */
export function compararMetricas(actual: number | null, anterior: number | null, hayDatosPrevios: boolean): MetricaComparada {
  const a = actual ?? 0
  const p = anterior ?? 0
  const comparable = hayDatosPrevios && actual !== null && anterior !== null
  const delta = a - p
  const direccion: MetricaComparada['direccion'] = !comparable || Math.abs(delta) < UMBRAL_IGUAL_PP ? 'igual' : delta > 0 ? 'sube' : 'baja'
  return { actual: a, anterior: p, delta, direccion, comparable }
}

export function simboloTendencia(direccion: MetricaComparada['direccion'] | 'sin_comparacion'): string {
  if (direccion === 'sube') return '▲'
  if (direccion === 'baja') return '▼'
  if (direccion === 'igual') return '='
  return '—'
}

/** '12 pts' / '5 pts' / '=' / '—'. El símbolo va APARTE (ver `simboloDelta`). */
export function textoDelta(metrica: MetricaComparada): string {
  if (!metrica.comparable) return '—'
  if (metrica.direccion === 'igual') return '='
  return `${Math.abs(metrica.delta)} pts`
}

/**
 * El símbolo ▲/▼ separado del texto, para poder renderizarlo en su propia
 * fuente. Devuelve `undefined` cuando no hay flecha que mostrar — así el
 * llamador puede omitir el nodo entero en vez de dibujar un espacio vacío.
 */
export function simboloDelta(metrica: MetricaComparada): string | undefined {
  if (!metrica.comparable || metrica.direccion === 'igual') return undefined
  return simboloTendencia(metrica.direccion)
}
