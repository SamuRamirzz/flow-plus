import { describe, expect, it } from 'vitest'
import { overlayFaseReducer, resumirDeteccion, estadoListaTareas, radioDeCaja, type OverlayFase } from '../overlayLogic'
import type { DetectedTask } from '@/lib/ai/agents/homework'
import type { Tarea } from '@/lib/types'

function tarea(overrides: Partial<DetectedTask> = {}): DetectedTask {
  return {
    id: 't1',
    titulo: 'Tarea',
    materia: 'Matemáticas',
    fecha: null,
    prioridad: 'media',
    tipo: 'ejercicios',
    confidence: 0.9,
    ...overrides,
  }
}

describe('overlayFaseReducer', () => {
  it('ABRIR pasa de idle a expanding', () => {
    expect(overlayFaseReducer('idle', { type: 'ABRIR' })).toBe('expanding')
  })

  it('ABRIR no hace nada si no está en idle', () => {
    expect(overlayFaseReducer('resultado', { type: 'ABRIR' })).toBe('resultado')
  })

  it('EXPANSION_LISTA solo avanza desde expanding', () => {
    expect(overlayFaseReducer('expanding', { type: 'EXPANSION_LISTA' })).toBe('loading')
    expect(overlayFaseReducer('idle', { type: 'EXPANSION_LISTA' })).toBe('idle')
  })

  it('REVELAR solo avanza desde loading', () => {
    expect(overlayFaseReducer('loading', { type: 'REVELAR' })).toBe('resultado')
    expect(overlayFaseReducer('expanding', { type: 'REVELAR' })).toBe('expanding')
  })

  it('CERRAR funciona desde cualquier fase activa, pero no repite ni cierra un overlay ya cerrado', () => {
    expect(overlayFaseReducer('expanding', { type: 'CERRAR' })).toBe('cerrando')
    expect(overlayFaseReducer('loading', { type: 'CERRAR' })).toBe('cerrando')
    expect(overlayFaseReducer('resultado', { type: 'CERRAR' })).toBe('cerrando')
    expect(overlayFaseReducer('idle', { type: 'CERRAR' })).toBe('idle')
    expect(overlayFaseReducer('cerrando', { type: 'CERRAR' })).toBe('cerrando')
  })

  it('CERRADO vuelve a idle solo desde cerrando', () => {
    expect(overlayFaseReducer('cerrando', { type: 'CERRADO' })).toBe('idle')
    expect(overlayFaseReducer('resultado', { type: 'CERRADO' })).toBe('resultado')
  })

  // Regresión: al navegar fuera de /ai y volver, app/ai/page.tsx se
  // desmonta y remonta — useReducer siempre arranca un nuevo montaje en
  // 'idle' (esto lo garantiza React, no el reducer). El riesgo real es
  // que un timer de la coreografía de la instancia ANTERIOR (que quedó
  // vivo por haberse desmontado a mitad de una fase) dispare una acción
  // tardía contra la instancia NUEVA si compartieran el mismo reducer —
  // lo cual no puede pasar porque cada montaje tiene su propio useReducer,
  // pero esta prueba deja documentado el contrato exacto que hace ese
  // escenario inofensivo incluso en el peor caso: un reducer fresco en
  // 'idle' ignora cualquier acción que no sea ABRIR, sin excepción.
  it('un reducer recién montado (idle) ignora cualquier acción "atrasada" salvo ABRIR', () => {
    const idle: OverlayFase = 'idle'
    expect(overlayFaseReducer(idle, { type: 'EXPANSION_LISTA' })).toBe('idle')
    expect(overlayFaseReducer(idle, { type: 'REVELAR' })).toBe('idle')
    expect(overlayFaseReducer(idle, { type: 'CERRAR' })).toBe('idle')
    expect(overlayFaseReducer(idle, { type: 'CERRADO' })).toBe('idle')
  })
})

describe('resumirDeteccion', () => {
  it('sin tareas, devuelve el mensaje de "no encontré nada"', () => {
    expect(resumirDeteccion([])).toMatch(/no logré identificar/i)
  })

  it('una sola tarea, la describe en singular', () => {
    const resumen = resumirDeteccion([tarea({ tipo: 'examen', materia: 'Historia' })])
    expect(resumen).toContain('un examen de Historia')
    expect(resumen).toContain('la tarea')
  })

  it('varias tareas, las une con "y" y pluraliza el cierre', () => {
    const resumen = resumirDeteccion([
      tarea({ tipo: 'ejercicios', materia: 'Matemáticas' }),
      tarea({ tipo: 'examen', materia: 'Historia' }),
    ])
    expect(resumen).toContain('unos ejercicios de Matemáticas')
    expect(resumen).toContain('y un examen de Historia')
    expect(resumen).toContain('las tareas')
  })

  it('tarea sin materia detectada, no la inventa', () => {
    const resumen = resumirDeteccion([tarea({ materia: null, tipo: 'lectura' })])
    expect(resumen).toContain('una lectura')
    expect(resumen).not.toContain('lectura de')
  })
})

