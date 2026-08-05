import { describe, expect, it } from 'vitest'
import { bloquesDeCelda, construirFilas, diasVisibles, etiquetaFranja, franjasDeBloques, minutosDeHora, CLAVE_SIN_HORA } from '../grilla'
import type { BloqueHorario, DiaSemana } from '../tipos'

let n = 0
function bloque(dia: DiaSemana, horaInicio: string | null, horaFin: string | null, materiaId = 'mat-1'): BloqueHorario {
  return { id: `b${++n}`, materiaId, diaSemana: dia, horaInicio, horaFin, aula: null, profesor: null }
}

describe('minutosDeHora', () => {
  it('convierte HH:MM a minutos desde medianoche', () => {
    expect(minutosDeHora('07:30')).toBe(450)
    expect(minutosDeHora('00:00')).toBe(0)
  })

  it('null o formato inválido devuelve null', () => {
    expect(minutosDeHora(null)).toBeNull()
    expect(minutosDeHora('7:30')).toBeNull()
    expect(minutosDeHora('07:00:00')).toBeNull()
  })
})

describe('franjasDeBloques', () => {
  it('deduplica: el mismo tramo en días distintos es UNA sola franja', () => {
    const f = franjasDeBloques([bloque(1, '07:00', '09:00'), bloque(3, '07:00', '09:00'), bloque(5, '07:00', '09:00')])
    expect(f).toHaveLength(1)
    expect(f[0].horaInicio).toBe('07:00')
  })

  it('ordena las franjas por hora de inicio', () => {
    const f = franjasDeBloques([bloque(1, '14:00', '16:00'), bloque(1, '07:00', '09:00'), bloque(1, '09:00', '11:00')])
    expect(f.map((x) => x.horaInicio)).toEqual(['07:00', '09:00', '14:00'])
  })

  it('desempata por hora de fin cuando dos franjas empiezan igual', () => {
    const f = franjasDeBloques([bloque(1, '07:00', '10:00'), bloque(2, '07:00', '09:00')])
    expect(f.map((x) => x.horaFin)).toEqual(['09:00', '10:00'])
  })

  it('NO fusiona tramos que se solapan pero no son idénticos', () => {
    const f = franjasDeBloques([bloque(1, '07:00', '09:00'), bloque(2, '07:30', '09:30')])
    expect(f).toHaveLength(2)
  })

  it('los bloques sin hora quedan en una franja propia, siempre al final', () => {
    const f = franjasDeBloques([bloque(1, null, null), bloque(2, '07:00', '09:00')])
    expect(f).toHaveLength(2)
    expect(f[0].horaInicio).toBe('07:00')
    expect(f[1].clave).toBe(CLAVE_SIN_HORA)
  })

  it('sin bloques no hay franjas', () => {
    expect(franjasDeBloques([])).toEqual([])
  })
})

describe('construirFilas — huecos derivados', () => {
  it('intercala un hueco entre dos franjas separadas', () => {
    const filas = construirFilas([bloque(1, '07:00', '09:00'), bloque(1, '11:00', '13:00')])
    expect(filas.map((f) => f.tipo)).toEqual(['franja', 'hueco', 'franja'])
    const hueco = filas[1]
    expect(hueco.tipo === 'hueco' && hueco.horaInicio).toBe('09:00')
    expect(hueco.tipo === 'hueco' && hueco.horaFin).toBe('11:00')
  })

  it('NO intercala hueco entre franjas consecutivas sin espacio', () => {
    const filas = construirFilas([bloque(1, '07:00', '09:00'), bloque(1, '09:00', '11:00')])
    expect(filas.map((f) => f.tipo)).toEqual(['franja', 'franja'])
  })

  it('ignora huecos menores al mínimo (ruido entre tramos, no un descanso)', () => {
    const filas = construirFilas([bloque(1, '07:00', '08:55'), bloque(1, '09:00', '11:00')])
    expect(filas.map((f) => f.tipo)).toEqual(['franja', 'franja'])
  })

  it('un hueco de exactamente el mínimo sí cuenta', () => {
    const filas = construirFilas([bloque(1, '07:00', '08:50'), bloque(1, '09:00', '11:00')])
    expect(filas.map((f) => f.tipo)).toEqual(['franja', 'hueco', 'franja'])
  })

  it('no intenta calcular un hueco contra la franja "sin hora"', () => {
    const filas = construirFilas([bloque(1, '07:00', '09:00'), bloque(2, null, null)])
    expect(filas.map((f) => f.tipo)).toEqual(['franja', 'franja'])
  })

  it('cada fila tiene clave única (requisito de React)', () => {
    const filas = construirFilas([bloque(1, '07:00', '09:00'), bloque(1, '11:00', '13:00'), bloque(1, '15:00', '17:00')])
    const claves = filas.map((f) => f.clave)
    expect(new Set(claves).size).toBe(claves.length)
  })
})

describe('diasVisibles', () => {
  it('siempre muestra lunes a viernes, aunque no haya ninguna clase', () => {
    expect(diasVisibles([])).toEqual([1, 2, 3, 4, 5])
  })

  it('añade sábado solo si hay clase el sábado', () => {
    expect(diasVisibles([bloque(6, '08:00', '10:00')])).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('añade domingo manteniendo el orden de la semana', () => {
    expect(diasVisibles([bloque(7, '08:00', '10:00'), bloque(6, '08:00', '10:00')])).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('no duplica un día aunque tenga varias clases', () => {
    expect(diasVisibles([bloque(6, '08:00', '10:00'), bloque(6, '10:00', '12:00')])).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('bloquesDeCelda', () => {
  const lunes = bloque(1, '07:00', '09:00')
  const miercoles = bloque(3, '07:00', '09:00')
  const lunesTarde = bloque(1, '14:00', '16:00')
  const todos = [lunes, miercoles, lunesTarde]
  const franjaManana = franjasDeBloques(todos)[0]

  it('devuelve solo el bloque de ese día en esa franja', () => {
    expect(bloquesDeCelda(todos, 1, franjaManana).map((b) => b.id)).toEqual([lunes.id])
    expect(bloquesDeCelda(todos, 3, franjaManana).map((b) => b.id)).toEqual([miercoles.id])
  })

  it('una celda sin clase devuelve lista vacía', () => {
    expect(bloquesDeCelda(todos, 2, franjaManana)).toEqual([])
  })

  it('dos clases el mismo día en la misma franja devuelven ambas (choque de horario)', () => {
    const choque = bloque(1, '07:00', '09:00', 'mat-2')
    expect(bloquesDeCelda([...todos, choque], 1, franjaManana)).toHaveLength(2)
  })
})

describe('etiquetaFranja', () => {
  it('muestra el rango completo', () => {
    expect(etiquetaFranja({ horaInicio: '07:00', horaFin: '09:00', clave: 'x' })).toBe('07:00 – 09:00')
  })

  it('sin horas muestra "Sin hora"', () => {
    expect(etiquetaFranja({ horaInicio: null, horaFin: null, clave: CLAVE_SIN_HORA })).toBe('Sin hora')
  })

  it('con solo hora de inicio muestra esa', () => {
    expect(etiquetaFranja({ horaInicio: '07:00', horaFin: null, clave: 'x' })).toBe('07:00')
  })
})
