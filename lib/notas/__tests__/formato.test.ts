import { describe, expect, it } from 'vitest'
import { nombreDeAncla, filtrarNotasPorAncla, type ContextoNotas } from '../formato'
import type { Nota } from '../tipos'
import type { Materia, Tarea } from '@/lib/types'
import type { BloqueHorario } from '@/lib/horario/tipos'
import type { Archivo } from '@/lib/archivos/tipos'

function nota(overrides: Partial<Nota> = {}): Nota {
  return {
    id: 'n1',
    titulo: null,
    contenido: 'contenido',
    tarea_id: null,
    bloque_horario_id: null,
    archivo_id: null,
    materia_id: null,
    drive_file_id: null,
    drive_sync_error: null,
    creado_por: 'usuario',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

const MATEMATICAS: Materia = { id: 'mat-1', nombre: 'Matemáticas', color: '#FF6B4D', icono: 'Calculator' }

const TAREA: Tarea = {
  id: 'tarea-1',
  titulo: 'Examen final',
  materia_id: 'mat-1',
  fecha_entrega: '2026-08-10',
  prioridad: 'alta',
  completada: false,
  tipo: 'examen',
  temario: null,
  formato: null,
  peso: null,
  completada_en: null,
}

const BLOQUE_CLASE: BloqueHorario = {
  id: 'bloque-1',
  tipo: 'clase',
  materiaId: 'mat-1',
  diaSemana: 1,
  horaInicio: '08:00',
  horaFin: '09:00',
  aula: null,
  profesor: null,
}

const BLOQUE_INGRESO: BloqueHorario = {
  id: 'bloque-2',
  tipo: 'ingreso',
  materiaId: null,
  diaSemana: 1,
  horaInicio: '07:00',
  horaFin: null,
  aula: null,
  profesor: null,
}

const ARCHIVO: Archivo = {
  id: 'archivo-1',
  nombre: 'apunte.pdf',
  mime_type: 'application/pdf',
  tamano_bytes: 1000,
  tarea_id: null,
  materia_id: null,
  categoria: null,
  origen: 'usuario',
  drive_file_id: null,
  drive_web_view_link: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: null,
  resumen_ia: null,
  tipo_documento: null,
  tareas_detectadas: null,
  analizado_en: null,
  analisis_error: null,
  analisis_intentos: 0,
  ultima_apertura_en: null,
}

const contexto: ContextoNotas = {
  materias: [MATEMATICAS],
  tareas: [TAREA],
  horario: [BLOQUE_CLASE, BLOQUE_INGRESO],
  archivos: [ARCHIVO],
}

describe('nombreDeAncla', () => {
  it('nota de tarea → el título de la tarea real', () => {
    expect(nombreDeAncla(nota({ tarea_id: 'tarea-1' }), contexto)).toBe('Examen final')
  })

  it('nota de tarea que ya no existe → texto honesto, no rompe', () => {
    expect(nombreDeAncla(nota({ tarea_id: 'tarea-borrada' }), contexto)).toBe('Tarea eliminada')
  })

  it('nota de bloque tipo "clase" → nombre de la materia + día', () => {
    expect(nombreDeAncla(nota({ bloque_horario_id: 'bloque-1' }), contexto)).toBe('Matemáticas (Lun)')
  })

  it('nota de bloque especial (ingreso) → el label del tipo especial, no una materia', () => {
    expect(nombreDeAncla(nota({ bloque_horario_id: 'bloque-2' }), contexto)).toBe('Ingreso (Lun)')
  })

  it('nota de bloque que ya no existe → texto honesto', () => {
    expect(nombreDeAncla(nota({ bloque_horario_id: 'bloque-borrado' }), contexto)).toBe('Bloque eliminado')
  })

  it('nota de archivo → el nombre real del archivo', () => {
    expect(nombreDeAncla(nota({ archivo_id: 'archivo-1' }), contexto)).toBe('apunte.pdf')
  })

  it('nota de materia → el nombre real de la materia', () => {
    expect(nombreDeAncla(nota({ materia_id: 'mat-1' }), contexto)).toBe('Matemáticas')
  })

  it('nota suelta → "Sin asociar"', () => {
    expect(nombreDeAncla(nota(), contexto)).toBe('Sin asociar')
  })
})

describe('filtrarNotasPorAncla', () => {
  const notas = [
    nota({ id: 'n-tarea', tarea_id: 'tarea-1' }),
    nota({ id: 'n-bloque', bloque_horario_id: 'bloque-1' }),
    nota({ id: 'n-archivo', archivo_id: 'archivo-1' }),
    nota({ id: 'n-materia', materia_id: 'mat-1' }),
    nota({ id: 'n-suelta' }),
  ]

  it('"todas" no filtra nada', () => {
    expect(filtrarNotasPorAncla(notas, 'todas')).toHaveLength(5)
  })

  it('"tareas" solo deja las ancladas a tarea', () => {
    expect(filtrarNotasPorAncla(notas, 'tareas').map((n) => n.id)).toEqual(['n-tarea'])
  })

  it('"horario" solo deja las ancladas a bloque', () => {
    expect(filtrarNotasPorAncla(notas, 'horario').map((n) => n.id)).toEqual(['n-bloque'])
  })

  it('"archivos" solo deja las ancladas a archivo', () => {
    expect(filtrarNotasPorAncla(notas, 'archivos').map((n) => n.id)).toEqual(['n-archivo'])
  })

  it('"materias" solo deja las ancladas a materia', () => {
    expect(filtrarNotasPorAncla(notas, 'materias').map((n) => n.id)).toEqual(['n-materia'])
  })

  it('las notas sueltas nunca aparecen en ningún filtro específico', () => {
    for (const filtro of ['tareas', 'horario', 'archivos', 'materias'] as const) {
      expect(filtrarNotasPorAncla(notas, filtro).some((n) => n.id === 'n-suelta')).toBe(false)
    }
  })
})
