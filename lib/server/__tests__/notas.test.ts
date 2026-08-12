import { describe, expect, it } from 'vitest'
import { nombreArchivoNota } from '../notas'

// Sprint Sistema de Notas Unificado — primer test de lib/server/notas.ts.
// `crearNota`/`sincronizarNotaADrive` son I/O real (Supabase + Drive), sin
// precedente de test unitario en este archivo del proyecto — mismo criterio
// que analisisArchivo.ts (solo `politicaDeAnalisis`, la función pura, tiene
// tests). `nombreArchivoNota` es la única función pura de este módulo.
describe('nombreArchivoNota', () => {
  it('antepone los primeros 8 caracteres del id de la nota', () => {
    const nombre = nombreArchivoNota('12345678-abcd-efgh-ijkl-mnopqrstuvwx', 'Mi nota')
    expect(nombre.startsWith('12345678-')).toBe(true)
  })

  it('sin título, usa "Nota" como base', () => {
    expect(nombreArchivoNota('12345678-xxxx', null)).toBe('12345678-Nota.txt')
  })

  it('con título, lo usa como base del nombre', () => {
    expect(nombreArchivoNota('12345678-xxxx', 'Recordatorio')).toBe('12345678-Recordatorio.txt')
  })

  it('recorta un título más largo de 60 caracteres', () => {
    const tituloLargo = 'A'.repeat(100)
    const nombre = nombreArchivoNota('12345678-xxxx', tituloLargo)
    // 8 (prefijo) + '-' + 60 (recorte) + '.txt'
    expect(nombre).toBe(`12345678-${'A'.repeat(60)}.txt`)
  })

  it('reemplaza caracteres inválidos para un nombre de archivo de Windows/Drive', () => {
    const nombre = nombreArchivoNota('12345678-xxxx', 'Tarea: "Física" <2/3>')
    // Ninguno de \ / : * ? " < > | debe sobrevivir tal cual.
    expect(nombre).not.toMatch(/[\\/:*?"<>|]/)
  })

  it('título que queda vacío tras limpiar (solo espacios) cae al mismo respaldo "Nota"', () => {
    expect(nombreArchivoNota('12345678-xxxx', '   ')).toBe('12345678-Nota.txt')
  })

  it('siempre termina en .txt', () => {
    expect(nombreArchivoNota('id-1', 'x')).toMatch(/\.txt$/)
    expect(nombreArchivoNota('id-2', null)).toMatch(/\.txt$/)
  })

  it('dos notas distintas con el mismo título producen nombres distintos (por el prefijo del id)', () => {
    const n1 = nombreArchivoNota('11111111-a', 'Misma nota')
    const n2 = nombreArchivoNota('22222222-b', 'Misma nota')
    expect(n1).not.toBe(n2)
  })
})
