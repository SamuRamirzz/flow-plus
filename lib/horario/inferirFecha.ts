import type { BloqueHorario, DiaSemana } from './tipos'
import { diasHastaProximo, siguienteOcurrencia } from './dias'

export type OrigenFecha = 'explicita_usuario' | 'explicita_ia' | 'inferida_horario' | 'sin_fecha'

export type FechaInferida = {
  fecha: string | null // YYYY-MM-DD
  origen: OrigenFecha
  motivo: string | null // español, para mostrar en la UI sin tener que re-derivarlo
  bloqueUsadoId: string | null
}

const NOMBRE_DIA: Record<DiaSemana, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábados',
  7: 'domingos',
}

// PURO: cero I/O, cero new Date() — `hoy` siempre llega inyectado. No
// recibe el nombre de la materia (solo su id): quien llama ya sabe qué
// materia tiene seleccionada, así que el motivo no la repite.
//
// Reglas, en orden — cada una es su propio caso en __tests__/inferirFecha.test.ts:
//   1. fechaExplicita no vacía → se devuelve verbatim, SIEMPRE. Nunca se
//      pisa una fecha que ya puso el usuario o que ya propuso la IA.
//   2. Sin materiaId → sin_fecha. Nunca se adivina sin materia.
//   3. Materia sin bloques de horario → sin_fecha.
//   4. Un bloque → la próxima ocurrencia de ese día.
//   5. Varios bloques → el más próximo (menor delta de días); empate por
//      horaInicio y luego por id, para que el resultado sea determinista.
//   6. Nunca devuelve una fecha anterior a `hoy`.
export function inferirFechaEntrega(input: {
  fechaExplicita: string | null
  origenExplicita: 'usuario' | 'ia'
  materiaId: string | null
  horario: BloqueHorario[]
  hoy: string
  incluirHoy?: boolean
}): FechaInferida {
  if (input.fechaExplicita) {
    return {
      fecha: input.fechaExplicita,
      origen: input.origenExplicita === 'usuario' ? 'explicita_usuario' : 'explicita_ia',
      motivo: null,
      bloqueUsadoId: null,
    }
  }

  if (!input.materiaId) {
    return { fecha: null, origen: 'sin_fecha', motivo: null, bloqueUsadoId: null }
  }

  const bloques = input.horario.filter((b) => b.materiaId === input.materiaId)
  if (bloques.length === 0) {
    return { fecha: null, origen: 'sin_fecha', motivo: null, bloqueUsadoId: null }
  }

  const incluirHoy = input.incluirHoy ?? false

  const conDelta = bloques
    .map((bloque) => ({ bloque, delta: diasHastaProximo(input.hoy, bloque.diaSemana, incluirHoy) }))
    .sort((a, b) => {
      if (a.delta !== b.delta) return a.delta - b.delta
      const horaA = a.bloque.horaInicio ?? '99:99'
      const horaB = b.bloque.horaInicio ?? '99:99'
      if (horaA !== horaB) return horaA < horaB ? -1 : 1
      return a.bloque.id < b.bloque.id ? -1 : a.bloque.id > b.bloque.id ? 1 : 0
    })

  const elegido = conDelta[0].bloque
  const fecha = siguienteOcurrencia(input.hoy, elegido.diaSemana, incluirHoy)

  return {
    fecha,
    origen: 'inferida_horario',
    motivo: `Se dicta los ${NOMBRE_DIA[elegido.diaSemana]}`,
    bloqueUsadoId: elegido.id,
  }
}
