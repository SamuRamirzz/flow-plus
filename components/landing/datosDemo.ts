// Datos ficticios de la landing, en un solo sitio.
//
// Son las mismas materias/tareas en el hero, en la sección de /ai y en la de
// horario a propósito: la página cuenta UNA historia (estas cuatro tareas
// sueltas se vuelven una semana ordenada), no cuatro demos sin relación.
// Si los datos estuvieran repartidos por cada componente, la continuidad se
// rompería al primer retoque.

export type FragmentoCaos = {
  id: string
  /** Cómo lo escribiría alguien de verdad, a las corridas. */
  crudo: string
  /** Cómo queda una vez que la IA lo entiende. */
  titulo: string
  materia: string
  /** Índice en PALETA_MATERIAS. */
  color: number
  dia: string
  prioridad: 'alta' | 'media' | 'baja'
  /** Posición inicial del caos, en % del lienzo. Fija (no aleatoria) para
   *  que la composición esté compuesta de verdad y no se solapen. */
  x: number
  y: number
  rot: number
}

// Se usan como `rgb(...)` y también dentro de `rgba(...)`, por eso van como
// tripletas y no como hex.
export const PALETA_MATERIAS = ['255, 107, 77', '96, 165, 250', '52, 211, 153', '250, 204, 21'] as const

export const FRAGMENTOS: FragmentoCaos[] = [
  {
    id: 'f1',
    crudo: 'examen viernes cap 1-4 vale 30%',
    titulo: 'Examen — capítulos 1 a 4',
    materia: 'Cálculo II',
    color: 0,
    dia: 'Vie',
    prioridad: 'alta',
    x: 6,
    y: 12,
    rot: -7,
  },
  {
    id: 'f2',
    crudo: 'leer cap 4 antes de la clase',
    titulo: 'Leer capítulo 4',
    materia: 'Historia',
    color: 1,
    dia: 'Lun',
    prioridad: 'media',
    x: 58,
    y: 5,
    rot: 6,
  },
  {
    id: 'f3',
    crudo: 'ensayo lunes :(',
    titulo: 'Entregar ensayo',
    materia: 'Literatura',
    color: 2,
    dia: 'Lun',
    prioridad: 'alta',
    x: 12,
    y: 62,
    rot: 4,
  },
  {
    id: 'f4',
    crudo: 'lab química informe',
    titulo: 'Informe de laboratorio',
    materia: 'Química',
    color: 3,
    dia: 'Mié',
    prioridad: 'media',
    x: 62,
    y: 68,
    rot: -5,
  },
]
