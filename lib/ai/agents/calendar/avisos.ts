import type { ColisionDetectada, ResultadoPlausibilidad } from './types'

// PURO — arma el texto que se muestra en el toast existente (useToast) tras
// crear/modificar una tarea. Sprint 10 pide una "nota pasiva, nunca modal
// bloqueante": esto NO es un componente nuevo, es una cadena que se agrega
// al mensaje de éxito que el cliente ya manda con notify().
export function mensajeAvisoCalendario(
  avisoFecha: ResultadoPlausibilidad | null | undefined,
  colisiones: ColisionDetectada[] | null | undefined
): string | null {
  const partes: string[] = []

  if (avisoFecha && !avisoFecha.valida && avisoFecha.motivo) partes.push(avisoFecha.motivo)

  if (colisiones && colisiones.length > 0) {
    partes.push(colisiones.length === 1 ? `Choca con "${colisiones[0].titulo}" ese día` : `Choca con ${colisiones.length} tareas más ese día`)
  }

  return partes.length > 0 ? partes.join(' — ') : null
}
