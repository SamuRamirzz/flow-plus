import { describe, expect, it, vi } from 'vitest'
import { sincronizarInvitado, type AccionesSincronizacion } from '../sincronizar'
import { crearMateriaPura, crearTareaPura, agregarBloquePura } from '../operaciones'
import { datosInvitadoVacios } from '../tipos'

// Fabrica un DatosInvitado real usando las mismas funciones puras que ya
// usa lib/tasks.ts en modo invitado — así el escenario de prueba es
// idéntico a lo que de verdad terminaría en localStorage.
function construirEscenario() {
  let datos = datosInvitadoVacios('guest-1')
  const calculo = crearMateriaPura(datos, 'Cálculo')
  datos = calculo.datos
  const historia = crearMateriaPura(datos, 'Historia') // sin ninguna tarea, solo horario
  datos = historia.datos

  const r1 = crearTareaPura(datos, { titulo: 'Tarea 1', materiaId: calculo.materia.id, nuevaMateria: null, fecha: '2026-09-01', prioridad: 'alta' })
  if (!r1.ok) throw new Error('setup falló')
  datos = r1.datos

  const r2 = crearTareaPura(datos, { titulo: 'Tarea completada', materiaId: calculo.materia.id, nuevaMateria: null, fecha: '', prioridad: 'baja' })
  if (!r2.ok) throw new Error('setup falló')
  datos = r2.datos
  // Simula que ya estaba completada localmente.
  datos = { ...datos, tareas: datos.tareas.map((t) => (t.id === r2.tarea.id ? { ...t, completada: true } : t)) }

  const b1 = agregarBloquePura(datos, { materiaId: historia.materia.id, diaSemana: 2, horaInicio: '10:00', horaFin: '11:00' })
  datos = b1.datos

  return datos
}

// Fakes inyectables — mismo patrón que ya usan los tests de IA (proveedor
// falso, no red real). Cada llamada le asigna un id "real" nuevo, distinto
// del id local, para poder verificar que sincronizar() remapea bien.
function accionesFalsas() {
  let contador = 0
  const materiasCreadas: string[] = []
  const tareasCreadas: { titulo: string; materiaId: string | null }[] = []
  const bloquesCreados: { materiaId: string }[] = []
  const completadasPatch: string[] = []

  const acciones: AccionesSincronizacion = {
    crearMateria: vi.fn(async (nombre: string) => {
      contador++
      materiasCreadas.push(nombre)
      return { ok: true as const, materia: { id: `real-materia-${contador}`, nombre, color: '#000', icono: 'BookOpen' }, posibleDuplicado: null }
    }),
    crearTarea: vi.fn(async (input) => {
      contador++
      tareasCreadas.push({ titulo: input.titulo, materiaId: input.materiaId })
      return {
        ok: true as const,
        tareaCreada: {
          id: `real-tarea-${contador}`,
          titulo: input.titulo,
          materia_id: input.materiaId ?? '',
          fecha_entrega: input.fecha || null,
          prioridad: input.prioridad,
          completada: false,
          tipo: input.tipo ?? 'otro',
          temario: null,
          formato: null,
          peso: null,
          completada_en: null,
        },
        avisoFecha: null,
        colisiones: [],
        posibleDuplicado: null,
      }
    }),
    actualizarTarea: vi.fn(async (id: string) => {
      completadasPatch.push(id)
      return { ok: true as const, tarea: {} as never, avisoFecha: null, colisiones: [], posibleDuplicado: null }
    }),
    crearBloqueHorario: vi.fn(async (input) => {
      bloquesCreados.push({ materiaId: input.materiaId })
      return { ok: true as const, bloque: { id: `real-bloque-${++contador}`, ...input } }
    }),
  }

  return { acciones, materiasCreadas, tareasCreadas, bloquesCreados, completadasPatch }
}

describe('sincronizarInvitado', () => {
  it('no llama a nada si no hay datos locales', async () => {
    const { acciones, materiasCreadas } = accionesFalsas()
    const resultado = await sincronizarInvitado(datosInvitadoVacios('guest-1'), acciones)
    expect(resultado).toEqual({ ok: true, resumen: { materias: 0, tareas: 0, bloques: 0 } })
    expect(materiasCreadas).toHaveLength(0)
  })

  it('crea todas las materias primero, en orden', async () => {
    const datos = construirEscenario()
    const { acciones, materiasCreadas } = accionesFalsas()
    await sincronizarInvitado(datos, acciones)
    expect(materiasCreadas).toEqual(['Cálculo', 'Historia'])
  })

  it('remapea el materiaId local al id real al crear cada tarea', async () => {
    const datos = construirEscenario()
    const { acciones, tareasCreadas } = accionesFalsas()
    await sincronizarInvitado(datos, acciones)
    expect(tareasCreadas).toEqual([
      { titulo: 'Tarea 1', materiaId: 'real-materia-1' },
      { titulo: 'Tarea completada', materiaId: 'real-materia-1' },
    ])
  })

  it('marca completada con un PATCH después de crear, solo para tareas que ya lo estaban', async () => {
    const datos = construirEscenario()
    const { acciones, completadasPatch } = accionesFalsas()
    await sincronizarInvitado(datos, acciones)
    expect(completadasPatch).toHaveLength(1) // solo "Tarea completada"
  })

  it('crea los bloques de horario con el materiaId remapeado', async () => {
    const datos = construirEscenario()
    const { acciones, bloquesCreados } = accionesFalsas()
    await sincronizarInvitado(datos, acciones)
    expect(bloquesCreados).toEqual([{ materiaId: 'real-materia-2' }]) // Historia es la 2da materia
  })

  it('devuelve el resumen correcto en éxito completo', async () => {
    const datos = construirEscenario()
    const { acciones } = accionesFalsas()
    const resultado = await sincronizarInvitado(datos, acciones)
    expect(resultado).toEqual({ ok: true, resumen: { materias: 2, tareas: 2, bloques: 1 } })
  })

  it('devuelve error sin `parcial` si falla en la primera materia', async () => {
    const datos = construirEscenario()
    const { acciones } = accionesFalsas()
    acciones.crearMateria = vi.fn(async () => ({ ok: false as const, error: 'red caída' }))
    const resultado = await sincronizarInvitado(datos, acciones)
    expect(resultado).toEqual({ ok: false, error: 'red caída', parcial: false })
  })

  it('devuelve error con `parcial: true` si falla a mitad de camino (ya se creó algo)', async () => {
    const datos = construirEscenario()
    const { acciones } = accionesFalsas()
    let llamadas = 0
    acciones.crearTarea = vi.fn(async () => {
      llamadas++
      if (llamadas === 2) return { ok: false as const, error: 'red caída a mitad' }
      return {
        ok: true as const,
        tareaCreada: { id: 'x', titulo: 't', materia_id: 'm', fecha_entrega: null, prioridad: 'media', completada: false, tipo: 'otro', temario: null, formato: null, peso: null, completada_en: null },
        avisoFecha: null,
        colisiones: [],
        posibleDuplicado: null,
      }
    })
    const resultado = await sincronizarInvitado(datos, acciones)
    expect(resultado).toEqual({ ok: false, error: 'red caída a mitad', parcial: true })
  })
})
