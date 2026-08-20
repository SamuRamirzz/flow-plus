import { normalizar, resolverFechaNatural, diaSemanaDeTexto } from './fechaNatural'
import { diaISODeFecha } from '@/lib/horario/dias'
import type { DiaSemana } from '@/lib/horario/tipos'

// Sprint 2/3 — parser de comandos de WhatsApp. PURO y 100%
// DETERMINÍSTICO: cero llamadas a Gemini en la ruta de interpretación.
//
// Esto no es una preferencia de estilo, es el requisito legal del canal:
// la política de Meta vigente desde el 15/01/2026 prohíbe los chatbots de
// IA de propósito general sobre la WhatsApp Business Platform, pero
// permite explícitamente la automatización estructurada de tareas de
// negocio. Un parser de reglas fijas cae del lado permitido; mandarle el
// texto libre a un LLM para que "entienda" qué quiso decir el usuario,
// no. Gemini sigue usándose sin restricción en el resto de la app (/ai),
// solo no acá.
//
// `hoy` entra inyectado (no `new Date()`) por dos motivos que apuntan al
// mismo sitio: la disciplina de pureza del proyecto, y que la fecha real
// del usuario depende de SU zona horaria (perfil_academico.zona_horaria),
// que el servidor resuelve con hoyEnZona() antes de llamar acá. Por eso
// la firma tiene un parámetro más que la del encargo original.

export type Prioridad = 'baja' | 'media' | 'alta'
export type RangoTareas = 'hoy' | 'semana' | 'todas'
export type ContextoNota = 'tarea' | 'materia' | 'horario'

export type ComandoParseado =
  | { tipo: 'crear_tarea'; titulo: string; fecha: string | null; materia: string | null; prioridad: Prioridad | null }
  | { tipo: 'completar_tarea'; busqueda: string }
  | { tipo: 'listar_tareas'; rango: RangoTareas }
  // `dia: null` significa hoy; un número ISO es un día concreto de la semana.
  | { tipo: 'ver_horario'; dia: DiaSemana | null }
  | { tipo: 'crear_nota'; contexto: ContextoNota; nombre: string; contenido: string }
  | { tipo: 'proximo_evento' }
  | { tipo: 'ayuda' }
  // `motivo` distingue "no empieza por /" de "es un comando que existe
  // pero le faltan datos" — sin esto, `/tarea` a secas y "hola" darían la
  // misma respuesta, y al usuario le sirve MUCHO más saber que el comando
  // era correcto pero incompleto.
  | { tipo: 'no_reconocido'; mensajeOriginal: string; motivo: 'sin_comando' | 'comando_desconocido' | 'faltan_datos' }

const PRIORIDADES: Prioridad[] = ['baja', 'media', 'alta']

function comoPrioridad(texto: string): Prioridad | null {
  const t = normalizar(texto)
  return (PRIORIDADES as string[]).includes(t) ? (t as Prioridad) : null
}

// Los argumentos de /tarea después del título se clasifican por VOCABULARIO
// CERRADO, no por posición: lo que resuelve a fecha es fecha, lo que es
// exactamente baja/media/alta es prioridad, y lo que sobra es materia. Es
// más tolerante que un orden estricto (`/tarea Ensayo, alta` funciona sin
// fecha) y sigue siendo determinístico: no hay ninguna heurística de
// "parece una materia", solo dos conjuntos cerrados y un resto.
function clasificarArgumentos(
  partes: string[],
  hoy: string
): { fecha: string | null; materia: string | null; prioridad: Prioridad | null } {
  let fecha: string | null = null
  let materia: string | null = null
  let prioridad: Prioridad | null = null

  for (const parte of partes) {
    const limpia = parte.trim()
    if (limpia.length === 0) continue

    const p = comoPrioridad(limpia)
    if (p !== null && prioridad === null) {
      prioridad = p
      continue
    }
    const f = resolverFechaNatural(limpia, hoy)
    if (f !== null && fecha === null) {
      fecha = f
      continue
    }
    // Primer texto que no es ni fecha ni prioridad. Solo el primero: un
    // segundo sobrante se ignora en vez de concatenarse, para no fabricar
    // un nombre de materia que el usuario no escribió.
    if (materia === null) materia = limpia
  }

  return { fecha, materia, prioridad }
}

