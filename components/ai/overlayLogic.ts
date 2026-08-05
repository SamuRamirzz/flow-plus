import type { DetectedTask, HomeworkTaskType } from '@/lib/ai/agents/homework'
import type { OperacionTarea } from '@/lib/ai/agents/taskManagement'
import type { Tarea } from '@/lib/types'

export type OverlayFase = 'idle' | 'expanding' | 'loading' | 'resultado' | 'cerrando'

export type OverlayAction =
  | { type: 'ABRIR' }
  | { type: 'EXPANSION_LISTA' }
  | { type: 'REVELAR' }
  | { type: 'CERRAR' }
  | { type: 'CERRADO' }

// Duraciones (ms) de la coreografía del overlay — ver AIImmersiveOverlay.tsx.
// Fase 1: expansión de la caja desde el rect del botón hasta pantalla
// completa. Fase 2: vacío negro intencional antes de revelar nada. Al
// cerrar, el contenido se desvanece durante CIERRE_CONTENIDO_MS y recién
// entonces se desmonta el overlay; el colapso de la caja lo hace la
// animación de `exit` y AnimatePresence espera a que termine sola — por
// eso el colapso NO tiene una duración fija acá (es un spring).
export const FASE1_EXPANSION_MS = 620
export const FASE2_VACIO_MS = 200
export const CIERRE_CONTENIDO_MS = 200

// Rect del botón "Analizar con IA" medido en el momento del clic — es el
// origen y el destino de la animación de caja del overlay. Se mide siempre
// en vivo (getBoundingClientRect) y no se asume ninguna posición fija: el
// botón cambia de lugar cuando la página se reacomoda a dos columnas.
export type RectOrigen = { top: number; left: number; width: number; height: number }

// Radio de la píldora en píxeles reales. NO usar un número gigante tipo
// 9999 "para que el navegador lo clampee": Framer Motion convierte el
// borderRadius declarado a porcentaje de la caja al animar, y 9999px sobre
// un botón de 165x40 se convierte en 6060%/24997% — un valor que ya no
// significa nada cuando la caja crece a pantalla completa. Con un valor
// finito real (la mitad de la altura del botón) la interpolación es
// coherente en todos los tamaños intermedios.
export const RADIO_PILDORA = 20

// Radio de la caja del overlay en cada frame de la animación.
//
// Interpolar el radio linealmente de 20 a 0 (lo que hacíamos antes) hace
// que la forma deje de leerse como píldora casi de inmediato: a los pocos
// frames la caja ya mide cientos de píxeles de alto con un radio de ~15px,
// que es visualmente un cuadrado. Acá el radio se deriva del TAMAÑO actual:
// mientras la caja crece sigue siendo una píldora perfecta (radio = mitad
// del lado menor) y solo se aplana al final del recorrido, para aterrizar
// en las esquinas rectas de la pantalla completa.
export function radioDeCaja(ancho: number, alto: number, altoInicial: number, altoFinal: number): number {
  const pildora = Math.min(ancho, alto) / 2
  const rango = Math.max(1, altoFinal - altoInicial)
  const progreso = Math.min(1, Math.max(0, (alto - altoInicial) / rango))
  // Exponente alto = se mantiene píldora casi todo el trayecto y se aplana
  // de golpe al final, en vez de degradarse desde el primer frame.
  return pildora * (1 - progreso ** 4)
}

// Estado de la columna/panel de tareas. Es a propósito una unión cerrada
// de 3 casos y NO recibe nada del resultado de la IA: es imposible, por
// construcción, que quede "sin estado" cuando HomeworkAgent falla.
export type EstadoListaTareas = 'cargando' | 'vacio' | 'lista'

export function estadoListaTareas({ cargando, tareas }: { cargando: boolean; tareas: Tarea[] | null }): EstadoListaTareas {
  if (cargando || tareas === null) return 'cargando'
  return tareas.length === 0 ? 'vacio' : 'lista'
}

