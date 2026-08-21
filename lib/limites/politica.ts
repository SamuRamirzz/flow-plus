// Política de topes de uso — PURA, sin I/O, sin `new Date()`.
//
// Vive aparte del helper de servidor (lib/server/limites.ts) por el mismo
// motivo que lib/realtimeReconciliar.ts vive aparte de useRealtimeSync.ts:
// el helper importa `supabaseServer`, que exige la service role key al
// cargar el módulo y rompe Vitest en el entorno `node`. Separando la
// decisión del I/O, las reglas quedan testeables sin red ni base.

/**
 * Acciones con tope. Cada una agrupa endpoints que comparten perfil de
 * coste — no hay una por endpoint a propósito: quien abusa lo hace contra
 * el recurso (la factura de IA, el número de WhatsApp), no contra una URL,
 * así que repartir el tope por ruta dejaría multiplicar el gasto llamando a
 * varias rutas equivalentes.
 */
export type AccionLimitada =
  | 'ia_mensaje'
  | 'ia_vision'
  | 'ia_archivo'
  | 'informe_pdf'
  | 'whatsapp_envio'

export type Politica = {
  /** Máximo de ejecuciones permitidas dentro de la ventana. */
  max: number
  /** Tamaño de la ventana deslizante, en minutos. */
  ventanaMinutos: number
  /** Qué se le dice al usuario. Nunca revela el número exacto del tope. */
  mensaje: string
}

// Los números salen de uso real, no de una cifra redonda arbitraria: la
// referencia es la cuenta real del usuario (4 tareas, 19 materias, 40
// bloques), donde una sesión intensa de `/ai` ronda los 10-15 mensajes.
// Se deja un margen amplio sobre eso — el tope existe para cortar un bucle
// automatizado, no para racionar el uso normal.
export const POLITICAS: Record<AccionLimitada, Politica> = {
  // Conversación con la IA (/api/ai/tareas, /api/ai/homework) y el canal de
  // WhatsApp cuando cae en lenguaje natural.
  ia_mensaje: {
    max: 60,
    ventanaMinutos: 60,
    mensaje: 'Le estás escribiendo a la IA muy seguido. Espera un momento y vuelve a intentarlo.',
  },
  // Visión sobre una foto de horario. Más cara por token de imagen y con un
  // uso real mucho más bajo: se importa el horario una vez por semestre.
  ia_vision: {
    max: 20,
    ventanaMinutos: 60,
    mensaje: 'Analizaste muchas imágenes seguidas. Espera un momento antes de subir otra.',
  },
  // Analizar un archivo o preguntarle algo. Los documentos grandes son de
  // lo más caro que manda este proyecto.
  ia_archivo: {
    max: 40,
    ventanaMinutos: 60,
    mensaje: 'Hiciste muchas consultas sobre archivos seguidas. Espera un momento.',
  },
  // Informe en PDF: renderiza el documento entero y además llama a la IA
  // para los puntos clave. Es la operación más pesada del proyecto.
  informe_pdf: {
    max: 10,
    ventanaMinutos: 60,
    mensaje: 'Generaste varios informes seguidos. Espera un momento antes de pedir otro.',
  },
  // Envío saliente por WhatsApp disparado a mano ("enviarme el menú de
  // prueba"). El tope más bajo, y NO por coste: el número del canal es un
  // recurso compartido, y que WhatsApp lo marque como spam rompería el
  // canal para todos los usuarios, no solo para quien abusó.
  whatsapp_envio: {
    max: 5,
    ventanaMinutos: 60,
    mensaje: 'Enviaste varios mensajes de prueba seguidos. Espera un rato antes de mandar otro.',
  },
}

/**
 * ¿El conteo observado en la ventana agota el tope?
 *
 * Se compara con `>=` y no con `>`: `conteo` son las ejecuciones YA
 * registradas, así que al llegar al máximo la siguiente sobra.
 */
export function excedeLimite(conteo: number, politica: Politica): boolean {
  return conteo >= politica.max
}

/** Inicio de la ventana deslizante, dado el "ahora" que reciba el llamador. */
export function inicioVentana(ahoraMs: number, politica: Politica): Date {
  return new Date(ahoraMs - politica.ventanaMinutos * 60_000)
}
