import { supabaseServer } from '@/lib/server/supabaseServer'
import { crearTareaServidor } from '@/lib/server/tareas'
import { crearNota } from '@/lib/server/notas'
import { cargarHorarioServidor } from '@/lib/server/horario'
import { proximaClaseHoy, proximasTareas } from '@/lib/estadisticas/pulso'
import { normalizar } from '@/lib/whatsapp/fechaNatural'
import { diaISODeFecha, lunesDeSemana, domingoDeSemana } from '@/lib/horario/dias'
import { hoyEnZona, horaEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import type { ComandoParseado } from '@/lib/whatsapp/parser'
import type { Materia, Tarea } from '@/lib/types'

// Sprint 2/3 — ejecutor de comandos de WhatsApp. IMPURO (hace I/O); toda la
// interpretación del texto ya ocurrió antes, en el parser puro.
//
// Reusa los MISMOS puntos de escritura que el resto de la app —
// `crearTareaServidor` (el mismo que usa POST /api/tareas desde que se
// extrajo en este sprint) y `crearNota` (el mismo que usan POST /api/notas
// y el agente de IA) — nunca un fetch HTTP interno ni una copia de la
// lógica de negocio. Lo mismo para leer: `proximaClaseHoy`/`proximasTareas`
// son las funciones puras que ya alimentan el pulso del día en Home, no una
// segunda definición de "qué es lo próximo".

const DIAS_NOMBRE: Record<number, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  7: 'domingo',
}

const NOMBRE_TIPO_BLOQUE: Record<string, string> = { ingreso: 'Ingreso', salida: 'Salida', descanso: 'Descanso' }

// WhatsApp soporta un subconjunto mínimo de formato: *negrita*, _cursiva_,
// ```mono```. Nada de markdown de encabezados ni tablas — por eso las
// respuestas se arman con líneas y guiones, no con la estructura de bloques
// que usa la pantalla /ai.
const AYUDA = [
  '*Comandos de Flow+*',
  '',
  '`/tarea` <título>, <materia>, <fecha>, <prioridad>',
  '   _Título y materia son obligatorios; fecha y prioridad, opcionales._',
  '   _El orden no importa: se reconocen solas._',
  '   Ej: /tarea Ensayo de historia, historia, mañana, alta',
  '',
  '`/completar` <parte del título>',
  '   _Marca una tarea como completada._',
  '',
  '`/tareas` [hoy|semana|todas]',
  '   _Lista tus pendientes. Sin argumento: hoy._',
  '',
  '`/horario` [hoy|mañana|lunes...domingo]',
  '   _Muestra tus bloques de ese día._',
  '',
  '`/nota` <tarea|materia|horario> <nombre>, <contenido>',
  '   _Guarda una nota asociada._',
  '',
  '`/proximo`',
  '   _Tu próxima clase o entrega._',
  '',
  '`/ayuda`',
  '   _Esta lista._',
].join('\n')

export type ResultadoEjecucion = {
  respuesta: string
  // Lo que se registra en whatsapp_comandos_log — 'no_reconocido' NO es un
  // error: el sistema funcionó bien, el usuario escribió algo que no es un
  // comando. Distinguirlos es justo lo que hace útil ese log.
  resultado: 'ejecutado' | 'error' | 'no_reconocido'
  detalleError?: string
}

function formatearFechaCorta(fechaISO: string | null): string {
  if (!fechaISO) return 'sin fecha'
  const [, mes, dia] = fechaISO.split('-')
  return `${dia}/${mes}`
}

function lineaTarea(t: Tarea, materias: Materia[]): string {
  const materia = materias.find((m) => m.id === t.materia_id)
  const nombre = materia ? ` _(${materia.nombre})_` : ''
  return `- ${t.titulo}${nombre} — ${formatearFechaCorta(t.fecha_entrega)}`
}

async function cargarMateriasYTareas(userId: string): Promise<{ materias: Materia[]; tareas: Tarea[] }> {
  const [{ data: materias }, { data: tareas }] = await Promise.all([
    supabaseServer.from('materias').select('*').eq('user_id', userId),
    supabaseServer.from('tareas').select('*').eq('user_id', userId).order('fecha_entrega', { nullsFirst: false }),
  ])
  return { materias: (materias ?? []) as Materia[], tareas: (tareas ?? []) as Tarea[] }
}

