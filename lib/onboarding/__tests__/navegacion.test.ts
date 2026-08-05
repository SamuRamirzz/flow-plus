import { describe, it, expect } from 'vitest'
import {
  estadoInicial,
  irA,
  siguiente,
  anterior,
  esUltimo,
  esPrimero,
  pasoPorSwipe,
  UMBRAL_DISTANCIA_PX,
  UMBRAL_VELOCIDAD,
} from '../navegacion'

const TOTAL = 5

describe('estado del carrusel', () => {
  it('arranca en el primer paso, mirando hacia adelante', () => {
    expect(estadoInicial()).toEqual({ paso: 0, direccion: 1 })
  })

  it('avanza y retrocede registrando la dirección — la animación depende de ella', () => {
    const uno = siguiente(estadoInicial(), TOTAL)
    expect(uno).toEqual({ paso: 1, direccion: 1 })
    expect(anterior(uno, TOTAL)).toEqual({ paso: 0, direccion: -1 })
  })

  it('NO es circular: el último paso no vuelve al primero', () => {
    // Deliberado: un carrusel de onboarding que da la vuelta hace creer que
    // la experiencia no termina nunca, justo cuando se espera la salida.
    const ultimo = irA(estadoInicial(), TOTAL - 1, TOTAL)
    expect(siguiente(ultimo, TOTAL)).toBe(ultimo)
    expect(siguiente(ultimo, TOTAL).paso).toBe(TOTAL - 1)
  })

  it('no retrocede antes del primero', () => {
    const primero = estadoInicial()
    expect(anterior(primero, TOTAL)).toBe(primero)
  })

  it('acota un destino fuera de rango en vez de romperse', () => {
    expect(irA(estadoInicial(), 99, TOTAL).paso).toBe(TOTAL - 1)
    expect(irA(irA(estadoInicial(), 3, TOTAL), -7, TOTAL).paso).toBe(0)
  })

  it('ir al paso en el que ya estás no cambia nada (ni la dirección)', () => {
    const dos = irA(estadoInicial(), 2, TOTAL)
    expect(irA(dos, 2, TOTAL)).toBe(dos)
  })

  it('saltar a un punto lejano calcula bien la dirección', () => {
    const cuatro = irA(estadoInicial(), 4, TOTAL)
    expect(cuatro.direccion).toBe(1)
    expect(irA(cuatro, 1, TOTAL).direccion).toBe(-1)
  })

  it('con total 0 no hace nada — no hay paso al que ir', () => {
    const e = estadoInicial()
    expect(irA(e, 1, 0)).toBe(e)
  })

  it('esPrimero / esUltimo', () => {
    expect(esPrimero(estadoInicial())).toBe(true)
    expect(esUltimo(estadoInicial(), TOTAL)).toBe(false)
    expect(esUltimo(irA(estadoInicial(), TOTAL - 1, TOTAL), TOTAL)).toBe(true)
  })
})

describe('pasoPorSwipe', () => {
  it('un arrastre corto y lento no cuenta — probablemente se arrepintió', () => {
    expect(pasoPorSwipe(-20, -50)).toBe(0)
    expect(pasoPorSwipe(20, 50)).toBe(0)
  })

  it('arrastrar lo suficiente hacia la izquierda avanza', () => {
    expect(pasoPorSwipe(-UMBRAL_DISTANCIA_PX, 0)).toBe(1)
    expect(pasoPorSwipe(-200, 0)).toBe(1)
  })

  it('arrastrar lo suficiente hacia la derecha retrocede', () => {
    expect(pasoPorSwipe(UMBRAL_DISTANCIA_PX, 0)).toBe(-1)
  })

  it('un flick corto pero rápido SÍ cuenta', () => {
    // Distancia por debajo del umbral, velocidad por encima.
    expect(pasoPorSwipe(-12, -UMBRAL_VELOCIDAD)).toBe(1)
    expect(pasoPorSwipe(12, UMBRAL_VELOCIDAD)).toBe(-1)
  })

  it('si distancia y velocidad se contradicen, manda la velocidad', () => {
    // Arrastré a la derecha pero solté con impulso a la izquierda: la
    // intención más reciente es la del impulso.
    expect(pasoPorSwipe(80, -900)).toBe(1)
    expect(pasoPorSwipe(-80, 900)).toBe(-1)
  })

  it('quieto no mueve nada', () => {
    expect(pasoPorSwipe(0, 0)).toBe(0)
  })
})
