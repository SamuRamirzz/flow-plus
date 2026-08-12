import { describe, expect, it } from 'vitest'
import { anclaDeNota, type Nota } from '../tipos'

function nota(overrides: Partial<Nota> = {}): Nota {
  return {
    id: 'n1',
    titulo: null,
    contenido: 'contenido',
    tarea_id: null,
    bloque_horario_id: null,
    archivo_id: null,
    materia_id: null,
    drive_file_id: null,
    drive_sync_error: null,
    creado_por: 'usuario',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('anclaDeNota', () => {
  it('con tarea_id → "tarea"', () => {
    expect(anclaDeNota(nota({ tarea_id: 't1' }))).toBe('tarea')
  })

  it('con bloque_horario_id → "bloque_horario"', () => {
    expect(anclaDeNota(nota({ bloque_horario_id: 'b1' }))).toBe('bloque_horario')
  })

  it('con archivo_id → "archivo"', () => {
    expect(anclaDeNota(nota({ archivo_id: 'a1' }))).toBe('archivo')
  })

  it('con materia_id → "materia"', () => {
    expect(anclaDeNota(nota({ materia_id: 'm1' }))).toBe('materia')
  })

  it('las 4 en null → "suelta"', () => {
    expect(anclaDeNota(nota())).toBe('suelta')
  })

  it('respeta el orden de precedencia si por algún error llegara más de una (el check constraint de la base ya lo impide, pero la función debe ser determinista igual)', () => {
    // tarea_id gana sobre las demás si estuvieran presentes a la vez.
    expect(anclaDeNota(nota({ tarea_id: 't1', archivo_id: 'a1' }))).toBe('tarea')
  })
})
