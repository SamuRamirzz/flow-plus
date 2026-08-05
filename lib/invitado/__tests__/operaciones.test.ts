import { describe, expect, it } from 'vitest'
import {
  crearMateriaPura,
  crearTareaPura,
  actualizarTareaPura,
  eliminarTareaPura,
  agregarBloquePura,
  actualizarBloquePura,
  eliminarBloquePura,
} from '../operaciones'
import { datosInvitadoVacios } from '../tipos'

const VACIO = datosInvitadoVacios('guest-1')

describe('crearMateriaPura', () => {
  it('crea una materia nueva con ícono determinístico y color por índice', () => {
    const { datos, materia } = crearMateriaPura(VACIO, 'Cálculo II')
    expect(datos.materias).toHaveLength(1)
    expect(materia.nombre).toBe('Cálculo II')
    expect(materia.icono).toBe('Calculator')
    expect(materia.color).toBeTruthy()
  })

  it('cae al ícono por defecto cuando el nombre no matchea ningún patrón', () => {
    const { materia } = crearMateriaPura(VACIO, 'Xilofonía Avanzada 9000')
    expect(materia.icono).toBe('GraduationCap')
  })

  it('deduplica por nombre normalizado (sin acentos, sin distinguir mayúsculas)', () => {
    const primero = crearMateriaPura(VACIO, 'Física')
    const segundo = crearMateriaPura(primero.datos, 'fisica')
    expect(segundo.datos.materias).toHaveLength(1)
    expect(segundo.materia.id).toBe(primero.materia.id)
  })

  it('asigna colores distintos por índice a materias sucesivas', () => {
    const uno = crearMateriaPura(VACIO, 'Historia')
    const dos = crearMateriaPura(uno.datos, 'Geografía')
    expect(dos.materia.color).not.toBe(uno.materia.color)
  })
})