describe('radioDeCaja — la caja se lee como píldora durante casi todo el recorrido', () => {
  // Medidas reales del botón y del viewport usados en la verificación.
  const H0 = 40
  const HF = 900
  // Ancho interpolado linealmente junto con el alto, como hace la animación.
  const anchoPara = (alto: number) => 165 + ((1440 - 165) * (alto - H0)) / (HF - H0)
  const radioEn = (alto: number) => radioDeCaja(anchoPara(alto), alto, H0, HF)
  // 1 = píldora perfecta (radio == mitad del lado menor); 0 = esquinas rectas.
  const pildorez = (alto: number) => radioEn(alto) / (Math.min(anchoPara(alto), alto) / 2)

  it('en reposo el botón es una píldora exacta', () => {
    expect(radioEn(H0)).toBeCloseTo(H0 / 2, 5)
    expect(pildorez(H0)).toBeCloseTo(1, 5)
  })

  it('a pantalla completa las esquinas son rectas', () => {
    expect(radioEn(HF)).toBeCloseTo(0, 5)
  })

  // Esta es la regresión de verdad: antes el radio se interpolaba de 20 a 0
  // por su cuenta, así que a mitad de camino la caja medía cientos de px de
  // alto con ~10px de radio (un cuadrado). Ahora, a mitad del recorrido debe
  // seguir leyéndose claramente como píldora.
  it('a mitad del recorrido sigue siendo inequívocamente redondeada, no un cuadrado', () => {
    expect(pildorez(H0 + (HF - H0) * 0.5)).toBeGreaterThan(0.9)
    const radioMedio = radioEn(H0 + (HF - H0) * 0.5)
    expect(radioMedio).toBeGreaterThan(150) // el viejo lineal daba ~10px acá
  })

  it('mantiene forma de píldora en la primera mitad y solo se aplana al final', () => {
    expect(pildorez(H0 + (HF - H0) * 0.25)).toBeGreaterThan(0.99)
    expect(pildorez(H0 + (HF - H0) * 0.75)).toBeGreaterThan(0.65)
    expect(pildorez(H0 + (HF - H0) * 0.97)).toBeLessThan(0.2)
  })

  it('nunca devuelve un radio negativo ni mayor a la mitad del lado menor', () => {
    for (let alto = H0; alto <= HF; alto += 10) {
      const r = radioEn(alto)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(Math.min(anchoPara(alto), alto) / 2 + 1e-9)
    }
  })
})

describe('estadoListaTareas — la columna/panel de tareas nunca queda en blanco', () => {
  const tareaReal: Tarea = {
    id: 'x1',
    titulo: 'Leer capítulo 3',
    materia_id: 'm1',
    fecha_entrega: null,
    prioridad: 'media',
    completada: false,
    tipo: 'otro',
    temario: null,
    formato: null,
    peso: null,
    completada_en: null,
  }

  it('mientras carga, devuelve "cargando"', () => {
    expect(estadoListaTareas({ cargando: true, tareas: null })).toBe('cargando')
    expect(estadoListaTareas({ cargando: true, tareas: [tareaReal] })).toBe('cargando')
  })

  it('sin datos todavía (null) devuelve "cargando", nunca un estado sin render', () => {
    expect(estadoListaTareas({ cargando: false, tareas: null })).toBe('cargando')
  })

  it('con lista vacía devuelve "vacio" (mensaje explícito), no nada', () => {
    expect(estadoListaTareas({ cargando: false, tareas: [] })).toBe('vacio')
  })

  it('con tareas devuelve "lista"', () => {
    expect(estadoListaTareas({ cargando: false, tareas: [tareaReal] })).toBe('lista')
  })

  // Regresión de la Parte A: antes, la columna "TAREAS" se quedaba en
  // blanco cuando HomeworkAgent fallaba (p. ej. GEMINI_API_KEY ausente),
  // porque su render colgaba del éxito de la IA. La garantía ahora es
  // estructural: esta función no recibe NADA del resultado de la IA, así
  // que su salida no puede depender de él. Para cualquier combinación de
  // entradas siempre cae en uno de los 3 estados renderizables.
  it('el estado no depende del resultado de la IA: siempre uno de los 3 casos renderizables', () => {
    const renderizables = ['cargando', 'vacio', 'lista']
    for (const cargando of [true, false]) {
      for (const tareas of [null, [], [tareaReal]] as Array<Tarea[] | null>) {
        expect(renderizables).toContain(estadoListaTareas({ cargando, tareas }))
      }
    }
  })
})
