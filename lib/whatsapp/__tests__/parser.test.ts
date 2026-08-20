import { describe, it, expect } from 'vitest'
import { parsearComando } from '../parser'

// Miércoles 2026-08-19, mismo ancla que fechaNatural.test.ts.
const HOY = '2026-08-19'

describe('parsearComando — /tarea', () => {
  it('parsea el ejemplo completo del catálogo', () => {
    expect(parsearComando('/tarea Ensayo de historia, mañana, historia, alta', HOY)).toEqual({
      tipo: 'crear_tarea',
      titulo: 'Ensayo de historia',
      fecha: '2026-08-20',
      materia: 'historia',
      prioridad: 'alta',
    })
  })

  it('conserva mayúsculas y acentos del título tal como los escribió el usuario', () => {
    const r = parsearComando('/tarea Análisis de Índices Bursátiles, hoy', HOY)
    expect(r).toMatchObject({ tipo: 'crear_tarea', titulo: 'Análisis de Índices Bursátiles' })
  })

  it('acepta solo el título, sin argumentos', () => {
    expect(parsearComando('/tarea Leer capítulo 4', HOY)).toEqual({
      tipo: 'crear_tarea',
      titulo: 'Leer capítulo 4',
      fecha: null,
      materia: null,
      prioridad: null,
    })
  })

  it('clasifica por vocabulario, no por posición: prioridad sin fecha', () => {
    expect(parsearComando('/tarea Ensayo, alta', HOY)).toEqual({
      tipo: 'crear_tarea',
      titulo: 'Ensayo',
      fecha: null,
      materia: null,
      prioridad: 'alta',
    })
  })

  it('clasifica correctamente aunque el orden esté invertido', () => {
    expect(parsearComando('/tarea Ensayo, alta, biología, viernes', HOY)).toEqual({
      tipo: 'crear_tarea',
      titulo: 'Ensayo',
      fecha: '2026-08-21',
      materia: 'biología',
      prioridad: 'alta',
    })
  })

  it('tolera espacios extra alrededor de las comas', () => {
    expect(parsearComando('/tarea   Ensayo   ,   mañana   ,   alta  ', HOY)).toMatchObject({
      titulo: 'Ensayo',
      fecha: '2026-08-20',
      prioridad: 'alta',
    })
  })

  it('tolera el comando en mayúsculas', () => {
    expect(parsearComando('/TAREA Ensayo, hoy', HOY)).toMatchObject({ tipo: 'crear_tarea', titulo: 'Ensayo' })
  })

  it('un texto que no es ni fecha ni prioridad se toma como materia', () => {
    expect(parsearComando('/tarea Ensayo, Química Orgánica', HOY)).toMatchObject({
      materia: 'Química Orgánica',
      fecha: null,
      prioridad: null,
    })
  })

  it('ignora un segundo sobrante en vez de inventar una materia compuesta', () => {
    expect(parsearComando('/tarea Ensayo, biología, xyz', HOY)).toMatchObject({ materia: 'biología' })
  })

  it('rechaza /tarea sin nada', () => {
    expect(parsearComando('/tarea', HOY)).toEqual({
      tipo: 'no_reconocido',
      mensajeOriginal: '/tarea',
      motivo: 'faltan_datos',
    })
  })

  it('rechaza /tarea con título vacío', () => {
    expect(parsearComando('/tarea   , mañana', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'faltan_datos' })
  })
})

describe('parsearComando — /completar', () => {
  it('toma todo el resto como búsqueda', () => {
    expect(parsearComando('/completar ensayo historia', HOY)).toEqual({
      tipo: 'completar_tarea',
      busqueda: 'ensayo historia',
    })
  })

  it('rechaza sin argumento', () => {
    expect(parsearComando('/completar', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'faltan_datos' })
  })
})

describe('parsearComando — /tareas', () => {
  it('sin argumento usa hoy como default', () => {
    expect(parsearComando('/tareas', HOY)).toEqual({ tipo: 'listar_tareas', rango: 'hoy' })
  })

  it('acepta los 3 rangos', () => {
    expect(parsearComando('/tareas hoy', HOY)).toMatchObject({ rango: 'hoy' })
    expect(parsearComando('/tareas semana', HOY)).toMatchObject({ rango: 'semana' })
    expect(parsearComando('/tareas todas', HOY)).toMatchObject({ rango: 'todas' })
  })

  it('un rango inexistente NO cae a hoy en silencio', () => {
    expect(parsearComando('/tareas mes', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'faltan_datos' })
  })
})

