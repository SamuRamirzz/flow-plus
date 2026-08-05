import { diasEntre } from '@/lib/horario/dias'
import type {
  ColisionDetectada,
  DecisionAutonomia,
  OrigenFecha,
  ResultadoPlausibilidad,
  TareaExistenteParaColision,
  TareaNuevaParaColision,
} from './types'

// PURO — sin I/O, sin new Date() (todo lo temporal se inyecta, misma
// disciplina que lib/horario/{dias,inferirFecha}.ts). El documento de
// arquitectura le asigna el modelo barato a este agente para "redactar el
// título final y detectar duplicados semánticos"; plausibilidad y colisión
// son enteramente determinísticas y no necesitan ninguna llamada — cero
// tokens, cero latencia. La mitad con modelo (dedup semántico tipo "Lab de
// Química" vs "Laboratorio Química") queda para un sprint futuro.

// Margen antes de considerar "pasada" una fecha. No es arbitrario: el
// servidor resuelve "hoy" en la zona del usuario (hoyEnZona), pero entre
// que el cliente arma el payload y el servidor lo procesa puede cruzarse la
// medianoche, y una tarea propuesta para "hoy" llegaría como "ayer". Un día
// de tolerancia absorbe ese borde sin dejar pasar un error real de año.
const MARGEN_PASADO_DIAS = 1

// Más allá de esto, una fecha casi siempre es un año mal leído ("2026" →
// "2062") y no un plan real: una agenda académica no programa entregas a
// dos años vista. Se cuenta en días (2×365) en vez de comparar años
// calendario — el desfase de un bisiesto es irrelevante para un umbral
// cuyo propósito es detectar algo absurdo, no medir con precisión.
const LIMITE_FUTURO_DIAS = 2 * 365

// Dos reglas con alcances distintos a propósito:
//
// 1. FUTURO ABSURDO — se cuestiona venga de donde venga, incluido el
//    usuario. Un año tecleado de más en el selector de fecha es tan
//    plausible como un año mal leído por el modelo, y en ninguno de los dos
//    casos existe la lectura benigna que sí tiene una fecha pasada ("ya lo
//    entregué, lo registro igual"). Como esto nunca bloquea (viaja como
//    aviso), avisar de más acá cuesta poco y atrapa el error más caro.
//
// 2. PASADO — solo se cuestiona con origen 'explicita_ia' (el modelo la
//    leyó de un texto o una foto: pudo malinterpretar el año, o resolver
//    "el viernes" contra la fecha de referencia equivocada). Las otras tres
//    procedencias no se cuestionan, y no por descuido:
//    - 'explicita_usuario': la eligió a propósito — "sé que ya pasó, quiero
//      registrarla igual" es un caso legítimo. Cuestionar una elección
//      deliberada sería paternalista.
//    - 'inferida_horario': inferirFechaEntrega ya garantiza por
//      construcción que nunca devuelve una fecha anterior a "hoy" (regla 6
//      documentada ahí) — repetir el chequeo sería redundante.
//    - 'sin_fecha': no hay fecha que evaluar.
export function esFechaPlausible(fecha: string | null, hoy: string, origen: OrigenFecha): ResultadoPlausibilidad {
  if (!fecha) return { valida: true, motivo: null }

  // Negativo = la fecha quedó en el pasado respecto de `hoy`.
  const dias = diasEntre(hoy, fecha)

  if (dias > LIMITE_FUTURO_DIAS) {
    return { valida: false, motivo: 'Esa fecha está a más de dos años — revisa si el año se escribió bien antes de guardarla.' }
  }

  if (origen !== 'explicita_ia') return { valida: true, motivo: null }

  if (dias < -MARGEN_PASADO_DIAS) {
    return { valida: false, motivo: 'Esa fecha ya pasó — revisa si el día o el año se leyeron bien antes de guardarla.' }
  }

  return { valida: true, motivo: null }
}

// Colisión NO es "hay otra tarea ese día" — eso sería ruido constante en
// cualquier agenda con más de una materia. Solo cuenta cuando ambas
// comparten una señal de "esto pesa": las dos son prioridad alta, o las
// dos son un examen. Un choque de prioridad alta se reporta aunque los
// tipos difieran (una entrega importante y un examen importante el mismo
// día siguen siendo un choque real); un choque de "dos exámenes" se
// reporta aparte para cuando ninguna es alta pero el tipo ya lo delata.
//
// Al MODIFICAR, `tareaNueva.id` es el de la tarea que se está moviendo y
// esa fila sigue estando en la base con su fecha vieja — sin excluirla,
// mover una tarea "alta" a un día donde ya estaba ella misma la reportaría
// chocando consigo misma. Se filtra acá dentro (no solo en la consulta del
// llamador) para que la función sea correcta por sí sola: quien la use
// desde otro punto no puede olvidarse del caso.
export function detectarColisiones(tareaNueva: TareaNuevaParaColision, existentes: TareaExistenteParaColision[]): ColisionDetectada[] {
  if (!tareaNueva.fecha) return []

  const colisiones: ColisionDetectada[] = []
  for (const existente of existentes) {
    if (tareaNueva.id !== undefined && existente.id === tareaNueva.id) continue
    if (existente.fecha !== tareaNueva.fecha) continue

    if (tareaNueva.prioridad === 'alta' && existente.prioridad === 'alta') {
      colisiones.push({ tareaId: existente.id, titulo: existente.titulo, motivo: 'Las dos son de prioridad alta este día' })
      continue
    }
    if (tareaNueva.tipo === 'examen' && existente.tipo === 'examen') {
      colisiones.push({ tareaId: existente.id, titulo: existente.titulo, motivo: 'Ya tienes otro examen este día' })
    }
  }
  return colisiones
}

// Hasta el cierre de Fase 1, ningún agente de esta carpeta llamaba a un
// modelo, así que nada le pasaba una `confianza` real — todo llamador usaba
// `null`, que siempre resuelve 'autonomo' (documentado explícitamente, no
// era un olvido: sin una señal de confianza real, bloquear por "baja
// confianza" sería inventar un motivo). Ahora sí hay un llamador real: el
// dedup semántico de materias (dedup.ts) le pasa la confianza que devuelve
// CalendarAgent, y el resultado decide cuán insistente se ve el aviso de
// posible duplicado (ver resolverAvisoDedup en dedup.ts).
export function decidirAutonomia(confianza: number | null, umbral: number): DecisionAutonomia {
  if (confianza === null) return 'autonomo'
  return confianza < umbral ? 'requiere_revision' : 'autonomo'
}
