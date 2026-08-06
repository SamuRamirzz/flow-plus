import { describe, it, expect } from 'vitest'
import type { Archivo } from '../tipos'
import {
  formatearTamano,
  porcentajeUsado,
  formatearUltimaApertura,
  formatearRelativo,
  familiaDeArchivo,
  sePuedePrevisualizar,
  etiquetaIA,
  tonoEtiquetaIA,
  pareceUnaPregunta,
  filtrarArchivos,
  contarPorCarpeta,
  mismaCarpeta,
} from '../formato'

function archivo(parcial: Partial<Archivo> = {}): Archivo {
  return {
    id: 'a1',
    nombre: 'documento.pdf',
    mime_type: 'application/pdf',
    tamano_bytes: 1024,
    tarea_id: null,
    materia_id: null,
    categoria: null,
    origen: 'usuario',
    drive_file_id: 'drive-1',
    drive_web_view_link: null,
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: null,
    resumen_ia: null,
    tipo_documento: null,
    tareas_detectadas: null,
    analizado_en: null,
    analisis_error: null,
    analisis_intentos: 0,
    ultima_apertura_en: null,
    ...parcial,
  }
}

describe('formatearTamano', () => {
  it('usa B/KB/MB/GB según la magnitud', () => {
    expect(formatearTamano(512)).toBe('512 B')
    expect(formatearTamano(856 * 1024)).toBe('856 KB')
    expect(formatearTamano(2.4 * 1024 * 1024)).toBe('2.4 MB')
    expect(formatearTamano(3 * 1024 * 1024 * 1024)).toBe('3.0 GB')
  })

  it('un tamaño desconocido es un guion, nunca "0 B"', () => {
    expect(formatearTamano(null)).toBe('—')
    expect(formatearTamano(-1)).toBe('—')
  })
})

describe('porcentajeUsado', () => {
  it('calcula el porcentaje real', () => {
    expect(porcentajeUsado(50, 200)).toBe(25)
  })

  it('acota a 100 cuando Drive reporta usado > total (cuota compartida)', () => {
    expect(porcentajeUsado(300, 200)).toBe(100)
  })

  it('un total de 0 no explota ni devuelve NaN', () => {
    expect(porcentajeUsado(10, 0)).toBe(0)
  })
})

describe('formatearUltimaApertura', () => {
  const ahora = new Date(2026, 7, 6, 15, 0, 0) // 6 ago 2026, 15:00 local

  it('distingue hoy, ayer y una fecha más vieja', () => {
    expect(formatearUltimaApertura(new Date(2026, 7, 6, 9, 41).toISOString(), ahora)).toBe('Hoy, 09:41')
    expect(formatearUltimaApertura(new Date(2026, 7, 5, 16, 22).toISOString(), ahora)).toBe('Ayer, 16:22')
    expect(formatearUltimaApertura(new Date(2026, 6, 18, 8, 0).toISOString(), ahora)).toBe('18 jul 2026')
  })

  it('respeta la preferencia de reloj de 12h', () => {
    expect(formatearUltimaApertura(new Date(2026, 7, 6, 16, 22).toISOString(), ahora, '12h')).toBe('Hoy, 4:22 p. m.')
  })

  it('un archivo nunca abierto es un guion', () => {
    expect(formatearUltimaApertura(null, ahora)).toBe('—')
  })
})

describe('formatearRelativo', () => {
  const ahora = new Date(2026, 7, 6, 15, 0, 0)

  it('va de "Recién" a la fecha corta', () => {
    expect(formatearRelativo(new Date(2026, 7, 6, 14, 59).toISOString(), ahora)).toBe('Hace 1 min')
    expect(formatearRelativo(new Date(2026, 7, 6, 13, 0).toISOString(), ahora)).toBe('Hace 2 horas')
    expect(formatearRelativo(new Date(2026, 7, 5, 10, 0).toISOString(), ahora)).toBe('Ayer')
    expect(formatearRelativo(new Date(2026, 6, 18, 10, 0).toISOString(), ahora)).toBe('18 jul')
  })
})