// Estado del overlay inmersivo. app/ai/page.tsx es quien lo posee (vía
// useReducer) y quien dispara las transiciones con temporizadores — este
// reducer solo valida que cada transición ocurra desde la fase que le
// corresponde, para que un timer que dispare fuera de orden (ej. un cierre
// mientras todavía se está expandiendo) no deje el overlay en un estado
// inconsistente.
export function overlayFaseReducer(fase: OverlayFase, action: OverlayAction): OverlayFase {
  switch (action.type) {
    case 'ABRIR':
      return fase === 'idle' ? 'expanding' : fase
    case 'EXPANSION_LISTA':
      return fase === 'expanding' ? 'loading' : fase
    case 'REVELAR':
      return fase === 'loading' ? 'resultado' : fase
    case 'CERRAR':
      return fase === 'idle' || fase === 'cerrando' ? fase : 'cerrando'
    case 'CERRADO':
      return fase === 'cerrando' ? 'idle' : fase
    default:
      return fase
  }
}

const TIPO_LABEL: Record<HomeworkTaskType, string> = {
  ejercicios: 'unos ejercicios',
  examen: 'un examen',
  ensayo: 'un ensayo',
  lectura: 'una lectura',
  proyecto: 'un proyecto',
  otro: 'una tarea',
}

// Resume en una frase lo que la IA entendió del texto — compuesto acá, en
// la capa de presentación, a partir de los campos estructurados que ya
// devuelve HomeworkAgent (tipo/materia por tarea detectada). No es una
// segunda llamada al modelo ni un campo nuevo del contrato: es solo una
// lectura más legible de datos que ya existen, para la columna izquierda
// del overlay ("respuesta/análisis de la IA").
export function resumirDeteccion(tareas: DetectedTask[]): string {
  if (tareas.length === 0) return 'No logré identificar ninguna tarea en ese texto.'

  const descripciones = tareas.map((t) => {
    const base = TIPO_LABEL[t.tipo]
    return t.materia ? `${base} de ${t.materia}` : base
  })

  const lista =
    descripciones.length === 1
      ? descripciones[0]
      : `${descripciones.slice(0, -1).join(', ')} y ${descripciones[descripciones.length - 1]}`

  return `Encontré ${lista}. Revisa los detalles antes de crear ${tareas.length === 1 ? 'la tarea' : 'las tareas'}.`
}

// Contraparte de resumirDeteccion() para TaskManagementAgent (Sprint 7.1
// Parte 2) — el resultado ahora puede mezclar crear/modificar/borrar en el
// mismo texto, así que la frase se arma contando cada tipo en vez de listar
// tareas una por una.
export function resumirOperaciones(operaciones: OperacionTarea[]): string {
  const crear = operaciones.filter((o) => o.tipo === 'crear').length
  const modificar = operaciones.filter((o) => o.tipo === 'modificar').length
  const borrar = operaciones.filter((o) => o.tipo === 'borrar').length
  const porResolver = operaciones.filter((o) => o.tipo === 'ambiguo').length
  const sinCoincidencias = operaciones.filter((o) => o.tipo === 'sin_coincidencias').length

  const partes: string[] = []
  if (crear > 0) partes.push(`crear ${crear} ${crear === 1 ? 'tarea' : 'tareas'}`)
  if (modificar > 0) partes.push(`modificar ${modificar}`)
  if (borrar > 0) partes.push(`borrar ${borrar}`)
  if (porResolver > 0) partes.push(`${porResolver} por aclarar`)

  if (partes.length === 0) {
    return sinCoincidencias > 0
      ? 'No encontré ninguna tarea que coincida con lo que pediste.'
      : 'No entendí qué querías hacer con tus tareas — intenta ser más específico.'
  }

  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
  return `Quieres ${lista}. Revisa los detalles antes de aplicar los cambios.`
}
