import { describe, expect, it } from 'vitest'
import { asignarIconoDeterministico, ICONOS_VALIDOS, ICONO_POR_DEFECTO } from '../asignarIcono'

describe('asignarIconoDeterministico — materias comunes de colegio/universidad', () => {
  const casos: Array<[string, ReturnType<typeof asignarIconoDeterministico>]> = [
    ['Matemáticas', 'Calculator'],
    ['Cálculo II', 'Calculator'],
    ['Álgebra Lineal', 'Calculator'],
    ['Química', 'FlaskConical'],
    ['Física I', 'Atom'],
    ['Educación Física', 'Dumbbell'],
    ['Ed. Física', 'Dumbbell'],
    ['ed fisica', 'Dumbbell'],
    ['Biología', 'Leaf'],
    ['Ciencias Naturales', 'Leaf'],
    ['Informática', 'Laptop'],
    ['Programación', 'Code'],
    ['Base de Datos', 'Database'],
    ['Inglés', 'Globe'],
    ['Inglés Técnico', 'Globe'],
    ['Español', 'BookOpen'],
    ['Literatura', 'BookOpen'],
    ['Geografía', 'Map'],
    ['Historia', 'Landmark'],
    ['Historia de América Latina', 'Landmark'],
    ['Educación Artística', 'Palette'],
    ['Música', 'Music'],
    ['Religión', 'Church'],
    ['Filosofía', 'Brain'],
    ['Psicología', 'Brain'],
    ['Derecho', 'Scale'],
    ['Economía', 'Coins'],
    ['Estadística', 'BarChart3'],
    ['Anatomía', 'HeartPulse'],
    ['Medicina', 'Stethoscope'],
  ]

  it.each(casos)('%s → %s', (nombre, esperado) => {
    expect(asignarIconoDeterministico(nombre)).toBe(esperado)
  })

  // Caso que justifica por qué el orden de las reglas importa: "física"
  // (Atom, ciencia) es substring literal de "educación física" (Dumbbell,
  // deporte) — si se evaluara la regla genérica primero, esta nunca
  // matchearía Dumbbell.
  it('"física" sola es la materia de ciencias (Atom), no se confunde con educación física', () => {
    expect(asignarIconoDeterministico('Física')).toBe('Atom')
    expect(asignarIconoDeterministico('Física II')).toBe('Atom')
  })

  it('nombre que no calza con ningún patrón conocido → null (no adivina, no cae al respaldo)', () => {
    expect(asignarIconoDeterministico('Taller de Robótica Aplicada')).toBeNull()
    expect(asignarIconoDeterministico('xyz123')).toBeNull()
  })

  it('no distingue mayúsculas ni tildes', () => {
    expect(asignarIconoDeterministico('MATEMATICAS')).toBe('Calculator')
    expect(asignarIconoDeterministico('matematicas')).toBe('Calculator')
  })
})

describe('ICONOS_VALIDOS / ICONO_POR_DEFECTO', () => {
  it('el ícono por defecto está incluido en la lista de válidos', () => {
    expect(ICONOS_VALIDOS).toContain(ICONO_POR_DEFECTO)
  })

  it('sin duplicados', () => {
    expect(new Set(ICONOS_VALIDOS).size).toBe(ICONOS_VALIDOS.length)
  })
})