describe('familiaDeArchivo', () => {
  it('clasifica por MIME', () => {
    expect(familiaDeArchivo('application/pdf')).toBe('pdf')
    expect(familiaDeArchivo('image/png')).toBe('imagen')
    expect(familiaDeArchivo('text/markdown')).toBe('texto')
    expect(familiaDeArchivo('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('documento')
    expect(familiaDeArchivo('text/calendar')).toBe('calendario')
  })

  it('cae a la extensión cuando Storage entrega octet-stream', () => {
    expect(familiaDeArchivo('application/octet-stream', 'Apuntes de clase.md')).toBe('texto')
    expect(familiaDeArchivo('application/octet-stream', 'Horario - Semestre 2.ics')).toBe('calendario')
    expect(familiaDeArchivo(null, 'Revolución Francesa.docx')).toBe('documento')
  })

  it('lo que no reconoce es "otro", nunca un falso positivo', () => {
    expect(familiaDeArchivo('application/zip', 'cosas.zip')).toBe('otro')
  })
})

describe('sePuedePrevisualizar', () => {
  it('acepta pdf, imagen y texto', () => {
    expect(sePuedePrevisualizar('application/pdf')).toBe(true)
    expect(sePuedePrevisualizar('image/png')).toBe(true)
    expect(sePuedePrevisualizar('text/plain')).toBe(true)
  })

  it('rechaza .docx — es un ZIP de XML, no renderizable sin dependencia pesada', () => {
    expect(sePuedePrevisualizar(null, 'Revolución Francesa.docx')).toBe(false)
  })
})

describe('etiquetaIA', () => {
  it('sin analizar todavía no inventa una etiqueta', () => {
    expect(etiquetaIA(archivo())).toBeNull()
  })

  it('distingue "no analizado" de "se intentó y falló"', () => {
    expect(etiquetaIA(archivo({ analisis_error: 'formato no soportado' }))).toBe('No se pudo analizar')
  })

  it('prioriza las tareas detectadas sobre todo lo demás', () => {
    const a = archivo({
      analizado_en: '2026-08-06T10:00:00.000Z',
      tipo_documento: 'examen',
      resumen_ia: 'algo',
      tareas_detectadas: [
        { id: '1', titulo: 'a', materia: null, fecha: null, prioridad: 'media', tipo: 'tarea', confidence: 1 },
        { id: '2', titulo: 'b', materia: null, fecha: null, prioridad: 'media', tipo: 'tarea', confidence: 1 },
        { id: '3', titulo: 'c', materia: null, fecha: null, prioridad: 'media', tipo: 'tarea', confidence: 1 },
      ],
    })
    expect(etiquetaIA(a)).toBe('3 tareas detectadas')
  })

  it('singulariza una sola tarea', () => {
    const a = archivo({
      analizado_en: '2026-08-06T10:00:00.000Z',
      tareas_detectadas: [{ id: '1', titulo: 'a', materia: null, fecha: null, prioridad: 'media', tipo: 'tarea', confidence: 1 }],
    })
    expect(etiquetaIA(a)).toBe('1 tarea detectada')
  })

  // Esta cadena de prioridades es EXACTAMENTE la de app/api/archivos/actividad/route.ts.
  // Si el servidor cambia su criterio, este test es el que se rompe primero.
  it('replica la cadena de prioridades del servidor', () => {
    const base = { analizado_en: '2026-08-06T10:00:00.000Z', tareas_detectadas: [] }
    expect(etiquetaIA(archivo({ ...base, tipo_documento: 'examen' }))).toBe('Examen encontrado')
    expect(etiquetaIA(archivo({ ...base, tipo_documento: 'horario' }))).toBe('Horario analizado')
    expect(etiquetaIA(archivo({ ...base, tipo_documento: 'guia', resumen_ia: 'x' }))).toBe('Resumen disponible')
    expect(etiquetaIA(archivo({ ...base, tipo_documento: 'guia' }))).toBe('Texto analizado')
  })
})

describe('tonoEtiquetaIA', () => {
  it('marca como accionable lo que el usuario puede convertir en algo', () => {
    expect(tonoEtiquetaIA('3 tareas detectadas')).toBe('accion')
    expect(tonoEtiquetaIA('Examen encontrado')).toBe('accion')
    expect(tonoEtiquetaIA('Resumen disponible')).toBe('info')
    expect(tonoEtiquetaIA('No se pudo analizar')).toBe('error')
    expect(tonoEtiquetaIA(null)).toBe('ninguno')
  })
})

describe('pareceUnaPregunta', () => {
  it('detecta preguntas explícitas', () => {
    expect(pareceUnaPregunta('¿cuándo es mi examen de cálculo?')).toBe(true)
    expect(pareceUnaPregunta('que temas entran en el parcial')).toBe(true)
    expect(pareceUnaPregunta('resume mis apuntes de historia')).toBe(true)
  })

  it('no dispara con un nombre de archivo', () => {
    expect(pareceUnaPregunta('Integrales')).toBe(false)
    expect(pareceUnaPregunta('quimica')).toBe(false)
    expect(pareceUnaPregunta('cuentas')).toBe(false)
  })

  it('no dispara con una palabra interrogativa suelta — es prefijo legítimo de un nombre', () => {
    expect(pareceUnaPregunta('que')).toBe(false)
    expect(pareceUnaPregunta('como hacer')).toBe(false)
  })
})

describe('filtrarArchivos', () => {
  const archivos = [
    archivo({ id: '1', nombre: 'Integrales.pdf', mime_type: 'application/pdf', materia_id: 'mat' }),
    archivo({ id: '2', nombre: 'Atomo.png', mime_type: 'image/png', materia_id: 'qui' }),
    archivo({ id: '3', nombre: 'Apuntes.md', mime_type: 'text/markdown', materia_id: null }),
    archivo({ id: '4', nombre: 'Horario.ics', mime_type: 'text/calendar', tipo_documento: 'horario', analizado_en: '2026-08-01T00:00:00.000Z' }),
  ]

  it('carpeta, chip y texto se combinan en AND', () => {
    const r = filtrarArchivos(archivos, { tipo: 'materia', materiaId: 'mat' }, 'pdf', 'integ')
    expect(r.map((a) => a.id)).toEqual(['1'])
  })

  it('elegir un chip no borra la carpeta seleccionada', () => {
    const r = filtrarArchivos(archivos, { tipo: 'materia', materiaId: 'qui' }, 'imagen', '')
    expect(r.map((a) => a.id)).toEqual(['2'])
  })

  it('la carpeta "sin materia" es un filtro real, no un vacío', () => {
    const r = filtrarArchivos(archivos, { tipo: 'sin-materia' }, 'todos', '')
    expect(r.map((a) => a.id)).toEqual(['3', '4'])
  })

  it('la búsqueda ignora acentos y mayúsculas', () => {
    const conAcento = [archivo({ id: 'x', nombre: 'Revolución Francesa.docx' })]
    expect(filtrarArchivos(conAcento, { tipo: 'todos' }, 'todos', 'revolucion')).toHaveLength(1)
  })

  it('la búsqueda también mira el resumen de la IA', () => {
    const conResumen = [archivo({ id: 'y', nombre: 'sin-pistas.pdf', resumen_ia: 'Trata sobre integrales por sustitución' })]
    expect(filtrarArchivos(conResumen, { tipo: 'todos' }, 'todos', 'sustitucion')).toHaveLength(1)
  })

  it('una búsqueda vacía devuelve todo, nunca nada', () => {
    expect(filtrarArchivos(archivos, { tipo: 'todos' }, 'todos', '   ')).toHaveLength(4)
  })
})

describe('contarPorCarpeta / mismaCarpeta', () => {
  const archivos = [archivo({ id: '1', materia_id: 'mat' }), archivo({ id: '2', materia_id: 'mat' }), archivo({ id: '3', materia_id: null })]

  it('cuenta por carpeta', () => {
    expect(contarPorCarpeta(archivos, { tipo: 'materia', materiaId: 'mat' })).toBe(2)
    expect(contarPorCarpeta(archivos, { tipo: 'sin-materia' })).toBe(1)
    expect(contarPorCarpeta(archivos, { tipo: 'todos' })).toBe(3)
  })

  it('dos carpetas de materia distintas no son la misma', () => {
    expect(mismaCarpeta({ tipo: 'materia', materiaId: 'a' }, { tipo: 'materia', materiaId: 'b' })).toBe(false)
    expect(mismaCarpeta({ tipo: 'materia', materiaId: 'a' }, { tipo: 'materia', materiaId: 'a' })).toBe(true)
    expect(mismaCarpeta({ tipo: 'todos' }, { tipo: 'analizados' })).toBe(false)
  })
})
