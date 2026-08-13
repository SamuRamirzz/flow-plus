import { describe, expect, it } from 'vitest'
import { fragmentosDeLinea, lineasDeTexto } from '../markdownSimple'

describe('fragmentosDeLinea — el bug que arregla', () => {
  it('**BIOLOGÍA** deja de verse con asteriscos y pasa a ser negrita', () => {
    expect(fragmentosDeLinea('**BIOLOGÍA**')).toEqual([{ texto: 'BIOLOGÍA', negrita: true }])
  })

  it('negrita en medio de una frase conserva el texto de alrededor', () => {
    expect(fragmentosDeLinea('La materia **Física** se repite')).toEqual([
      { texto: 'La materia ' },
      { texto: 'Física', negrita: true },
      { texto: ' se repite' },
    ])
  })
})

describe('fragmentosDeLinea — estilos', () => {
  it('texto sin marcas devuelve un solo fragmento sin estilo', () => {
    expect(fragmentosDeLinea('hola qué tal')).toEqual([{ texto: 'hola qué tal' }])
  })

  it('cursiva con asterisco simple', () => {
    expect(fragmentosDeLinea('*mañana*')).toEqual([{ texto: 'mañana', cursiva: true }])
  })

  it('cursiva con guion bajo', () => {
    expect(fragmentosDeLinea('_pendiente_')).toEqual([{ texto: 'pendiente', cursiva: true }])
  })

  it('negrita con guion bajo doble', () => {
    expect(fragmentosDeLinea('__urgente__')).toEqual([{ texto: 'urgente', negrita: true }])
  })

  it('código en línea', () => {
    expect(fragmentosDeLinea('usa `npm run dev`')).toEqual([{ texto: 'usa ' }, { texto: 'npm run dev', codigo: true }])
  })

  it('negrita gana sobre cursiva: ** no se parte en dos cursivas', () => {
    // Sin la precedencia correcta, "**x**" dejaría asteriscos sueltos
    const f = fragmentosDeLinea('**x**')
    expect(f).toHaveLength(1)
    expect(f[0]).toEqual({ texto: 'x', negrita: true })
  })

  it('varias marcas en la misma línea', () => {
    expect(fragmentosDeLinea('**A** y **B**')).toEqual([
      { texto: 'A', negrita: true },
      { texto: ' y ' },
      { texto: 'B', negrita: true },
    ])
  })

  it('un guion bajo dentro de una palabra NO es cursiva (nombre_de_variable)', () => {
    expect(fragmentosDeLinea('fecha_entrega')).toEqual([{ texto: 'fecha_entrega' }])
  })

  it('un asterisco suelto no rompe nada', () => {
    expect(fragmentosDeLinea('2 * 3 = 6')).toEqual([{ texto: '2 * 3 = 6' }])
  })

  it('cadena vacía devuelve lista vacía', () => {
    expect(fragmentosDeLinea('')).toEqual([])
  })
})

describe('lineasDeTexto', () => {
  it('detecta viñetas de markdown como líneas de lista', () => {
    const l = lineasDeTexto('- Biología\n- Inglés')
    expect(l).toHaveLength(2)
    expect(l[0].vinieta).toBe(true)
    expect(l[0].fragmentos).toEqual([{ texto: 'Biología' }])
  })

  it('acepta viñetas con asterisco y con bullet', () => {
    expect(lineasDeTexto('* uno')[0].vinieta).toBe(true)
    expect(lineasDeTexto('• dos')[0].vinieta).toBe(true)
  })

  it('una línea normal no se marca como viñeta', () => {
    expect(lineasDeTexto('Tienes 3 tareas')[0].vinieta).toBe(false)
  })

  it('descarta líneas vacías (colapsa saltos dobles)', () => {
    expect(lineasDeTexto('uno\n\n\ndos')).toHaveLength(2)
  })

  it('combina viñeta y negrita en la misma línea', () => {
    const [linea] = lineasDeTexto('- **BIOLOGÍA**: lunes y martes')
    expect(linea.vinieta).toBe(true)
    expect(linea.fragmentos).toEqual([{ texto: 'BIOLOGÍA', negrita: true }, { texto: ': lunes y martes' }])
  })

  it('texto vacío devuelve lista vacía', () => {
    expect(lineasDeTexto('   ')).toEqual([])
  })
})
