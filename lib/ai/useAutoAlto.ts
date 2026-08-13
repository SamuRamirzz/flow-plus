'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Sprint Correcciones /ai — Parte 6.2. Hace que un `<textarea>` crezca con su
 * contenido hasta un tope, y a partir de ahí haga scroll interno.
 *
 * Depende del VALOR y no de un `onChange`, a propósito: el texto de estos
 * composers también cambia por caminos que no disparan `onChange` (dictado
 * por voz, `setTexto('')` al enviar, pegar un ejemplo). Atarlo al evento
 * dejaría la altura desincronizada justo en esos casos.
 *
 * Solo escribe estilos en el DOM — no toca estado de React, así que no cae en
 * la regla `react-hooks/set-state-in-effect` que este proyecto mantiene en
 * cero.
 */
export function useAutoAlto(ref: RefObject<HTMLTextAreaElement | null>, valor: string, altoMax: number) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 'auto' primero: sin resetear, `scrollHeight` nunca baja y el textarea
    // solo podría crecer, jamás encogerse al borrar texto.
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, altoMax)}px`
    el.style.overflowY = el.scrollHeight > altoMax ? 'auto' : 'hidden'
  }, [ref, valor, altoMax])
}
