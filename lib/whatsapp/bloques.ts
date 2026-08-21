import type { BloqueRespuesta } from '@/lib/ai/agents/taskManagement'

// Sprint 2/3 — bug real encontrado en producción: la IA le dijo al usuario
// "Tienes estas tareas pendientes:" y no le mostró ninguna de sus 4 tareas.
//
// Causa: `TaskManagementAgentOutput` separa la respuesta en `mensaje` (el
// texto libre, "Tienes estas tareas pendientes:") y `bloques` (la
// presentación ESTRUCTURADA — la lista real de tareas va ahí, no en
// `mensaje`). `ejecutarConIA` solo leía `mensaje`. La pantalla /ai nunca
// tuvo este bug porque su UI (components/ai/*) sí renderiza `bloques`; este
// canal, al ser texto plano, los ignoraba por completo.
//
// PURO — mismo criterio que lib/ai/markdownSimple.ts: sin I/O, testeable
// sin red. WhatsApp no tiene tablas ni jerarquía visual real, así que cada
// tipo de bloque se aplana a lo mejor que el formato mínimo de WhatsApp
// permite (*negrita*, líneas, viñetas).

function renderBloque(bloque: BloqueRespuesta): string {
  switch (bloque.tipo) {
    case 'texto':
      return bloque.contenido

    case 'lista':
      return bloque.items.map((item) => `• ${item}`).join('\n')

    case 'lista_detallada':
      return bloque.items
        .map((item) => {
          const detalle = item.detalle.map((linea) => `   ${linea}`).join('\n')
          return detalle ? `*${item.titulo}*\n${detalle}` : `*${item.titulo}*`
        })
        .join('\n\n')

    case 'tabla':
      // WhatsApp no tiene tablas: cada fila se aplana a pares
      // "*columna:* valor", que es exactamente lo que ya hace 'renglones'
      // — una tabla es, en el fondo, una lista de renglones con las mismas
      // columnas. Filas más cortas que `columnas` (ya rellenadas por el
      // parser del agente) no producen una etiqueta vacía rota: se omiten.
      return bloque.filas
        .map((fila) =>
          bloque.columnas
            .map((col, i) => (fila[i] ? `*${col}:* ${fila[i]}` : null))
            .filter((linea): linea is string => linea !== null)
            .join('\n')
        )
        .filter((bloqueFila) => bloqueFila.length > 0)
        .join('\n\n')

    case 'renglones':
      return bloque.pares.map((p) => `*${p.etiqueta}:* ${p.valor}`).join('\n')
  }
}

/**
 * Todos los bloques de una respuesta, concatenados en texto plano de
 * WhatsApp. Bloques vacíos (una lista sin items, etc.) no deberían llegar —
 * el parser del agente ya los descarta— pero se filtran igual por si acaso:
 * mejor omitir uno vacío que mandar una línea en blanco suelta.
 */
export function renderizarBloques(bloques: BloqueRespuesta[]): string {
  return bloques
    .map(renderBloque)
    .filter((texto) => texto.trim().length > 0)
    .join('\n\n')
}
