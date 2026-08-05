// Sub-sprint — ícono automático por materia. PURO: solo string in, string
// out, sin I/O — el respaldo con IA (lib/ai/agents/iconoMateria/) vive
// aparte porque ESE sí es impuro (llama a Gemini).
//
// Nombre del ícono tal como lo exporta lucide-react (ej. "Calculator") —
// server y cliente comparten este mismo string; la UI es quien lo resuelve
// al componente real (ver ICONOS_LUCIDE en components/ui/iconosMateria.tsx).
export type NombreIcono =
  | 'Calculator'
  | 'FlaskConical'
  | 'Atom'
  | 'Dumbbell'
  | 'BookOpen'
  | 'Globe'
  | 'Palette'
  | 'Music'
  | 'Church'
  | 'Landmark'
  | 'Map'
  | 'Leaf'
  | 'Laptop'
  | 'Code'
  | 'Database'
  | 'Network'
  | 'Brain'
  | 'Scale'
  | 'Coins'
  | 'BarChart3'
  | 'HeartPulse'
  | 'Stethoscope'
  | 'GraduationCap'

// Respaldo neutro — nunca debe quedar una materia sin ícono. Mismo valor
// que el DEFAULT de la columna `icono` en la migración, a propósito: si
// algo falla ANTES de resolver un ícono (mapeo Y agente de IA), lo peor que
// puede pasar es que coincida con lo que la base ya habría puesto sola.
export const ICONO_POR_DEFECTO: NombreIcono = 'GraduationCap'

// Lista cerrada — la reusa el schema del agente de IA (Sprint de respaldo)
// para no duplicar a mano el enum en dos archivos.
export const ICONOS_VALIDOS: NombreIcono[] = [
  'Calculator',
  'FlaskConical',
  'Atom',
  'Dumbbell',
  'BookOpen',
  'Globe',
  'Palette',
  'Music',
  'Church',
  'Landmark',
  'Map',
  'Leaf',
  'Laptop',
  'Code',
  'Database',
  'Network',
  'Brain',
  'Scale',
  'Coins',
  'BarChart3',
  'HeartPulse',
  'Stethoscope',
  'GraduationCap',
]

// Minúsculas + sin tildes/diacríticos — así cada patrón de abajo puede ser
// ASCII simple ("matematica", no "matem[aá]tica").
function normalizar(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

// ORDEN IMPORTA: las reglas más específicas van primero. El caso que obliga
// a esto es "educación física" — contiene "fisica" como substring, así que
// si la regla genérica de "fisica" (Atom, la materia de ciencias) se
// evaluara antes, "educación física" nunca llegaría a matchear Dumbbell.
// Mismo cuidado con "programación" (Code) y "base de datos" (Database)
// antes que "informática" (Laptop, más genérica) — y con "medicina"
// (Stethoscope) antes que nada que pudiera confundirse con biología.
const REGLAS: Array<{ patron: RegExp; icono: NombreIcono }> = [
  { patron: /educacion fisica|\bed\.?\s*fisica\b|deporte|atletismo|gimnasia/, icono: 'Dumbbell' },
  { patron: /matematica|calculo|algebra|geometria|trigonometria|aritmetica/, icono: 'Calculator' },
  { patron: /quimica/, icono: 'FlaskConical' },
  { patron: /fisica/, icono: 'Atom' },
  { patron: /anatomia|fisiologia|enfermeria/, icono: 'HeartPulse' },
  { patron: /medicina/, icono: 'Stethoscope' },
  { patron: /biologia|ciencias naturales|botanica|ecologia/, icono: 'Leaf' },
  { patron: /programacion|desarrollo de software/, icono: 'Code' },
  { patron: /base(s)? de datos/, icono: 'Database' },
  { patron: /redes/, icono: 'Network' },
  { patron: /informatica|computacion|\bsistemas\b/, icono: 'Laptop' },
  { patron: /ingles|frances|aleman|idioma|lengua extranjera/, icono: 'Globe' },
  { patron: /espanol|literatura|lenguaje|lectura|redaccion/, icono: 'BookOpen' },
  { patron: /geografia/, icono: 'Map' },
  { patron: /historia/, icono: 'Landmark' },
  { patron: /\barte\b|artistica|dibujo|pintura/, icono: 'Palette' },
  { patron: /musica/, icono: 'Music' },
  { patron: /religion|\betica\b|valores/, icono: 'Church' },
  { patron: /filosofia|psicologia/, icono: 'Brain' },
  { patron: /derecho|leyes/, icono: 'Scale' },
  { patron: /economia|contabilidad|finanzas/, icono: 'Coins' },
  { patron: /estadistica|probabilidad/, icono: 'BarChart3' },
]

// null cuando ningún patrón calza — quien llama decide entre caer al
// respaldo de IA o directo a ICONO_POR_DEFECTO (nunca lo decide esta
// función: es puramente el mapeo, sin fallback mezclado adentro).
export function asignarIconoDeterministico(nombreMateria: string): NombreIcono | null {
  const normalizado = normalizar(nombreMateria)
  for (const regla of REGLAS) {
    if (regla.patron.test(normalizado)) return regla.icono
  }
  return null
}
