import { describe, expect, it } from 'vitest'
import { decidirNotificar } from '../gate'
import type { CandidatoNotificacion } from '../types'

function candidato(overrides: Partial<CandidatoNotificacion> = {}): CandidatoNotificacion {
  return { tareaId: 't1', urgencia: 'media', tipo: 'otro', ...overrides }
}

describe('decidirNotificar — no redundancia', () => {
  it('un candidato sin fila previa se aprueba', () => {
    const r = decidirNotificar([candidato({ tareaId: 'a' })], [], 3)
    expect(r).toEqual([{ tareaId: 'a', agrupar: false }])
  })

  it('un candidato con fila previa EXACTA (mismo tareaId + tipo) se bloquea', () => {
    const r = decidirNotificar([candidato({ tareaId: 'a', tipo: 'examen' })], [{ tareaId: 'a', tipo: 'examen' }], 3)
    expect(r).toEqual([])
  })

  it('mismo tareaId pero DISTINTO tipo no cuenta como redundante (el tipo de la tarea cambió)', () => {
    const r = decidirNotificar([candidato({ tareaId: 'a', tipo: 'examen' })], [{ tareaId: 'a', tipo: 'otro' }], 3)
    expect(r).toEqual([{ tareaId: 'a', agrupar: false }])
  })

  it('correr dos veces con la MISMA yaEnviadas (simula 2da corrida del cron el mismo día) da resultado vacío la segunda vez', () => {
    const candidatos = [candidato({ tareaId: 'a' }), candidato({ tareaId: 'b' })]
    const primeraCorrida = decidirNotificar(candidatos, [], 3)
    expect(primeraCorrida.map((d) => d.tareaId).sort()).toEqual(['a', 'b'])

    // La segunda corrida ve lo que la primera ya insertó.
    const yaEnviadasTrasPrimera = candidatos.map((c) => ({ tareaId: c.tareaId, tipo: c.tipo }))
    const segundaCorrida = decidirNotificar(candidatos, yaEnviadasTrasPrimera, 3)
    expect(segundaCorrida).toEqual([])
  })
})

describe('decidirNotificar — tope diario', () => {
  it('menos candidatos que el tope: todos pasan', () => {
    const r = decidirNotificar([candidato({ tareaId: 'a' }), candidato({ tareaId: 'b' })], [], 3)
    expect(r).toHaveLength(2)
  })

  it('más candidatos que el tope: prioriza por urgencia (alta > media > baja)', () => {
    const candidatos = [
      candidato({ tareaId: 'baja1', urgencia: 'baja' }),
      candidato({ tareaId: 'alta1', urgencia: 'alta' }),
      candidato({ tareaId: 'media1', urgencia: 'media' }),
      candidato({ tareaId: 'alta2', urgencia: 'alta' }),
    ]
    const r = decidirNotificar(candidatos, [], 2)
    expect(r.map((d) => d.tareaId).sort()).toEqual(['alta1', 'alta2'])
  })

  it('desempate entre candidatos de la MISMA urgencia: por tareaId alfabético, estable', () => {
    const candidatos = [
      candidato({ tareaId: 'zebra', urgencia: 'alta' }),
      candidato({ tareaId: 'alfa', urgencia: 'alta' }),
      candidato({ tareaId: 'medio', urgencia: 'alta' }),
    ]
    const r1 = decidirNotificar(candidatos, [], 2)
    const r2 = decidirNotificar(candidatos, [], 2)
    expect(r1.map((d) => d.tareaId)).toEqual(['alfa', 'medio']) // alfabético
    expect(r2.map((d) => d.tareaId)).toEqual(r1.map((d) => d.tareaId)) // estable
  })

  it('el cupo restante descuenta lo ya enviado HOY por una corrida anterior', () => {
    // maxPorDia=3, ya se mandaron 2 hoy → solo queda cupo para 1 más.
    const yaEnviadas = [
      { tareaId: 'x', tipo: 'otro' },
      { tareaId: 'y', tipo: 'otro' },
    ]
    const candidatos = [candidato({ tareaId: 'a', urgencia: 'alta' }), candidato({ tareaId: 'b', urgencia: 'alta' })]
    const r = decidirNotificar(candidatos, yaEnviadas, 3)
    expect(r).toHaveLength(1)
  })

  it('cupo agotado (ya se llegó al tope hoy): ningún candidato nuevo pasa, aunque sea urgencia alta', () => {
    const yaEnviadas = [
      { tareaId: 'x', tipo: 'otro' },
      { tareaId: 'y', tipo: 'otro' },
      { tareaId: 'z', tipo: 'otro' },
    ]
    const r = decidirNotificar([candidato({ tareaId: 'nueva', urgencia: 'alta' })], yaEnviadas, 3)
    expect(r).toEqual([])
  })

  it('maxPorDia=0 nunca aprueba nada', () => {
    const r = decidirNotificar([candidato({ tareaId: 'a', urgencia: 'alta' })], [], 0)
    expect(r).toEqual([])
  })

  it('lista de candidatos vacía nunca aprueba nada', () => {
    expect(decidirNotificar([], [], 3)).toEqual([])
  })
})

describe('decidirNotificar — agrupación', () => {
  it('un solo candidato aprobado: agrupar=false', () => {
    const r = decidirNotificar([candidato({ tareaId: 'a' })], [], 3)
    expect(r).toEqual([{ tareaId: 'a', agrupar: false }])
  })

  it('dos o más candidatos aprobados en la misma corrida: agrupar=true para TODOS', () => {
    const r = decidirNotificar([candidato({ tareaId: 'a' }), candidato({ tareaId: 'b' }), candidato({ tareaId: 'c' })], [], 3)
    expect(r).toHaveLength(3)
    expect(r.every((d) => d.agrupar)).toBe(true)
  })

  it('agrupar se decide sobre los APROBADOS, no sobre los candidatos totales — si el tope recorta a 1, agrupar=false', () => {
    const candidatos = [candidato({ tareaId: 'a', urgencia: 'alta' }), candidato({ tareaId: 'b', urgencia: 'baja' })]
    const r = decidirNotificar(candidatos, [], 1)
    expect(r).toEqual([{ tareaId: 'a', agrupar: false }])
  })
})