/**
 * Busca tareas pendientes cuyo título contenga el texto buscado.
 * Determinístico: coincidencia de subcadena sobre texto normalizado (sin
 * acentos ni mayúsculas), nunca una búsqueda semántica ni difusa — el canal
 * no puede usar un modelo para "entender" a cuál se refería.
 */
function buscarPendientes(tareas: Tarea[], busqueda: string): Tarea[] {
  const q = normalizar(busqueda)
  return tareas.filter((t) => !t.completada && normalizar(t.titulo).includes(q))
}

export async function ejecutarComando(userId: string, comando: ComandoParseado): Promise<ResultadoEjecucion> {
  // Zona horaria del usuario, no la del proceso — mismo criterio que el cron
  // de recordatorios y POST /api/tareas.
  const { data: perfil } = await supabaseServer
    .from('perfil_academico')
    .select('zona_horaria')
    .eq('user_id', userId)
    .maybeSingle()
  const zona = (perfil?.zona_horaria as string | undefined) ?? ZONA_HORARIA_POR_DEFECTO
  const hoy = hoyEnZona(new Date(), zona)

  switch (comando.tipo) {
    case 'ayuda':
      return { respuesta: AYUDA, resultado: 'ejecutado' }

    case 'crear_tarea': {
      // La materia es OBLIGATORIA para crear una tarea en este proyecto —
      // no es una regla de este canal, es la del propio `crearTareaSchema`
      // ("La tarea necesita una materia"), y este canal la respeta en vez
      // de intentar saltársela. Se comprueba ACÁ, antes de llamar, para
      // poder decir exactamente qué falta: dejar que fallara aguas abajo
      // devolvía un "intenta de nuevo en un momento" que sugiere un
      // problema pasajero cuando en realidad el mensaje estaba incompleto,
      // y el usuario lo reintentaría igual de incompleto para siempre.
      if (!comando.materia) {
        return {
          respuesta: 'Toda tarea necesita una materia. Ej: `/tarea Ensayo, mañana, historia`',
          resultado: 'no_reconocido',
        }
      }

      const resultado = await crearTareaServidor(userId, {
        titulo: comando.titulo,
        materiaId: null,
        nuevaMateria: comando.materia,
        fecha: comando.fecha,
        prioridad: comando.prioridad ?? 'media',
        fechaOrigen: 'usuario',
      })
      if (!resultado.ok) {
        // 400 = el mensaje del usuario tenía algo mal (y el texto de error
        // ya viene redactado para una persona); 500 = algo falló de verdad
        // del lado del servidor y reintentar sí tiene sentido.
        const esCulpaDelUsuario = resultado.status === 400
        return {
          respuesta: esCulpaDelUsuario ? resultado.error : 'No pude crear la tarea. Intenta de nuevo en un momento.',
          resultado: esCulpaDelUsuario ? 'no_reconocido' : 'error',
          detalleError: resultado.error,
        }
      }

      const t = resultado.tarea as unknown as Tarea
      const partes = [`✅ Tarea creada: *${t.titulo}*`]
      if (t.fecha_entrega) {
        // `fecha_inferida` la pone crearTareaServidor cuando la fecha salió
        // del horario y no del usuario — decírselo evita que crea que se
        // inventó una fecha.
        const inferida = resultado.fechaInferida.origen === 'inferida_horario'
        partes.push(`📅 ${formatearFechaCorta(t.fecha_entrega)}${inferida ? ' _(deducida de tu horario)_' : ''}`)
      } else {
        partes.push('📅 Sin fecha')
      }
      if (resultado.materiaCreada) partes.push(`📚 Materia nueva: ${resultado.materiaCreada.nombre}`)
      if (resultado.colisiones.length > 0) partes.push(`⚠️ Ese día ya tienes algo importante: ${resultado.colisiones[0].titulo}`)
      return { respuesta: partes.join('\n'), resultado: 'ejecutado' }
    }

    case 'completar_tarea': {
      const { tareas } = await cargarMateriasYTareas(userId)
      const candidatas = buscarPendientes(tareas, comando.busqueda)

      if (candidatas.length === 0) {
        return { respuesta: `No encontré ninguna tarea pendiente que diga "${comando.busqueda}".`, resultado: 'ejecutado' }
      }
      // Ambigüedad → NO se elige una al azar. Mismo criterio que
      // TaskManagementAgent con sus candidatos: preguntar antes que acertar
      // por suerte, porque completar la tarea equivocada es destructivo.
      if (candidatas.length > 1) {
        const lista = candidatas.slice(0, 5).map((t) => `- ${t.titulo}`).join('\n')
        return { respuesta: `Hay varias que coinciden — sé más específico:\n${lista}`, resultado: 'ejecutado' }
      }

      const tarea = candidatas[0]
      const { error } = await supabaseServer
        .from('tareas')
        .update({ completada: true, completada_en: new Date().toISOString() })
        .eq('id', tarea.id)
        .eq('user_id', userId)

      if (error) return { respuesta: 'No pude marcarla como completada.', resultado: 'error', detalleError: error.message }
      return { respuesta: `✅ Completada: *${tarea.titulo}*`, resultado: 'ejecutado' }
    }

    case 'listar_tareas': {
      const { materias, tareas } = await cargarMateriasYTareas(userId)
      const pendientes = tareas.filter((t) => !t.completada)

      let filtradas = pendientes
      let encabezado = 'Todas tus tareas pendientes'
      if (comando.rango === 'hoy') {
        filtradas = pendientes.filter((t) => t.fecha_entrega !== null && t.fecha_entrega <= hoy)
        encabezado = 'Para hoy'
      } else if (comando.rango === 'semana') {
        const desde = lunesDeSemana(hoy)
        const hasta = domingoDeSemana(hoy)
        filtradas = pendientes.filter((t) => t.fecha_entrega !== null && t.fecha_entrega >= desde && t.fecha_entrega <= hasta)
        encabezado = 'Esta semana'
      }

      if (filtradas.length === 0) {
        return { respuesta: `*${encabezado}*\n\nNada pendiente 🎉`, resultado: 'ejecutado' }
      }
      // Tope de 15: un mensaje de WhatsApp con 80 líneas es ilegible, y
      // "todas" puede ser un historial largo.
      const lineas = filtradas.slice(0, 15).map((t) => lineaTarea(t, materias))
      const extra = filtradas.length > 15 ? `\n\n_…y ${filtradas.length - 15} más._` : ''
      return { respuesta: `*${encabezado}* (${filtradas.length})\n\n${lineas.join('\n')}${extra}`, resultado: 'ejecutado' }
    }

    case 'ver_horario': {
      const [horario, { materias }] = await Promise.all([cargarHorarioServidor(userId), cargarMateriasYTareas(userId)])
      const dia = comando.dia ?? diaISODeFecha(hoy)
      const bloques = horario
        .filter((b) => b.diaSemana === dia)
        .sort((a, b) => (a.horaInicio ?? '').localeCompare(b.horaInicio ?? ''))

      if (bloques.length === 0) {
        return { respuesta: `*${DIAS_NOMBRE[dia]}*\n\nNo tienes nada agendado.`, resultado: 'ejecutado' }
      }

      const lineas = bloques.map((b) => {
        const nombre =
          b.tipo === 'clase'
            ? materias.find((m) => m.id === b.materiaId)?.nombre ?? 'Clase'
            : NOMBRE_TIPO_BLOQUE[b.tipo] ?? b.tipo
        const rango = b.horaInicio && b.horaFin ? `${b.horaInicio}–${b.horaFin}` : (b.horaInicio ?? '')
        return `- ${rango}  ${nombre}`
      })
      return { respuesta: `*${DIAS_NOMBRE[dia]}*\n\n${lineas.join('\n')}`, resultado: 'ejecutado' }
    }

    case 'proximo_evento': {
      const [horario, { materias, tareas }] = await Promise.all([cargarHorarioServidor(userId), cargarMateriasYTareas(userId)])
      const hora = horaEnZona(new Date(), zona)
      const clase = proximaClaseHoy(horario, materias, hoy, hora)
      const siguientes = proximasTareas(tareas.filter((t) => !t.completada), materias, hoy, 1)

      const partes: string[] = []
      if (clase) partes.push(`📚 *${clase.materiaNombre}* en ${clase.minutosHasta} min${clase.bloque.aula ? ` — ${clase.bloque.aula}` : ''}`)
      if (siguientes.length > 0) {
        const t = siguientes[0].tarea
        partes.push(`📝 *${t.titulo}* — ${formatearFechaCorta(t.fecha_entrega)}`)
      }
      if (partes.length === 0) return { respuesta: 'Nada próximo por ahora 🎉', resultado: 'ejecutado' }
      return { respuesta: partes.join('\n'), resultado: 'ejecutado' }
    }

    case 'crear_nota': {
      const { materias, tareas } = await cargarMateriasYTareas(userId)
      const q = normalizar(comando.nombre)

      if (comando.contexto === 'materia') {
        const encontradas = materias.filter((m) => normalizar(m.nombre).includes(q))
        if (encontradas.length === 0) return { respuesta: `No encontré la materia "${comando.nombre}".`, resultado: 'ejecutado' }
        if (encontradas.length > 1) return { respuesta: `Hay varias materias que coinciden con "${comando.nombre}" — sé más específico.`, resultado: 'ejecutado' }
        const r = await crearNota(userId, {
          titulo: null,
          contenido: comando.contenido,
          tareaId: null,
          bloqueHorarioId: null,
          materiaId: encontradas[0].id,
          creadoPor: 'usuario',
        })
        if (!r.ok) return { respuesta: 'No pude guardar la nota.', resultado: 'error', detalleError: r.error }
        return { respuesta: `📝 Nota guardada en *${encontradas[0].nombre}*`, resultado: 'ejecutado' }
      }

      if (comando.contexto === 'tarea') {
        const encontradas = tareas.filter((t) => normalizar(t.titulo).includes(q))
        if (encontradas.length === 0) return { respuesta: `No encontré la tarea "${comando.nombre}".`, resultado: 'ejecutado' }
        if (encontradas.length > 1) return { respuesta: `Hay varias tareas que coinciden con "${comando.nombre}" — sé más específico.`, resultado: 'ejecutado' }
        const r = await crearNota(userId, {
          titulo: null,
          contenido: comando.contenido,
          tareaId: encontradas[0].id,
          bloqueHorarioId: null,
          creadoPor: 'usuario',
        })
        if (!r.ok) return { respuesta: 'No pude guardar la nota.', resultado: 'error', detalleError: r.error }
        return { respuesta: `📝 Nota guardada en *${encontradas[0].titulo}*`, resultado: 'ejecutado' }
      }

      // contexto === 'horario' — se resuelve contra bloques de clase por el
      // nombre de su materia, que es como el usuario los llama.
      const horario = await cargarHorarioServidor(userId)
      const candidatos = horario.filter((b) => {
        const nombre = b.tipo === 'clase' ? materias.find((m) => m.id === b.materiaId)?.nombre ?? '' : NOMBRE_TIPO_BLOQUE[b.tipo] ?? b.tipo
        return normalizar(nombre).includes(q)
      })
      if (candidatos.length === 0) return { respuesta: `No encontré ningún bloque de horario para "${comando.nombre}".`, resultado: 'ejecutado' }
      if (candidatos.length > 1) {
        const lista = candidatos.slice(0, 5).map((b) => `- ${DIAS_NOMBRE[b.diaSemana]} ${b.horaInicio ?? ''}`).join('\n')
        return { respuesta: `Ese bloque está en varios días — dime cuál:\n${lista}`, resultado: 'ejecutado' }
      }
      const r = await crearNota(userId, {
        titulo: null,
        contenido: comando.contenido,
        tareaId: null,
        bloqueHorarioId: candidatos[0].id,
        creadoPor: 'usuario',
      })
      if (!r.ok) return { respuesta: 'No pude guardar la nota.', resultado: 'error', detalleError: r.error }
      return { respuesta: `📝 Nota guardada en tu bloque de ${DIAS_NOMBRE[candidatos[0].diaSemana]}`, resultado: 'ejecutado' }
    }

    case 'no_reconocido': {
      // Parte D.6 — nunca un error críptico ni un silencio. El motivo que
      // trae el parser permite decirle algo útil en vez de la misma frase
      // genérica para dos problemas distintos.
      if (comando.motivo === 'faltan_datos') {
        return { respuesta: 'Ese comando existe, pero le faltan datos. Escribe */ayuda* para ver el formato exacto.', resultado: 'no_reconocido' }
      }
      return { respuesta: 'No reconocí ese comando. Escribe */ayuda* para ver los comandos disponibles.', resultado: 'no_reconocido' }
    }
  }
}
