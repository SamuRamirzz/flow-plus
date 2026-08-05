import { describe, expect, it } from 'vitest'
import { calcularTamanoReducido, LADO_MAXIMO } from '../imagen'

describe('calcularTamanoReducido', () => {
  it('reduce una foto de celular apaisada al lado máximo, conservando la proporción', () => {
    // 4032x3024 (4:3) es el tamaño típico de la cámara de un celular.
    const r = calcularTamanoReducido(4032, 3024)
    expect(r.ancho).toBe(LADO_MAXIMO)
    expect(r.alto).toBe(1200)
  })

  it('reduce una foto vertical usando el ALTO como lado mayor', () => {
    const r = calcularTamanoReducido(3024, 4032)
    expect(r.alto).toBe(LADO_MAXIMO)
    expect(r.ancho).toBe(1200)
  })

  it('no agranda una imagen que ya es más chica que el máximo', () => {
    const r = calcularTamanoReducido(800, 600)
    expect(r).toEqual({ ancho: 800, alto: 600 })
  })

  it('deja intacta una imagen exactamente del tamaño máximo', () => {
    const r = calcularTamanoReducido(LADO_MAXIMO, 900)
    expect(r).toEqual({ ancho: LADO_MAXIMO, alto: 900 })
  })

  it('respeta un lado máximo distinto al del valor por defecto', () => {
    const r = calcularTamanoReducido(2000, 1000, 500)
    expect(r).toEqual({ ancho: 500, alto: 250 })
  })

  it('una imagen cuadrada queda cuadrada', () => {
    const r = calcularTamanoReducido(3000, 3000)
    expect(r).toEqual({ ancho: LADO_MAXIMO, alto: LADO_MAXIMO })
  })
})
