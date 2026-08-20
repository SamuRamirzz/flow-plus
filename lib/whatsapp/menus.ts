// Sprint 2/3 (menús) — definición PURA de los menús de WhatsApp y su
// degradación a texto plano. Sin I/O: qué opciones hay y cómo se ven es
// lógica testeable; enviarlas es otra capa (lib/server/whatsapp.ts).

export type OpcionMenu = {
  /** Id que vuelve en el webhook al tocar la opción. Prefijo `menu:` para distinguirlo de un mensaje normal. */
  id: string
  /** Texto del botón. WhatsApp corta a 25 caracteres — se respeta acá, no se descubre en producción. */
  titulo: string
  /** Solo se muestra en el modo lista; los botones no admiten descripción. */
  descripcion?: string
}

export type Menu = {
  cuerpo: string
  opciones: OpcionMenu[]
  /** Etiqueta del desplegable cuando se envía como lista. */
  etiquetaLista: string
}

// Límite REAL de WhatsApp para botones de respuesta rápida, confirmado en la
// documentación de Whapi: "no more than 3 buttons", 25 caracteres de título.
// Con más opciones hay que usar lista desplegable, no botones.
export const MAX_BOTONES = 3
export const MAX_LARGO_TITULO = 25

export const MENU_PRINCIPAL: Menu = {
  cuerpo: '¿Qué quieres hacer?\n\nTambién puedes escribirme normal: _"ensayo de historia para el viernes"_.',
  etiquetaLista: 'Ver opciones',
  opciones: [
    { id: 'menu:tareas_hoy', titulo: 'Tareas de hoy', descripcion: 'Lo que tienes pendiente hoy' },
    { id: 'menu:semana', titulo: 'Tareas de la semana', descripcion: 'Todo lo de esta semana' },
    { id: 'menu:horario', titulo: 'Mi horario', descripcion: 'Tus bloques de hoy' },
    { id: 'menu:proximo', titulo: 'Qué sigue', descripcion: 'Tu próxima clase o entrega' },
    { id: 'menu:ayuda', titulo: 'Ayuda', descripcion: 'Cómo usar Flow+ por aquí' },
  ],
}

/** ¿Este texto es una petición de menú? Deliberadamente corto y cerrado. */
const PALABRAS_MENU = ['menu', 'menú', 'hola', 'buenas', 'inicio', 'opciones', 'empezar']

export function pideMenu(texto: string): boolean {
  const t = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    // Se recorta la puntuación de AMBOS extremos, no solo del final: en
    // español la interrogación y la exclamación abren con `¿`/`¡`, así que
    // recortar solo el cierre dejaba "¿opciones" sin reconocer.
    .replace(/^[!¡.?¿\s]+|[!¡.?¿\s]+$/g, '')
  return PALABRAS_MENU.some((p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '') === t)
}

/**
 * El menú como texto numerado, para cuando el envío interactivo falla.
 *
 * Existe porque la propia documentación de Whapi advierte que la
 * funcionalidad de botones "no es estable" y depende de cambios que WhatsApp
 * hace por su cuenta. El usuario nunca debe quedarse sin ver las opciones
 * porque un botón dejó de funcionar: en ese caso responde con el número.
 */
export function menuComoTexto(menu: Menu): string {
  const lineas = menu.opciones.map((o, i) => `${i + 1}. ${o.titulo}${o.descripcion ? ` — _${o.descripcion}_` : ''}`)
  return `${menu.cuerpo}\n\n${lineas.join('\n')}\n\n_Responde con el número._`
}

/**
 * Traduce la respuesta del usuario a un id de opción. Acepta las dos formas
 * que puede llegar: el id exacto (tocó un botón) o el número (escribió tras
 * ver el fallback de texto).
 */
export function resolverOpcion(menu: Menu, entrada: string): OpcionMenu | null {
  const t = entrada.trim()
  const porId = menu.opciones.find((o) => o.id === t)
  if (porId) return porId

  if (/^\d+$/.test(t)) {
    const indice = Number(t) - 1
    if (indice >= 0 && indice < menu.opciones.length) return menu.opciones[indice]
  }
  return null
}

/**
 * Cada opción del menú se traduce a un comando de texto ya existente, en vez
 * de tener su propia implementación: el menú es una forma de ESCRIBIR el
 * comando, no un camino paralelo. Así nada puede divergir entre lo que hace
 * el botón y lo que hace `/tareas`.
 */
export function comandoDeOpcion(id: string): string | null {
  switch (id) {
    case 'menu:tareas_hoy':
      return '/tareas hoy'
    case 'menu:semana':
      return '/tareas semana'
    case 'menu:horario':
      return '/horario'
    case 'menu:proximo':
      return '/proximo'
    case 'menu:ayuda':
      return '/ayuda'
    default:
      return null
  }
}
