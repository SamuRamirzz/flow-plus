import { describe, expect, it } from 'vitest'
import { reconciliar } from '../realtimeReconciliar'

type Fila = { id: string; nombre: string }

describe('reconciliar', () => {
  it('INSERT de un id nuevo lo agrega al final', () => {
    const lista: Fila[] = [{ id: 'a', nombre: 'A' }]
    const resultado = reconciliar(lista, { tipo: 'INSERT', fila: { id: 'b', nombre: 'B' } })
    expect(resultado).toEqual([{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B' }])
  })

  it('INSERT de un id que YA existe actualiza en el mismo lugar, sin duplicar (eco de la propia escritura)', () => {
    const lista: Fila[] = [{ id: 'a', nombre: 'Vieja' }]
    const resultado = reconciliar(lista, { tipo: 'INSERT', fila: { id: 'a', nombre: 'Nueva' } })
    expect(resultado).toEqual([{ id: 'a', nombre: 'Nueva' }])
  })

  it('UPDATE reemplaza la fila con el mismo id, conserva la posición', () => {
    const lista: Fila[] = [{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B' }]
    const resultado = reconciliar(lista, { tipo: 'UPDATE', fila: { id: 'a', nombre: 'A actualizada' } })
    expect(resultado).toEqual([{ id: 'a', nombre: 'A actualizada' }, { id: 'b', nombre: 'B' }])
  })

  it('UPDATE de un id que no existe localmente lo agrega (llegó antes que el fetch inicial)', () => {
    const lista: Fila[] = [{ id: 'a', nombre: 'A' }]
    const resultado = reconciliar(lista, { tipo: 'UPDATE', fila: { id: 'z', nombre: 'Z' } })
    expect(resultado).toEqual([{ id: 'a', nombre: 'A' }, { id: 'z', nombre: 'Z' }])
  })

  it('DELETE quita la fila con ese id', () => {
    const lista: Fila[] = [{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B' }]
    const resultado = reconciliar(lista, { tipo: 'DELETE', fila: { id: 'a', nombre: 'A' } })
    expect(resultado).toEqual([{ id: 'b', nombre: 'B' }])
  })

  it('DELETE de un id que no existe localmente no rompe nada', () => {
    const lista: Fila[] = [{ id: 'a', nombre: 'A' }]
    const resultado = reconciliar(lista, { tipo: 'DELETE', fila: { id: 'z', nombre: 'Z' } })
    expect(resultado).toEqual([{ id: 'a', nombre: 'A' }])
  })
})
