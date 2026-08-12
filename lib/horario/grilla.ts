import type { BloqueHorario, DiaSemana } from './tipos'
import { formatearHora, type FormatoReloj } from '@/lib/hora'

// Franja horaria = una FILA de la grilla. Se derivan de los bloques que el
// usuario ya tiene, no de una lista fija de horas: cada universidad/colegio
// tiene sus propios tramos y no hay forma honesta de inventarlos.
export type Franja = { horaInicio: string | null; horaFin: string | null; clave: string }

// Una fila puede ser una franja real (con clases y/o bloques especiales) o
// un HUECO derivado entre dos franjas consecutivas — un "descanso" que el
// usuario nunca guardó explícitamente, distinto del tipo 'descanso' real de
// BloqueHorario (Sprint Zonas de horario): este hueco es 100% inferido del
// espacio libre entre dos tramos, nunca un dato guardado, y sigue
// existiendo como fallback para huecos que el usuario no declaró a mano.
export type FilaGrilla =
  | { tipo: 'franja'; clave: string; franja: Franja }
  | { tipo: 'hueco'; clave: string; horaInicio: string; horaFin: string }

/** Hueco mínimo (minutos) para dibujar una fila de descanso. Por debajo de
 *  esto es ruido de redondeo entre tramos, no un descanso real. */
const HUECO_MINIMO_MIN = 10

export const CLAVE_SIN_HORA = 'sin-hora'

/** 'HH:MM' → minutos desde medianoche. null si no es una hora válida. */
export function minutosDeHora(hora: string | null): number | null {
  if (!hora) return null
  const m = /^(\d{2}):(\d{2})$/.exec(hora)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function claveDeFranja(horaInicio: string | null, horaFin: string | null): string {
  if (!horaInicio && !horaFin) return CLAVE_SIN_HORA
  return `${horaInicio ?? ''}-${horaFin ?? ''}`
}

// PURA. Deduplica los tramos horarios de todos los días y los ordena. Dos
// bloques de días distintos con el MISMO tramo comparten fila — que es lo
// que hace que la tabla se lea de un vistazo (toda la semana alineada por
// hora, como el horario impreso de referencia).
//
// Los tramos que no coinciden exactamente NO se fusionan: si el lunes es
// 07:00–09:00 y el martes 07:30–09:30, son dos filas. Fusionarlos exigiría
// decidir a qué hora "pertenece" cada bloque y mentiría sobre el horario
// real del usuario; es preferible una fila de más que un dato falseado.
export function franjasDeBloques(bloques: BloqueHorario[]): Franja[] {
  const porClave = new Map<string, Franja>()

  for (const b of bloques) {
    const clave = claveDeFranja(b.horaInicio, b.horaFin)
    if (!porClave.has(clave)) {
      porClave.set(clave, { horaInicio: b.horaInicio, horaFin: b.horaFin, clave })
    }
  }

  return [...porClave.values()].sort((a, b) => {
    // Los bloques sin hora van siempre al final: no tienen dónde ordenarse
    // y arriba empujarían todo el horario real hacia abajo.
    const ma = minutosDeHora(a.horaInicio)
    const mb = minutosDeHora(b.horaInicio)
    if (ma === null && mb === null) return 0
    if (ma === null) return 1
    if (mb === null) return -1
    if (ma !== mb) return ma - mb
    return (minutosDeHora(a.horaFin) ?? 0) - (minutosDeHora(b.horaFin) ?? 0)
  })
}

// PURA. Intercala filas de "hueco" entre franjas consecutivas separadas por
// al menos HUECO_MINIMO_MIN. Es la adaptación del principio visual de la
// referencia (las franjas que no son clase se distinguen) a lo que el
// esquema actual SÍ permite deducir, sin inventar datos.
export function construirFilas(bloques: BloqueHorario[]): FilaGrilla[] {
  const franjas = franjasDeBloques(bloques)
  const filas: FilaGrilla[] = []

  for (let i = 0; i < franjas.length; i++) {
    const franja = franjas[i]
    filas.push({ tipo: 'franja', clave: franja.clave, franja })

    const siguiente = franjas[i + 1]
    if (!siguiente) continue

    const finActual = minutosDeHora(franja.horaFin)
    const inicioSiguiente = minutosDeHora(siguiente.horaInicio)
    if (finActual === null || inicioSiguiente === null) continue

    const hueco = inicioSiguiente - finActual
    if (hueco >= HUECO_MINIMO_MIN) {
      filas.push({
        tipo: 'hueco',
        clave: `hueco-${franja.clave}`,
        horaInicio: minutosAHora(finActual),
        horaFin: minutosAHora(inicioSiguiente),
      })
    }
  }

  return filas
}

const DIAS_LABORALES: DiaSemana[] = [1, 2, 3, 4, 5]

// PURA. Lunes a viernes SIEMPRE (para que la grilla no cambie de forma al
// añadir el primer bloque, y porque una semana académica es de lunes a
// viernes por defecto); sábado y domingo solo si de verdad hay clase — dos
// columnas vacías permanentes le roban ancho a los cinco días que importan.
export function diasVisibles(bloques: BloqueHorario[]): DiaSemana[] {
  const conClase = new Set(bloques.map((b) => b.diaSemana))
  const finDeSemana = ([6, 7] as DiaSemana[]).filter((d) => conClase.has(d))
  return [...DIAS_LABORALES, ...finDeSemana]
}

/** PURA. Bloques de una celda (día × franja). Empareja por la clave exacta
 *  de la franja, que es como se construyeron las filas. */
export function bloquesDeCelda(bloques: BloqueHorario[], dia: DiaSemana, franja: Franja): BloqueHorario[] {
  return bloques.filter((b) => b.diaSemana === dia && claveDeFranja(b.horaInicio, b.horaFin) === franja.clave)
}

/** Etiqueta legible de una franja para la columna de horas. `formato`
 *  opcional (default '24h') preserva el comportamiento de siempre para
 *  quien no lo pasa — Sección Ajustes, ver lib/hora.ts. */
export function etiquetaFranja(franja: Franja, formato: FormatoReloj = '24h'): string {
  const fmt = (h: string) => formatearHora(h, formato)
  if (!franja.horaInicio && !franja.horaFin) return 'Sin hora'
  if (franja.horaInicio && franja.horaFin) return `${fmt(franja.horaInicio)} – ${fmt(franja.horaFin)}`
  return (franja.horaInicio ? fmt(franja.horaInicio) : null) ?? (franja.horaFin ? fmt(franja.horaFin) : null) ?? 'Sin hora'
}
