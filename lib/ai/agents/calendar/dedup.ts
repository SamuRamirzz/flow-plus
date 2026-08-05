import { decidirAutonomia } from './validar'
import type { PosibleDuplicadoMateria, ResultadoDedup } from './types'

// PURO — sin I/O, sin llamar al modelo (eso lo hace CalendarAgent.ts). Esta
// función es la que decide qué le llega al usuario a partir de lo que el
// modelo dijo: "cuán insistente se ve el aviso" (el pedido explícito de
// esta parte) se traduce acá en dos umbrales, no en la respuesta cruda del
// modelo.
//
// UMBRAL_MOSTRAR: por debajo de esto, ni se muestra — una confianza baja no
// es "un aviso discreto", es ruido. Mostrar una sugerencia de fusión
// dudosa entrena al usuario a ignorar TODOS los avisos de este tipo,
// incluidos los buenos.
const UMBRAL_MOSTRAR = 0.35

// UMBRAL_AUTONOMO: el que ya recibía decidirAutonomia — a partir de acá el
// aviso se muestra con el tratamiento visual prominente (autonomo); entre
// UMBRAL_MOSTRAR y este, se muestra pero discreto (requiere_revision, ver
// components/ui/AvisoDuplicadoMateria.tsx para la diferencia visual).
const UMBRAL_AUTONOMO = 0.7

/** Compone el resultado crudo del modelo (ResultadoDedup) + decidirAutonomia
 *  en lo que de verdad viaja al cliente. `null` es una respuesta válida y
 *  frecuente: "no hay nada que mostrar", ya sea porque no había duplicado o
 *  porque la confianza no alcanzó ni para un aviso discreto. */
export function resolverAvisoDedup(resultado: ResultadoDedup): PosibleDuplicadoMateria | null {
  if (!resultado.hayDuplicado || !resultado.materiaExistente) return null
  if (resultado.confianza < UMBRAL_MOSTRAR) return null

  return {
    materiaId: resultado.materiaExistente.id,
    nombre: resultado.materiaExistente.nombre,
    confianza: resultado.confianza,
    autonomia: decidirAutonomia(resultado.confianza, UMBRAL_AUTONOMO),
  }
}
