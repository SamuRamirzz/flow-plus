import type { BloqueHorario, DiaSemana } from './tipos'

// Un bloque propuesto por la foto todavía NO tiene id (no existe en la base)
// y trae la materia por NOMBRE, no por id — resolver ese nombre a una
// materia real (o crearla) es trabajo del guardado, no del diff.
export type BloquePropuesto = {
  materia: string
  diaSemana: DiaSemana
  horaInicio: string | null
  horaFin: string | null
  aula: string | null
  confidence: number
}

export type DiffHorario = {
  /** En la foto, no en lo guardado → se crearían. */
  agregados: BloquePropuesto[]
  /** Guardado con la misma materia+día que la foto, pero a otra hora. */
  movidos: { antes: BloqueHorario; despues: BloquePropuesto }[]
  /** Guardado y en la foto, idénticos — no hay nada que hacer con estos. */
  sinCambios: BloqueHorario[]
  /** Guardado pero ausente de la foto → el usuario decide si sobra. */
  eliminados: BloqueHorario[]
}

// Marcas diacríticas combinantes (U+0300–U+036F), las que deja `normalize
// ('NFD')` al separar "á" en "a" + tilde. Se construye con RegExp desde un
// string escapado a propósito: escrito como literal /[...]/ el rango son
// caracteres combinantes INVISIBLES en el código fuente, imposibles de
// revisar y fáciles de romper sin darse cuenta. (No se usa \p{Diacritic}
// porque tsconfig apunta a ES2017 y las property escapes son ES2018.)
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

// Normaliza un nombre de materia para comparar: sin acentos, sin espacios
// dobles, minúsculas. "Cálculo II" y "calculo ii" son la misma materia — el
// modelo puede leer los acentos de una foto de forma inconsistente, y no se
// quiere que eso genere un "agregado" falso contra algo que ya existe.
export function normalizarNombreMateria(nombre: string): string {
  return nombre.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Clave de identidad de un bloque: misma materia el mismo día. */
function clave(materiaNormalizada: string, diaSemana: DiaSemana): string {
  return `${materiaNormalizada}|${diaSemana}`
}

// PURO: ni I/O ni fechas. Compara el horario ya guardado contra lo que la
// IA leyó de la foto y clasifica cada bloque. `nombrePorMateriaId` traduce
// el materiaId de los bloques guardados a su nombre para poder compararlos
// con los de la foto (que solo traen nombre).
//
// Se empareja por materia+día, NO por hora: si "Cálculo II del lunes" está
// guardado a las 07:00 y la foto dice 08:00, eso es un MOVIDO (la clase se
// corrió), no un eliminado + un agregado. Esa distinción es justamente lo
// que hace útil la lista de cambios: el usuario ve "se movió" en vez de dos
// filas sin relación aparente.
export function diffHorario(input: {
  guardado: BloqueHorario[]
  propuesto: BloquePropuesto[]
  nombrePorMateriaId: Map<string, string>
}): DiffHorario {
  const { guardado, propuesto, nombrePorMateriaId } = input

  const guardadoPorClave = new Map<string, BloqueHorario>()
  for (const b of guardado) {
    const nombre = nombrePorMateriaId.get(b.materiaId)
    if (!nombre) continue // materia desconocida: se ignora, no se puede comparar
    guardadoPorClave.set(clave(normalizarNombreMateria(nombre), b.diaSemana), b)
  }

  const agregados: BloquePropuesto[] = []
  const movidos: { antes: BloqueHorario; despues: BloquePropuesto }[] = []
  const sinCambios: BloqueHorario[] = []
  const clavesVistas = new Set<string>()

  for (const p of propuesto) {
    const k = clave(normalizarNombreMateria(p.materia), p.diaSemana)
    clavesVistas.add(k)
    const existente = guardadoPorClave.get(k)

    if (!existente) {
      agregados.push(p)
      continue
    }
    if (existente.horaInicio === p.horaInicio && existente.horaFin === p.horaFin) {
      sinCambios.push(existente)
    } else {
      movidos.push({ antes: existente, despues: p })
    }
  }

  const eliminados = [...guardadoPorClave.entries()].filter(([k]) => !clavesVistas.has(k)).map(([, b]) => b)

  return { agregados, movidos, sinCambios, eliminados }
}

/** ¿Hay algo que aplicar? Un diff donde todo quedó en `sinCambios` no debería
 *  ofrecer un botón de guardar. */
export function diffTieneCambios(diff: DiffHorario): boolean {
  return diff.agregados.length > 0 || diff.movidos.length > 0 || diff.eliminados.length > 0
}

// De los bloques `agregados` de un diff, ¿cuáles mencionan una materia que
// el usuario todavía no tiene? Solo `agregados` puede contenerlas: un bloque
// en `movidos`/`sinCambios` ya emparejó por (materia normalizada + día)
// contra un bloque GUARDADO, lo que exige que esa materia ya tuviera una
// franja — así que por construcción de diffHorario() nunca es nueva.
//
// PURA a propósito (mismo criterio que diffHorario/normalizarNombreMateria):
// no basta con mirar el diff solo — una materia puede existir ya en
// `materias` sin tener ninguna franja guardada todavía (ej. el usuario la
// creó a mano pero nunca la agendó), y en ese caso un bloque nuevo para
// ella cae en `agregados` igual, sin ser una materia nueva. Por eso recibe
// la lista completa de materias del usuario, no solo las que aparecen en
// `nombrePorMateriaId` del diff (que solo cubre las que sí tienen horario).
//
// Informativo, no una puerta: el llamador (PropuestaFoto/ResolverImportacion)
// lo usa para mostrar "esto también creará N materias nuevas" ANTES de
// guardar — la creación real sigue pasando, automática y sin bloquear, por
// resolverOCrearMateria() cuando se aplica el diff (aplicarImportacion.ts).
export function detectarMateriasNuevas(agregados: BloquePropuesto[], materiasExistentes: { nombre: string }[]): string[] {
  const existentesNormalizadas = new Set(materiasExistentes.map((m) => normalizarNombreMateria(m.nombre)))
  const nuevas: string[] = []
  const vistas = new Set<string>()

  for (const b of agregados) {
    const clave = normalizarNombreMateria(b.materia)
    if (existentesNormalizadas.has(clave) || vistas.has(clave)) continue
    vistas.add(clave)
    nuevas.push(b.materia)
  }

  return nuevas
}
