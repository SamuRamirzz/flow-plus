import { crearTareaServidor } from '@/lib/server/tareas'
import { procesarMensajeTareas } from '@/lib/server/ia/mensajeTareas'
import type { OperacionTarea } from '@/lib/ai/agents/taskManagement'
import type { ResultadoEjecucion } from './ejecutarComando'

// Sprint 2/3 (menús) — interpretación por IA de un mensaje libre de WhatsApp.
//
// Reusa `procesarMensajeTareas`, EXACTAMENTE el mismo pipeline que mueve la
// pantalla /ai (extraído a lib/server/ia/ para esto): mismo agente, mismo
// contexto, mismas operaciones de nota y de horario ejecutadas del lado del
// servidor. Acá solo se añade lo que /ai resuelve con su interfaz y WhatsApp
// no tiene: aplicar las operaciones de TAREA y redactar una respuesta de
// texto.
//
// ─────────────────────────────────────────────────────────────────────────
// AUTONOMÍA: crear se aplica solo; modificar y borrar NO
// ─────────────────────────────────────────────────────────────────────────
// En /ai el usuario ve cada operación propuesta y decide aplicarla, con un
// Deshacer real detrás. Por WhatsApp no hay ninguna de las dos cosas: si el
// bot borra la tarea equivocada, no queda rastro ni forma de revertirlo.
//
// Por eso la asimetría, que es deliberada y no una limitación técnica:
//   · CREAR es aditivo — el peor caso es una tarea de más, que se borra en
//     un segundo. Se aplica sin preguntar.
//   · MODIFICAR y BORRAR son destructivos e irreversibles en este canal. Se
//     reportan como propuesta y se le pide al usuario que las confirme desde
//     la app (o con el comando explícito `/completar`, que sí es acotado).
// Mismo criterio con el que `CalendarAgent` avisa de colisiones sin
// bloquear, y con el que la fusión de materias exige un clic humano.

const MAX_TAREAS_POR_MENSAJE = 5

// `modificar`/`borrar` no llevan `titulo` suelto: llevan la tarea entera en
// `antes` (ver OperacionModificar/OperacionBorrar). Leerlo de ahí permite
// nombrarla de verdad —"Borrar «Ensayo de historia»"— en vez de un genérico
// "esa tarea", que en un mensaje de confirmación es justo lo que el usuario
// necesita para saber qué está confirmando.
function nombreDeOperacion(op: OperacionTarea): string {
  if (op.tipo === 'modificar' || op.tipo === 'borrar') return op.antes.titulo
  if (op.tipo === 'crear') return op.titulo
  return 'esa tarea'
}

/**
 * Aplica las operaciones de creación y resume el resto. Devuelve las líneas
 * de la respuesta, ya redactadas para WhatsApp.
 */
async function aplicarOperaciones(userId: string, operaciones: OperacionTarea[]): Promise<string[]> {
  const lineas: string[] = []
  const creadas: string[] = []
  const pendientes: string[] = []
  const ambiguas: string[] = []
  let fallidas = 0
  let sinCoincidencias = 0

  for (const op of operaciones.slice(0, MAX_TAREAS_POR_MENSAJE)) {
    if (op.tipo === 'crear') {
      // Sin materia no se puede crear: es la misma regla de
      // `crearTareaSchema` que respeta el canal de comandos.
      if (!op.materia) {
        pendientes.push(`“${op.titulo}” — dime de qué materia es`)
        continue
      }
      const r = await crearTareaServidor(userId, {
        titulo: op.titulo,
        materiaId: null,
        nuevaMateria: op.materia,
        fecha: op.fecha ?? null,
        prioridad: op.prioridad ?? 'media',
        tipo: op.tipoTarea,
        fechaOrigen: 'ia',
      })
      if (r.ok) creadas.push(op.titulo)
      else {
        console.error('[whatsapp/ia] no se pudo crear la tarea propuesta:', r.error)
        fallidas++
      }
    } else if (op.tipo === 'ambiguo') {
      ambiguas.push(nombreDeOperacion(op))
    } else if (op.tipo === 'modificar' || op.tipo === 'borrar') {
      // Ver la nota de autonomía de la cabecera: no se ejecuta.
      pendientes.push(`${op.tipo === 'borrar' ? 'Borrar' : 'Cambiar'} “${nombreDeOperacion(op)}” — confírmalo desde la app`)
    } else {
      // `sin_coincidencias`: el modelo entendió la intención pero no
      // encontró contra qué aplicarla. Decirlo es más útil que callar.
      sinCoincidencias++
    }
  }

  if (creadas.length === 1) lineas.push(`✅ Creada: *${creadas[0]}*`)
  else if (creadas.length > 1) lineas.push(`✅ Creadas ${creadas.length} tareas:\n${creadas.map((t) => `• ${t}`).join('\n')}`)

  if (ambiguas.length > 0) lineas.push('🤔 Hay más de una que coincide — dime cuál exactamente.')
  for (const p of pendientes) lineas.push(`⚠️ ${p}`)
  if (sinCoincidencias > 0) lineas.push('No encontré esa tarea entre las tuyas.')
  if (fallidas > 0) lineas.push('No pude guardar alguna de las tareas. Inténtalo de nuevo.')
  if (operaciones.length > MAX_TAREAS_POR_MENSAJE) {
    lineas.push(`_Solo procesé las primeras ${MAX_TAREAS_POR_MENSAJE} de ${operaciones.length}._`)
  }

  return lineas
}

/**
 * Interpreta un mensaje de texto libre con la IA y ejecuta lo que
 * corresponda. Nunca lanza — si la IA falla, se responde algo útil en vez de
 * dejar al usuario sin contestación, mismo criterio defensivo que el resto
 * del canal.
 */
export async function ejecutarConIA(userId: string, texto: string): Promise<ResultadoEjecucion> {
  try {
    const salida = await procesarMensajeTareas(userId, { texto })

    if (!salida.ok) {
      return { respuesta: 'No pude procesar eso ahora mismo. Inténtalo en un momento.', resultado: 'error', detalleError: salida.error }
    }

    const { result } = salida
    if (result.status !== 'success' || !result.output) {
      const detalle = result.status !== 'success' ? String(result.error?.message ?? result.status) : 'sin salida'
      return {
        respuesta: 'No entendí eso. Escribe *menú* para ver lo que puedo hacer.',
        resultado: 'error',
        detalleError: detalle,
      }
    }

    const operaciones = result.output.operaciones ?? []
    const lineas = operaciones.length > 0 ? await aplicarOperaciones(userId, operaciones) : []

    // `mensaje` es lo que el propio modelo redactó (respuestas
    // conversacionales, y también el resumen de notas/horario que
    // procesarMensajeTareas ya ejecutó del lado del servidor).
    const mensajeModelo = typeof result.output.mensaje === 'string' ? result.output.mensaje.trim() : ''
    const partes = [...lineas]
    if (mensajeModelo) partes.unshift(mensajeModelo)

    if (partes.length === 0) {
      return { respuesta: 'No entendí eso. Escribe *menú* para ver lo que puedo hacer.', resultado: 'no_reconocido' }
    }

    return { respuesta: partes.join('\n\n'), resultado: 'ejecutado' }
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error)
    console.error('[whatsapp/ia] excepción interpretando el mensaje:', detalle)
    return { respuesta: 'Algo falló al procesar tu mensaje. Inténtalo de nuevo.', resultado: 'error', detalleError: detalle }
  }
}
