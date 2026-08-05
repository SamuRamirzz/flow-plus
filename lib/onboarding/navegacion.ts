// Sprint Onboarding / Parte B — movimiento entre pasos del carrusel.
//
// Puro y sin React a propósito: el componente se queda solo con "dibujar y
// escuchar eventos", y las reglas de borde (no pasarse del último, no
// retroceder del primero, cuánto arrastre cuenta como swipe) quedan
// testeables sin montar nada ni simular gestos.

/** Dirección del último movimiento — la animación de entrada/salida depende
 *  de ella (el paso nuevo entra por el lado contrario al que salió el
 *  anterior). Es un dato de la transición, no del estado. */
export type Direccion = 1 | -1

export type EstadoCarrusel = {
  paso: number
  direccion: Direccion
}

export function estadoInicial(): EstadoCarrusel {
  return { paso: 0, direccion: 1 }
}

// Clamp explícito en vez de módulo: un carrusel de onboarding NO debe ser
// circular. Volver al paso 1 después del último haría creer que la
// experiencia no termina nunca, justo cuando el usuario espera el botón de
// salida.
export function irA(estado: EstadoCarrusel, destino: number, total: number): EstadoCarrusel {
  if (total <= 0) return estado
  const acotado = Math.max(0, Math.min(destino, total - 1))
  if (acotado === estado.paso) return estado
  return { paso: acotado, direccion: acotado > estado.paso ? 1 : -1 }
}

export function siguiente(estado: EstadoCarrusel, total: number): EstadoCarrusel {
  return irA(estado, estado.paso + 1, total)
}

export function anterior(estado: EstadoCarrusel, total: number): EstadoCarrusel {
  return irA(estado, estado.paso - 1, total)
}

export function esUltimo(estado: EstadoCarrusel, total: number): boolean {
  return estado.paso >= total - 1
}

export function esPrimero(estado: EstadoCarrusel): boolean {
  return estado.paso === 0
}

// ───────────────────────────────────────────────────────────────────────────
// Swipe
// ───────────────────────────────────────────────────────────────────────────
// Se decide por distancia O por velocidad, no solo por distancia: un flick
// corto y rápido es un swipe deliberado y debe contar, mientras que arrastrar
// 100px muy despacio y soltar suele ser alguien que se arrepintió a mitad.
// Es el mismo criterio que usan los carruseles nativos.
export const UMBRAL_DISTANCIA_PX = 60
export const UMBRAL_VELOCIDAD = 400

/** `offset`/`velocity` vienen del `onDragEnd` de motion (eje x). Devuelve
 *  cuántos pasos moverse: -1, 0 o 1. */
export function pasoPorSwipe(offsetX: number, velocidadX: number): -1 | 0 | 1 {
  const fuerte = Math.abs(velocidadX) >= UMBRAL_VELOCIDAD
  const lejos = Math.abs(offsetX) >= UMBRAL_DISTANCIA_PX
  if (!fuerte && !lejos) return 0

  // Arrastrar hacia la IZQUIERDA (offset negativo) avanza — el contenido se
  // va hacia la izquierda para dejar ver el siguiente, igual que pasar la
  // página de un carrusel.
  //
  // Con distancia y velocidad en desacuerdo (arrastré a la derecha pero solté
  // con impulso a la izquierda), manda el gesto que superó su umbral; si los
  // dos lo superan, manda la velocidad, que es la intención más reciente.
  if (fuerte) return velocidadX < 0 ? 1 : -1
  return offsetX < 0 ? 1 : -1
}
