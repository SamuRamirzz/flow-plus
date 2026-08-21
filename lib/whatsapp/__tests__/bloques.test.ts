import { describe, it, expect } from 'vitest'
import { renderizarBloques } from '../bloques'
import type { BloqueRespuesta } from '@/lib/ai/agents/taskManagement'

describe('renderizarBloques — el bug real: la lista de tareas se perdía entera', () => {
  it('renderiza una lista simple con viñetas', () => {
    const bloques: BloqueRespuesta[] = [
      { tipo: 'lista', items: ['Ensayo de historia — 21/08', 'Maqueta de sociales — 22/08'] },
    ]
    const texto = renderizarBloques(bloques)
    expect(texto).toContain('• Ensayo de historia — 21/08')
    expect(texto).toContain('• Maqueta de sociales — 22/08')
  })

  it('renderiza una lista detallada con título en negrita y detalle indentado', () => {
    const bloques: BloqueRespuesta[] = [
      { tipo: 'lista_detallada', items: [{ titulo: 'Ensayo de historia', detalle: ['Vence 21/08', 'Prioridad alta'] }] },
    ]
    const texto = renderizarBloques(bloques)
    expect(texto).toBe('*Ensayo de historia*\n   Vence 21/08\n   Prioridad alta')
  })

  it('aplana una tabla a pares columna:valor por fila, con doble salto entre filas', () => {
    const bloques: BloqueRespuesta[] = [
      { tipo: 'tabla', columnas: ['Materia', 'Vencidas'], filas: [['Biología', '2'], ['Historia', '0']] },
    ]
    const texto = renderizarBloques(bloques)
    expect(texto).toBe('*Materia:* Biología\n*Vencidas:* 2\n\n*Materia:* Historia\n*Vencidas:* 0')
  })

  it('omite celdas faltantes en una fila más corta que las columnas', () => {
    const bloques: BloqueRespuesta[] = [{ tipo: 'tabla', columnas: ['A', 'B', 'C'], filas: [['x', 'y']] }]
    expect(renderizarBloques(bloques)).toBe('*A:* x\n*B:* y')
  })

  it('renderiza renglones como pares etiqueta:valor', () => {
    const bloques: BloqueRespuesta[] = [
      { tipo: 'renglones', pares: [{ etiqueta: 'Materia', valor: 'Física' }, { etiqueta: 'Vence', valor: 'mañana' }] },
    ]
    expect(renderizarBloques(bloques)).toBe('*Materia:* Física\n*Vence:* mañana')
  })

  it('devuelve el contenido tal cual para un bloque de texto', () => {
    expect(renderizarBloques([{ tipo: 'texto', contenido: 'Todo al día.' }])).toBe('Todo al día.')
  })

  it('concatena varios bloques con doble salto de línea', () => {
    const bloques: BloqueRespuesta[] = [
      { tipo: 'texto', contenido: 'Tienes 2 tareas:' },
      { tipo: 'lista', items: ['Una', 'Otra'] },
    ]
    expect(renderizarBloques(bloques)).toBe('Tienes 2 tareas:\n\n• Una\n• Otra')
  })

  it('un array vacío no produce ningún separador huérfano', () => {
    expect(renderizarBloques([])).toBe('')
  })

  it('filtra un bloque de lista sin items (defensivo, no debería llegar así)', () => {
    const bloques: BloqueRespuesta[] = [{ tipo: 'texto', contenido: 'Antes' }, { tipo: 'lista', items: [] }, { tipo: 'texto', contenido: 'Después' }]
    expect(renderizarBloques(bloques)).toBe('Antes\n\nDespués')
  })
})
