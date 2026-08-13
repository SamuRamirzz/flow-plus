import { textoPorcentaje } from './formato'
import type { DatosInforme } from './tipos'

// Sprint 18a — PURO. El texto de "Puntos clave" cuando la IA no está
// disponible, falla, tarda, o su respuesta no pasa la validación numérica.
//
// Sus cifras son, POR CONSTRUCCIÓN, siempre las de los datos: se leen del
// propio `DatosInforme`. Es lo que hace seguro descartar por completo una
// respuesta sospechosa del modelo en vez de intentar corregirla.

const NOMBRE_PERIODO: Record<DatosInforme['periodo'], string> = {
  semanal: 'Esta semana',
  mensual: 'Este mes',
  anual: 'Este año',
}

export function puntosClaveFallback(datos: DatosInforme): string[] {
  const frases: string[] = []
  const cuando = NOMBRE_PERIODO[datos.periodo]

  // Caso honesto: no hay nada que interpretar. Mejor decirlo que rellenar con
  // positividad vacía.
  if (datos.actual.total === 0) {
    frases.push(`${cuando} no tenías tareas con fecha de entrega registradas en Flow+.`)
    if (datos.actividad.archivosSubidos > 0 || datos.actividad.notasCreadas > 0) {
      frases.push(
        `Aun así hubo actividad: ${datos.actividad.archivosSubidos} archivo(s) y ${datos.actividad.notasCreadas} nota(s).`
      )
    } else {
      frases.push('A medida que registres tareas, este informe irá mostrando tu progreso real.')
    }
    return frases
  }

  frases.push(
    `${cuando} completaste ${datos.actual.completadas} de ${datos.actual.total} tareas (${textoPorcentaje(datos.actual.porcentaje)}).`
  )

  const comp = datos.comparacion.completadas
  if (comp.comparable && comp.direccion !== 'igual') {
    const verbo = comp.direccion === 'sube' ? 'mejor' : 'menos'
    frases.push(`Eso es ${Math.abs(comp.delta)} puntos ${verbo} que ${datos.etiquetaPeriodoPrevio}.`)
  } else if (!comp.comparable) {
    frases.push('Es tu primer periodo con datos, así que todavía no hay con qué compararlo.')
  }

  if (datos.actual.porcentajePuntualidad !== null) {
    frases.push(`De lo que entregaste, ${textoPorcentaje(datos.actual.porcentajePuntualidad)} llegó a tiempo.`)
  }

  const mejor = [...datos.materias]
    .filter((m) => m.total > 0)
    .sort((a, b) => b.completadas / b.total - a.completadas / a.total)[0]
  if (mejor && mejor.completadas > 0) {
    frases.push(`Tu materia con mejor cumplimiento fue ${mejor.nombre}.`)
  }

  return frases.slice(0, 4)
}
