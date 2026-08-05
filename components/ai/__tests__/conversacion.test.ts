import { describe, expect, it } from 'vitest'
import { historialParaAgente, construirTurnoIA, materiaParaNombre, type Turno } from '../conversacion'
import type { Materia } from '@/lib/types'
import type { TaskManagementAgentOutput } from '@/lib/ai/agents/taskManagement'
import { MATERIA_NUEVA } from '@/components/ui/MateriaPicker'

function turnoUsuario(texto: string): Turno {
  return { rol: 'usuario', id: 'u-' + texto.slice(0, 4), texto }
}

function turnoIAOperaciones(resumen: string): Turno {
  return { rol: 'ia', id: 'ia-' + resumen.slice(0, 4), tipoRespuesta: 'operaciones', mensaje: null, resumen, operaciones: [], aplicando: false, aplicadoOk: false }
}

function turnoIAConversacional(mensaje: string): Turno {
  return { rol: 'ia', id: 'ia-' + mensaje.slice(0, 4), tipoRespuesta: 'conversacional', mensaje, resumen: null, operaciones: [], aplicando: false, aplicadoOk: false }
}

describe('historialParaAgente', () => {
  it('traduce un turno de usuario tal cual', () => {
    const h = historialParaAgente([turnoUsuario('hola')])
    expect(h).toEqual([{ rol: 'usuario', texto: 'hola' }])
  })

  it('usa "resumen" para un turno de IA con operaciones', () => {
    const h = historialParaAgente([turnoIAOperaciones('Quieres crear 1 tarea.')])
    expect(h).toEqual([{ rol: 'modelo', texto: 'Quieres crear 1 tarea.' }])
  })

  it('usa "mensaje" para un turno de IA conversacional', () => {
    const h = historialParaAgente([turnoIAConversacional('¡Hola! ¿En qué te ayudo?')])
    expect(h).toEqual([{ rol: 'modelo', texto: '¡Hola! ¿En qué te ayudo?' }])
  })

  it('preserva el orden de una conversación de varios turnos', () => {
    const h = historialParaAgente([
      turnoUsuario('crea una tarea de historia'),
      turnoIAOperaciones('Quieres crear 1 tarea (Historia).'),
      turnoUsuario('ponle prioridad alta'),
      turnoIAOperaciones('Quieres crear 1 tarea (Historia, alta).'),
    ])
    expect(h.map((t) => t.rol)).toEqual(['usuario', 'modelo', 'usuario', 'modelo'])
    expect(h[3]).toEqual({ rol: 'modelo', texto: 'Quieres crear 1 tarea (Historia, alta).' })
  })

  it('omite un turno de IA sin texto útil (resumen y mensaje ambos null) en vez de mandar un turno vacío', () => {
    const turnoVacio: Turno = { rol: 'ia', id: 'x', tipoRespuesta: 'operaciones', mensaje: null, resumen: null, operaciones: [], aplicando: false, aplicadoOk: false }
    const h = historialParaAgente([turnoUsuario('algo'), turnoVacio])
    expect(h).toEqual([{ rol: 'usuario', texto: 'algo' }])
  })

  it('omite un turno de IA de error — no aporta contexto útil al modelo', () => {
    const turnoError: Turno = { rol: 'ia', id: 'e1', tipoRespuesta: 'error', mensaje: 'No entendí qué querías hacer.', resumen: null, operaciones: [], aplicando: false, aplicadoOk: false }
    const h = historialParaAgente([turnoUsuario('algo raro'), turnoError])
    expect(h).toEqual([{ rol: 'usuario', texto: 'algo raro' }])
  })
})

describe('materiaParaNombre', () => {
  const materias: Materia[] = [{ id: 'mat-1', nombre: 'Matemáticas', color: '#fff', icono: 'Calculator' }]

  it('sin nombre → materia nueva vacía', () => {
    expect(materiaParaNombre(null, materias)).toEqual({ materiaId: MATERIA_NUEVA, nuevaMateria: '' })
  })

  it('nombre que existe (case-insensitive) → id real, sin nuevaMateria', () => {
    expect(materiaParaNombre('matemáticas', materias)).toEqual({ materiaId: 'mat-1', nuevaMateria: '' })
  })

  it('nombre que no existe → queda como materia nueva con ese nombre', () => {
    expect(materiaParaNombre('Historia', materias)).toEqual({ materiaId: MATERIA_NUEVA, nuevaMateria: 'Historia' })
  })
})

describe('construirTurnoIA', () => {
  const materias: Materia[] = [{ id: 'mat-1', nombre: 'Historia', color: '#fff', icono: 'Landmark' }]

  it('tipoRespuesta conversacional → turno conversacional con el mensaje del modelo', () => {
    const output: TaskManagementAgentOutput = { originalText: 'hola', tipoRespuesta: 'conversacional', mensaje: '¡Hola!', operaciones: [] }
    const turno = construirTurnoIA('t1', output, materias)
    expect(turno.tipoRespuesta).toBe('conversacional')
    expect(turno.mensaje).toBe('¡Hola!')
    expect(turno.operaciones).toEqual([])
  })

  it('operaciones vacío → turno de error con mensaje explicativo, no un turno "operaciones" vacío', () => {
    const output: TaskManagementAgentOutput = { originalText: 'asdf', tipoRespuesta: 'operaciones', mensaje: null, operaciones: [] }
    const turno = construirTurnoIA('t2', output, materias)
    expect(turno.tipoRespuesta).toBe('error')
    expect(turno.mensaje).toMatch(/no entendí/i)
  })

  it('operaciones con contenido → turno "operaciones" con resumen y las operaciones traducidas a editable', () => {
    const output: TaskManagementAgentOutput = {
      originalText: 'crea una tarea de historia',
      tipoRespuesta: 'operaciones',
      mensaje: null,
      operaciones: [{ id: 'op1', tipo: 'crear', titulo: 'Leer capítulo 3', materia: 'Historia', fecha: '2026-08-01', prioridad: 'media', tipoTarea: 'lectura', confidence: 0.9 }],
    }
    const turno = construirTurnoIA('t3', output, materias)
    expect(turno.tipoRespuesta).toBe('operaciones')
    expect(turno.resumen).toMatch(/crear/i)
    expect(turno.operaciones).toHaveLength(1)
    expect(turno.operaciones[0]).toMatchObject({ tipo: 'crear', titulo: 'Leer capítulo 3', materiaId: 'mat-1', nuevaMateria: '' })
  })
})