const RANGOS: Record<string, RangoTareas> = { hoy: 'hoy', semana: 'semana', todas: 'todas' }
const CONTEXTOS_NOTA: Record<string, ContextoNota> = { tarea: 'tarea', materia: 'materia', horario: 'horario' }

/**
 * Texto crudo de un mensaje de WhatsApp → comando estructurado.
 *
 * Nunca lanza y nunca fuerza una interpretación: si el formato no calza
 * con un patrón conocido, devuelve `no_reconocido` con el motivo, y el
 * ejecutor responde con una pista concreta (ver Parte D.6 del encargo).
 */
export function parsearComando(texto: string, hoy: string): ComandoParseado {
  const crudo = texto.trim()
  if (!crudo.startsWith('/')) {
    return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'sin_comando' }
  }

  // Se separa el comando del resto por el primer espacio; el resto se
  // conserva CRUDO (sin normalizar) porque es contenido del usuario —
  // normalizar acá le quitaría acentos y mayúsculas al título de la tarea
  // o al cuerpo de la nota, que se guardan tal como los escribió.
  const primerEspacio = crudo.indexOf(' ')
  const comando = normalizar(primerEspacio === -1 ? crudo : crudo.slice(0, primerEspacio)).replace(/^\//, '')
  const resto = primerEspacio === -1 ? '' : crudo.slice(primerEspacio + 1).trim()

  switch (comando) {
    case 'tarea': {
      if (resto.length === 0) return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'faltan_datos' }
      const [tituloCrudo, ...argumentos] = resto.split(',')
      const titulo = tituloCrudo.trim()
      if (titulo.length === 0) return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'faltan_datos' }
      return { tipo: 'crear_tarea', titulo, ...clasificarArgumentos(argumentos, hoy) }
    }

    case 'completar': {
      if (resto.length === 0) return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'faltan_datos' }
      return { tipo: 'completar_tarea', busqueda: resto }
    }

    case 'tareas': {
      // Sin argumento → 'hoy', el default que fija el encargo. Un
      // argumento que no es un rango conocido NO cae a 'hoy' en silencio:
      // "/tareas mes" es un malentendido real del usuario, y responderle
      // con las de hoy como si nada le ocultaría que ese rango no existe.
      if (resto.length === 0) return { tipo: 'listar_tareas', rango: 'hoy' }
      const rango = RANGOS[normalizar(resto)]
      if (rango === undefined) return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'faltan_datos' }
      return { tipo: 'listar_tareas', rango }
    }

    case 'horario': {
      if (resto.length === 0) return { tipo: 'ver_horario', dia: null }
      const t = normalizar(resto)
      if (t === 'hoy') return { tipo: 'ver_horario', dia: null }
      const dia = diaSemanaDeTexto(resto)
      if (dia !== null) return { tipo: 'ver_horario', dia }
      // "mañana" (y cualquier otra fecha reconocible) se convierte al día
      // de la semana que le toca, reusando `diaISODeFecha` de
      // lib/horario/dias.ts — el ejecutor recibe siempre un día ISO y no
      // necesita una rama propia para fechas relativas.
      const fecha = resolverFechaNatural(resto, hoy)
      if (fecha !== null) return { tipo: 'ver_horario', dia: diaISODeFecha(fecha) }
      return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'faltan_datos' }
    }

    case 'nota': {
      // Sintaxis: /nota <contexto> <nombre>, <contenido>
      const separador = resto.indexOf(',')
      if (separador === -1) return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'faltan_datos' }
      const cabecera = resto.slice(0, separador).trim()
      const contenido = resto.slice(separador + 1).trim()
      if (contenido.length === 0) return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'faltan_datos' }

      const espacio = cabecera.indexOf(' ')
      if (espacio === -1) return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'faltan_datos' }
      const contexto = CONTEXTOS_NOTA[normalizar(cabecera.slice(0, espacio))]
      const nombre = cabecera.slice(espacio + 1).trim()
      if (contexto === undefined || nombre.length === 0) {
        return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'faltan_datos' }
      }
      return { tipo: 'crear_nota', contexto, nombre, contenido }
    }

    case 'proximo':
      return { tipo: 'proximo_evento' }

    case 'ayuda':
      return { tipo: 'ayuda' }

    default:
      return { tipo: 'no_reconocido', mensajeOriginal: texto, motivo: 'comando_desconocido' }
  }
}
