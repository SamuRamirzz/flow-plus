import { describe, expect, it } from 'vitest'
import { esRutaDelUsuario } from '../rutaStorage'

const USER_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const USER_B = 'bbbbbbbb-0000-0000-0000-000000000002'

describe('esRutaDelUsuario', () => {
  it('ruta con el prefijo exacto del usuario → true', () => {
    expect(esRutaDelUsuario(`${USER_A}/foto.jpg`, USER_A)).toBe(true)
  })

  it('ruta del prefijo de OTRO usuario → false (el caso IDOR real)', () => {
    expect(esRutaDelUsuario(`${USER_B}/foto.jpg`, USER_A)).toBe(false)
  })

  it('un userId que es prefijo de otro no cuela sin la barra (ej. "aaaaaaaa-...001" vs "aaaaaaaa-...0012")', () => {
    // Regresión clásica de startsWith sin separador: si el id de un usuario
    // fuera prefijo textual del id de otro, un startsWith(userId) sin la
    // barra dejaría pasar rutas ajenas. Acá se arma a propósito un id que
    // extiende al de USER_A como prefijo de string.
    const idParecido = `${USER_A}2`
    expect(esRutaDelUsuario(`${idParecido}/foto.jpg`, USER_A)).toBe(false)
  })

  it('ruta vacía o sin ningún prefijo reconocible → false', () => {
    expect(esRutaDelUsuario('', USER_A)).toBe(false)
    expect(esRutaDelUsuario('foto.jpg', USER_A)).toBe(false)
  })

  it('ruta que contiene ".." se rechaza siempre, aunque el prefijo sea correcto', () => {
    expect(esRutaDelUsuario(`${USER_A}/../${USER_B}/foto.jpg`, USER_A)).toBe(false)
  })

  it('el propio userId sin la barra final no basta (evita que "user_id" pelado pase el chequeo)', () => {
    expect(esRutaDelUsuario(USER_A, USER_A)).toBe(false)
  })
})
