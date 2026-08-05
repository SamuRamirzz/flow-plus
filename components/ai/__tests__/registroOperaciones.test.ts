import { describe, expect, it } from 'vitest'
import { payloadDeshacer, type RegistroOperacion } from '../registroOperaciones'
import type { Tarea } from '@/lib/types'

const TAREA: Tarea = { id: 'tarea-1', titulo: 'Examen de química', materia_id: 'mat-1', fecha_entrega: '2026-08-01', prioridad: 'alta', completada: false, tipo: 'examen', temario: null, formato: null, peso: null, completada_en: null }

describe('payloadDeshacer', () => {
  it('crear → eliminar la tarea creada', () => {
    const registro: RegistroOperacion = { id: 'r1', tipo: 'crear', tareaId: 'tarea-1', titulo: 'X', deshecho: false }
    expect(payloadDeshacer(registro)).toEqual({ tipo: 'eliminar', tareaId: 'tarea-1' })
  })

  it('modificar → actualizar con el estado ANTERIOR completo, no solo los campos que cambiaron', () => {
    const registro: RegistroOperacion = {
      id: 'r2',
      tipo: 'modificar',
      tareaId: 'tarea-1',
      titulo: 'Examen de química',
      estadoAnterior: TAREA,
      cambiosAplicados: { fecha: '2026-08-15' },
      deshecho: false,
    }
    expect(payloadDeshacer(registro)).toEqual({
      tipo: 'actualizar',
      tareaId: 'tarea-1',
      cambios: { titulo: 'Examen de química', materiaId: 'mat-1', fecha: '2026-08-01', prioridad: 'alta', completada: false },
    })
  })

  it('modificar con estadoAnterior sin fecha (null) manda fecha vacía, no "null" literal', () => {
    const registro: RegistroOperacion = {
      id: 'r3',
      tipo: 'modificar',
      tareaId: 'tarea-1',
      titulo: 'X',
      estadoAnterior: { ...TAREA, fecha_entrega: null },
      cambiosAplicados: {},
      deshecho: false,
    }
    const accion = payloadDeshacer(registro)
    expect(accion.tipo).toBe('actualizar')
    if (accion.tipo === 'actualizar') expect(accion.cambios.fecha).toBe('')
  })

  it('borrar → recrear con los datos reales de la tarea eliminada', () => {
    const registro: RegistroOperacion = { id: 'r4', tipo: 'borrar', tareaId: 'tarea-1', titulo: 'Examen de química', tareaEliminada: TAREA, deshecho: false }
    expect(payloadDeshacer(registro)).toEqual({
      tipo: 'recrear',
      input: { titulo: 'Examen de química', materiaId: 'mat-1', nuevaMateria: null, fecha: '2026-08-01', prioridad: 'alta' },
    })
  })

  it('borrar con fecha_entrega null recrea con fecha vacía', () => {
    const registro: RegistroOperacion = {
      id: 'r5',
      tipo: 'borrar',
      tareaId: 'tarea-1',
      titulo: 'X',
      tareaEliminada: { ...TAREA, fecha_entrega: null },
      deshecho: false,
    }
    const accion = payloadDeshacer(registro)
    expect(accion.tipo).toBe('recrear')
    if (accion.tipo === 'recrear') expect(accion.input.fecha).toBe('')
  })
})
