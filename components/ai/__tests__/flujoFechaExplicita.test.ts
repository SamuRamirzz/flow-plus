import { describe, expect, it } from 'vitest'
import { construirTurnoIA } from '../conversacion'
import type { TaskManagementAgentOutput } from '@/lib/ai/agents/taskManagement'
import type { Materia } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import { inferirFechaEntrega } from '@/lib/horario/inferirFecha'

// Ajuste (post 7.5) Parte 1 — regresión a nivel de FLUJO COMPLETO, pedida
// explícitamente porque inferirFechaEntrega ya estaba bien testeada de
// forma aislada (ver lib/horario/__tests__/inferirFecha.test.ts) y el
// reporte del usuario era que la fecha explícita se perdía en algún punto
// ENTRE la salida del agente y la llamada a esa función en el servidor.
//
// Esta prueba encadena las piezas reales en el orden en que se ejecutan de
// verdad: TaskManagementAgentOutput (lo que ya parseó/resolvió schema.ts +
// resolver.ts a partir de la respuesta de Gemini) -> construirTurnoIA
// (conversacion.ts, cliente, arma la fila editable que ve el usuario) -> el
// mismo valor de fecha llega a inferirFechaEntrega (servidor, POST
// /api/tareas) con un horario REAL que produciría un día distinto si la
// fecha explícita se hubiera perdido en cualquier paso intermedio.
describe('flujo completo: fecha explícita del usuario sobrevive de punta a punta', () => {
  const materias: Materia[] = [{ id: 'mat-mate', nombre: 'Matemáticas', color: '#fff', icono: 'Calculator' }]

  // Matemáticas se dicta los LUNES — si la fecha explícita se perdiera en
  // cualquier punto del flujo, inferirFechaEntrega caería acá y devolvería
  // el próximo lunes en vez del viernes que pidió el usuario.
  const horarioConLunes: BloqueHorario[] = [
    { id: 'bloque-1', tipo: 'clase', materiaId: 'mat-mate', diaSemana: 1, horaInicio: '08:00', horaFin: '09:00', aula: null, profesor: null },
  ]

  it('caso reportado: materia con horario + fecha explícita distinta al día de clase → gana la fecha explícita en todo el flujo', () => {
    // 1. Lo que devolvería TaskManagementAgent para "examen de matemáticas
    //    el viernes" (hoy lunes 2026-07-27 → "el viernes" = 2026-07-31).
    const output: TaskManagementAgentOutput = {
      originalText: 'Examen de matemáticas el viernes',
      tipoRespuesta: 'operaciones',
      mensaje: null,
      bloques: [],
      operaciones: [
        { id: 'op1', tipo: 'crear', titulo: 'Examen de matemáticas', materia: 'Matemáticas', fecha: '2026-07-31', prioridad: 'media', tipoTarea: 'examen', confidence: 0.95 },
      ],
    }

    // 2. Cliente: construirTurnoIA (conversacion.ts) traduce a TareaEditable.
    const turno = construirTurnoIA('t1', output, materias)
    expect(turno.operaciones).toHaveLength(1)
    const operacion = turno.operaciones[0]
    if (operacion.tipo !== 'crear') throw new Error('se esperaba tipo "crear"')
    expect(operacion.fecha).toBe('2026-07-31')
    expect(operacion.materiaId).toBe('mat-mate')

    // 3. Servidor: el mismo input que arma POST /api/tareas a partir de
    //    operacion.fecha, con el horario real de la materia disponible —
    //    para que la prueba sea honesta sobre qué pasaría si la fecha
    //    explícita se hubiera perdido antes de llegar acá.
    const fechaResuelta = inferirFechaEntrega({
      fechaExplicita: operacion.fecha || null,
      origenExplicita: 'ia',
      materiaId: operacion.materiaId,
      horario: horarioConLunes,
      hoy: '2026-07-27',
    })

    expect(fechaResuelta.fecha).toBe('2026-07-31') // viernes explícito, NO el lunes del horario
    expect(fechaResuelta.origen).toBe('explicita_ia')
  })

  it('contraprueba: la MISMA materia sin fecha explícita sí cae en el horario (para confirmar que el horario funciona de verdad)', () => {
    const output: TaskManagementAgentOutput = {
      originalText: 'Tengo examen de matemáticas',
      tipoRespuesta: 'operaciones',
      mensaje: null,
      bloques: [],
      operaciones: [{ id: 'op2', tipo: 'crear', titulo: 'Examen de matemáticas', materia: 'Matemáticas', fecha: null, prioridad: 'media', tipoTarea: 'examen', confidence: 0.9 }],
    }
    const turno = construirTurnoIA('t2', output, materias)
    const operacion = turno.operaciones[0]
    if (operacion.tipo !== 'crear') throw new Error('se esperaba tipo "crear"')
    expect(operacion.fecha).toBe('')

    const fechaResuelta = inferirFechaEntrega({
      fechaExplicita: operacion.fecha || null,
      origenExplicita: 'ia',
      materiaId: operacion.materiaId,
      horario: horarioConLunes,
      hoy: '2026-07-27',
    })

    expect(fechaResuelta.origen).toBe('inferida_horario')
    expect(fechaResuelta.fecha).toBe('2026-08-03') // próximo lunes
  })
})