describe('parsearComando — /horario', () => {
  it('sin argumento es hoy (dia null)', () => {
    expect(parsearComando('/horario', HOY)).toEqual({ tipo: 'ver_horario', dia: null })
    expect(parsearComando('/horario hoy', HOY)).toEqual({ tipo: 'ver_horario', dia: null })
  })

  it('acepta un nombre de día y lo devuelve en convención ISO', () => {
    expect(parsearComando('/horario lunes', HOY)).toEqual({ tipo: 'ver_horario', dia: 1 })
    expect(parsearComando('/horario Domingo', HOY)).toEqual({ tipo: 'ver_horario', dia: 7 })
  })

  it('resuelve "mañana" al día de la semana correspondiente', () => {
    // Hoy miércoles (3) → mañana es jueves (4).
    expect(parsearComando('/horario mañana', HOY)).toEqual({ tipo: 'ver_horario', dia: 4 })
  })

  it('rechaza un argumento que no es día ni fecha', () => {
    expect(parsearComando('/horario cuando sea', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'faltan_datos' })
  })
})

describe('parsearComando — /nota', () => {
  it('parsea el ejemplo del catálogo', () => {
    expect(parsearComando('/nota materia biología, revisar capítulo 5 antes del examen', HOY)).toEqual({
      tipo: 'crear_nota',
      contexto: 'materia',
      nombre: 'biología',
      contenido: 'revisar capítulo 5 antes del examen',
    })
  })

  it('acepta los 3 contextos', () => {
    expect(parsearComando('/nota tarea Ensayo, ojo con las citas', HOY)).toMatchObject({ contexto: 'tarea' })
    expect(parsearComando('/nota horario Cálculo, cambió de salón', HOY)).toMatchObject({ contexto: 'horario' })
    expect(parsearComando('/nota materia Física, traer calculadora', HOY)).toMatchObject({ contexto: 'materia' })
  })

  it('conserva comas dentro del contenido', () => {
    expect(parsearComando('/nota materia Física, traer calculadora, regla y compás', HOY)).toMatchObject({
      contenido: 'traer calculadora, regla y compás',
    })
  })

  it('rechaza si falta la coma separadora', () => {
    expect(parsearComando('/nota materia biología', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'faltan_datos' })
  })

  it('rechaza si falta el contenido', () => {
    expect(parsearComando('/nota materia biología,   ', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'faltan_datos' })
  })

  it('rechaza un contexto desconocido', () => {
    expect(parsearComando('/nota archivo algo, contenido', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'faltan_datos' })
  })

  it('rechaza si falta el nombre del ancla', () => {
    expect(parsearComando('/nota materia, contenido', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'faltan_datos' })
  })
})

describe('parsearComando — comandos simples', () => {
  it('/proximo', () => {
    expect(parsearComando('/proximo', HOY)).toEqual({ tipo: 'proximo_evento' })
    expect(parsearComando('/próximo', HOY)).toEqual({ tipo: 'proximo_evento' })
  })

  it('/ayuda', () => {
    expect(parsearComando('/ayuda', HOY)).toEqual({ tipo: 'ayuda' })
    expect(parsearComando('  /AYUDA  ', HOY)).toEqual({ tipo: 'ayuda' })
  })
})

describe('parsearComando — no reconocido', () => {
  it('distingue texto sin comando', () => {
    expect(parsearComando('hola, cómo estás', HOY)).toEqual({
      tipo: 'no_reconocido',
      mensajeOriginal: 'hola, cómo estás',
      motivo: 'sin_comando',
    })
  })

  it('distingue un comando que no existe', () => {
    expect(parsearComando('/borrar todo', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'comando_desconocido' })
  })

  it('maneja casos límite sin lanzar', () => {
    expect(parsearComando('', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'sin_comando' })
    expect(parsearComando('   ', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'sin_comando' })
    expect(parsearComando('/', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'comando_desconocido' })
    expect(parsearComando('//', HOY)).toMatchObject({ tipo: 'no_reconocido', motivo: 'comando_desconocido' })
  })

  it('nunca interpreta lenguaje natural como un comando', () => {
    // El punto central del canal: sin "/" no hay ejecución, pase lo que pase.
    expect(parsearComando('crea una tarea de historia para mañana', HOY)).toMatchObject({ motivo: 'sin_comando' })
  })
})
