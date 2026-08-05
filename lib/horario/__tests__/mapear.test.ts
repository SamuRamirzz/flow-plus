import { describe, expect, it } from 'vitest'
import { filaABloqueHorario, normalizarHora, type FilaHorario } from '../mapear'

describe('normalizarHora', () => {
  it('recorta los segundos que devuelve Postgres para una columna time', () => {
    expect(normalizarHora('07:00:00')).toBe('07:00')
  })

  it('deja intacta una hora que ya viene como HH:MM', () => {
    expect(normalizarHora('07:00')).toBe('07:00')
  })

  it('null sigue siendo null (un bloque puede no tener hora)', () => {
    expect(normalizarHora(null)).toBeNull()
  })

  it('una cadena vacía se trata como sin hora', () => {
    expect(normalizarHora('')).toBeNull()
  })

  it('no rompe con un valor inesperado: lo devuelve tal cual', () => {
    expect(normalizarHora('no es una hora')).toBe('no es una hora')
  })
})

describe('filaABloqueHorario', () => {
  const fila: FilaHorario = {
    id: 'b1',
    materia_id: 'mat-1',
    dia_semana: 1,
    hora_inicio: '07:00:00',
    hora_fin: '09:00:00',
    aula: 'A301',
    profesor: 'Ana Restrepo',
  }

  it('traduce snake_case a camelCase y normaliza las horas', () => {
    expect(filaABloqueHorario(fila)).toEqual({
      id: 'b1',
      materiaId: 'mat-1',
      diaSemana: 1,
      horaInicio: '07:00',
      horaFin: '09:00',
      aula: 'A301',
      profesor: 'Ana Restrepo',
    })
  })

  it('aula/profesor ausentes se mapean tal cual (null)', () => {
    const sinAulaNiProfesor = filaABloqueHorario({ ...fila, aula: null, profesor: null })
    expect(sinAulaNiProfesor.aula).toBeNull()
    expect(sinAulaNiProfesor.profesor).toBeNull()
  })

  it('un bloque sin horas se mapea con null, no con cadenas vacías', () => {
    const sinHoras = filaABloqueHorario({ ...fila, hora_inicio: null, hora_fin: null })
    expect(sinHoras.horaInicio).toBeNull()
    expect(sinHoras.horaFin).toBeNull()
  })

  // La razón de ser de normalizarHora: sin ella, reimportar la MISMA foto
  // reportaba 11 bloques "movidos" (07:00:00 vs 07:00) en vez de ninguno.
  it('una fila guardada y el mismo bloque leído de una foto quedan comparables', () => {
    const guardado = filaABloqueHorario(fila)
    const leidoDeLaFoto = { horaInicio: '07:00', horaFin: '09:00' }
    expect(guardado.horaInicio).toBe(leidoDeLaFoto.horaInicio)
    expect(guardado.horaFin).toBe(leidoDeLaFoto.horaFin)
  })
})
