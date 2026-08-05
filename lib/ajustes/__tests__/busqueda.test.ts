import { describe, expect, it } from 'vitest'
import { buscarCategorias } from '../busqueda'
import type { CategoriaAjustesId } from '@/lib/ajustesModal'

const CATEGORIAS: { id: CategoriaAjustesId; label: string }[] = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'fecha-hora', label: 'Fecha y hora' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'proximamente', label: 'Próximamente' },
  { id: 'cerrar-sesion', label: 'Cerrar sesión' },
]

const ids = (resultado: { id: CategoriaAjustesId }[]) => resultado.map((c) => c.id)

describe('buscarCategorias', () => {
  it('devuelve todo con consulta vacía — "sin filtro" no es "sin resultados"', () => {
    expect(buscarCategorias('', CATEGORIAS)).toEqual(CATEGORIAS)
  })

  it('devuelve todo con una consulta de solo espacios', () => {
    expect(buscarCategorias('   ', CATEGORIAS)).toEqual(CATEGORIAS)
  })

  it('encuentra por la etiqueta visible', () => {
    expect(ids(buscarCategorias('Perfil', CATEGORIAS))).toEqual(['perfil'])
  })

  it('ignora acentos en la consulta y en la etiqueta', () => {
    expect(ids(buscarCategorias('sesion', CATEGORIAS))).toEqual(['cerrar-sesion'])
    expect(ids(buscarCategorias('próximamente', CATEGORIAS))).toEqual(['proximamente'])
  })

  it('ignora mayúsculas', () => {
    expect(ids(buscarCategorias('APARIENCIA', CATEGORIAS))).toEqual(['apariencia'])
  })

  it('encuentra por palabra clave, no solo por el título — el caso que justifica la búsqueda', () => {
    expect(ids(buscarCategorias('zona horaria', CATEGORIAS))).toEqual(['fecha-hora'])
    expect(ids(buscarCategorias('oscuro', CATEGORIAS))).toEqual(['apariencia'])
    expect(ids(buscarCategorias('salir', CATEGORIAS))).toEqual(['cerrar-sesion'])
    expect(ids(buscarCategorias('whatsapp', CATEGORIAS))).toEqual(['proximamente'])
  })

  it('encuentra por coincidencia parcial de una palabra clave', () => {
    expect(ids(buscarCategorias('recordat', CATEGORIAS))).toEqual(['notificaciones'])
  })

  it('devuelve lista vacía cuando nada coincide', () => {
    expect(buscarCategorias('xyz123', CATEGORIAS)).toEqual([])
  })

  it('puede devolver varias categorías cuando el término es compartido', () => {
    // "sesion" aparece en cerrar-sesion; "cuenta" solo en perfil. Un
    // término genérico como "no" no debería colapsar a una sola.
    const resultado = ids(buscarCategorias('o', CATEGORIAS))
    expect(resultado.length).toBeGreaterThan(1)
  })
})