describe('crearTareaPura', () => {
  it('crea la tarea con una materia ya existente', () => {
    const { datos: conMateria, materia } = crearMateriaPura(VACIO, 'Álgebra')
    const resultado = crearTareaPura(conMateria, { titulo: 'Tarea 1', materiaId: materia.id, nuevaMateria: null, fecha: '2026-09-01', prioridad: 'alta' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.tarea.materia_id).toBe(materia.id)
    expect(resultado.tarea.completada).toBe(false)
    expect(resultado.materiaCreada).toBeNull()
  })

  it('crea la materia inline cuando se manda nuevaMateria', () => {
    const resultado = crearTareaPura(VACIO, { titulo: 'Tarea 1', materiaId: null, nuevaMateria: 'Biología', fecha: '', prioridad: 'media' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.datos.materias).toHaveLength(1)
    expect(resultado.materiaCreada?.nombre).toBe('Biología')
    expect(resultado.tarea.materia_id).toBe(resultado.datos.materias[0].id)
  })

  it('no marca materiaCreada si nuevaMateria ya existía (dedup)', () => {
    const { datos: conMateria } = crearMateriaPura(VACIO, 'Química')
    const resultado = crearTareaPura(conMateria, { titulo: 'Lab', materiaId: null, nuevaMateria: 'quimica', fecha: '', prioridad: 'baja' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.materiaCreada).toBeNull()
    expect(resultado.datos.materias).toHaveLength(1)
  })

  it('devuelve error si no hay materiaId ni nuevaMateria', () => {
    const resultado = crearTareaPura(VACIO, { titulo: 'Tarea', materiaId: null, nuevaMateria: null, fecha: '', prioridad: 'media' })
    expect(resultado.ok).toBe(false)
  })

  it('fecha vacía se guarda como null, tipo por defecto es "otro"', () => {
    const { datos } = crearMateriaPura(VACIO, 'Arte')
    const resultado = crearTareaPura(datos, { titulo: 'T', materiaId: datos.materias[0].id, nuevaMateria: null, fecha: '', prioridad: 'baja' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.tarea.fecha_entrega).toBeNull()
    expect(resultado.tarea.tipo).toBe('otro')
  })
})

describe('actualizarTareaPura', () => {
  function conUnaTarea() {
    const { datos: conMateria, materia } = crearMateriaPura(VACIO, 'Filosofía')
    const r = crearTareaPura(conMateria, { titulo: 'Ensayo', materiaId: materia.id, nuevaMateria: null, fecha: '2026-09-01', prioridad: 'media' })
    if (!r.ok) throw new Error('setup falló')
    return { datos: r.datos, tarea: r.tarea, materia }
  }

  it('devuelve null si el id no existe', () => {
    expect(actualizarTareaPura(VACIO, 'no-existe', { titulo: 'x' })).toBeNull()
  })

  it('marca completada por primera vez y pone completada_en', () => {
    const { datos, tarea } = conUnaTarea()
    const resultado = actualizarTareaPura(datos, tarea.id, { completada: true })
    expect(resultado?.tarea.completada).toBe(true)
    expect(resultado?.tarea.completada_en).not.toBeNull()
  })

  it('no pisa completada_en si ya estaba completada', () => {
    const { datos, tarea } = conUnaTarea()
    const primerToggle = actualizarTareaPura(datos, tarea.id, { completada: true })!
    const fechaOriginal = primerToggle.tarea.completada_en
    const segundoToggle = actualizarTareaPura(primerToggle.datos, tarea.id, { completada: true })!
    expect(segundoToggle.tarea.completada_en).toBe(fechaOriginal)
  })

  it('limpia completada_en al volver a pendiente', () => {
    const { datos, tarea } = conUnaTarea()
    const completada = actualizarTareaPura(datos, tarea.id, { completada: true })!
    const pendiente = actualizarTareaPura(completada.datos, tarea.id, { completada: false })!
    expect(pendiente.tarea.completada_en).toBeNull()
  })

  it('editar título no toca otros campos', () => {
    const { datos, tarea } = conUnaTarea()
    const resultado = actualizarTareaPura(datos, tarea.id, { titulo: 'Nuevo título' })!
    expect(resultado.tarea.titulo).toBe('Nuevo título')
    expect(resultado.tarea.fecha_entrega).toBe(tarea.fecha_entrega)
  })

  it('nuevaMateria en cambios crea/dedupe igual que al crear', () => {
    const { datos, tarea } = conUnaTarea()
    const resultado = actualizarTareaPura(datos, tarea.id, { nuevaMateria: 'Ética' })!
    expect(resultado.datos.materias).toHaveLength(2)
    expect(resultado.tarea.materia_id).toBe(resultado.datos.materias[1].id)
  })
})

describe('eliminarTareaPura', () => {
  it('elimina la tarea y la devuelve', () => {
    const { datos: conMateria, materia } = crearMateriaPura(VACIO, 'Música')
    const r = crearTareaPura(conMateria, { titulo: 'Practicar', materiaId: materia.id, nuevaMateria: null, fecha: '', prioridad: 'baja' })
    if (!r.ok) throw new Error('setup falló')
    const resultado = eliminarTareaPura(r.datos, r.tarea.id)
    expect(resultado?.tareaEliminada.id).toBe(r.tarea.id)
    expect(resultado?.datos.tareas).toHaveLength(0)
  })

  it('devuelve null si el id no existe', () => {
    expect(eliminarTareaPura(VACIO, 'no-existe')).toBeNull()
  })
})

describe('bloques de horario', () => {
  it('agrega un bloque nuevo', () => {
    const { datos } = agregarBloquePura(VACIO, { materiaId: 'm1', diaSemana: 1, horaInicio: '08:00', horaFin: '09:00' })
    expect(datos.horario).toHaveLength(1)
  })

  it('actualiza un bloque existente', () => {
    const { datos, bloque } = agregarBloquePura(VACIO, { materiaId: 'm1', diaSemana: 1, horaInicio: '08:00', horaFin: '09:00' })
    const resultado = actualizarBloquePura(datos, bloque.id, { horaInicio: '10:00' })
    expect(resultado?.bloque.horaInicio).toBe('10:00')
    expect(resultado?.bloque.horaFin).toBe('09:00')
  })

  it('devuelve null al actualizar un bloque inexistente', () => {
    expect(actualizarBloquePura(VACIO, 'no-existe', { horaInicio: '10:00' })).toBeNull()
  })

  it('elimina un bloque', () => {
    const { datos, bloque } = agregarBloquePura(VACIO, { materiaId: 'm1', diaSemana: 2, horaInicio: null, horaFin: null })
    const resultado = eliminarBloquePura(datos, bloque.id)
    expect(resultado?.horario).toHaveLength(0)
  })

  it('devuelve null al eliminar un bloque inexistente', () => {
    expect(eliminarBloquePura(VACIO, 'no-existe')).toBeNull()
  })
})
