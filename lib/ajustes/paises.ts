// Lista curada, no las 249 entradas ISO 3166-1 completas — hispanohablantes
// primero (la audiencia real de la app, en español) más los más comunes a
// nivel global. Guarda el código ISO alpha-2 (perfil_academico.pais), la UI
// muestra el nombre.
//
// `prefijo` es el indicativo telefónico, para el selector de país del número
// de WhatsApp: sin él, el usuario tiene que saberse de memoria que Colombia
// es +57, que es justo la fricción que el selector viene a quitar.
export const PAISES = [
  { id: 'CO', label: 'Colombia', prefijo: '57' },
  { id: 'MX', label: 'México', prefijo: '52' },
  { id: 'AR', label: 'Argentina', prefijo: '54' },
  { id: 'PE', label: 'Perú', prefijo: '51' },
  { id: 'CL', label: 'Chile', prefijo: '56' },
  { id: 'EC', label: 'Ecuador', prefijo: '593' },
  { id: 'VE', label: 'Venezuela', prefijo: '58' },
  { id: 'BO', label: 'Bolivia', prefijo: '591' },
  { id: 'UY', label: 'Uruguay', prefijo: '598' },
  { id: 'PY', label: 'Paraguay', prefijo: '595' },
  { id: 'CR', label: 'Costa Rica', prefijo: '506' },
  { id: 'PA', label: 'Panamá', prefijo: '507' },
  { id: 'GT', label: 'Guatemala', prefijo: '502' },
  { id: 'HN', label: 'Honduras', prefijo: '504' },
  { id: 'SV', label: 'El Salvador', prefijo: '503' },
  { id: 'NI', label: 'Nicaragua', prefijo: '505' },
  { id: 'DO', label: 'República Dominicana', prefijo: '1' },
  { id: 'CU', label: 'Cuba', prefijo: '53' },
  { id: 'PR', label: 'Puerto Rico', prefijo: '1' },
  { id: 'ES', label: 'España', prefijo: '34' },
  { id: 'US', label: 'Estados Unidos', prefijo: '1' },
  { id: 'BR', label: 'Brasil', prefijo: '55' },
  { id: 'CA', label: 'Canadá', prefijo: '1' },
]

export type Pais = (typeof PAISES)[number]

/**
 * País del usuario deducido de su zona horaria, sin pedirle permiso de
 * ubicación ni llamar a ningún servicio externo.
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` ya lo da el navegador
 * gratis (es el mismo mecanismo que la categoría Fecha y hora usa para
 * autodetectar la zona), y el mapa de abajo cubre las zonas de los países de
 * la lista. Si no se reconoce, devuelve `null` y quien llama decide el
 * respaldo — nunca se adivina un país al azar.
 */
const ZONA_A_PAIS: Record<string, string> = {
  'America/Bogota': 'CO',
  'America/Mexico_City': 'MX',
  'America/Cancun': 'MX',
  'America/Monterrey': 'MX',
  'America/Tijuana': 'MX',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Argentina/Cordoba': 'AR',
  'America/Lima': 'PE',
  'America/Santiago': 'CL',
  'America/Guayaquil': 'EC',
  'America/Caracas': 'VE',
  'America/La_Paz': 'BO',
  'America/Montevideo': 'UY',
  'America/Asuncion': 'PY',
  'America/Costa_Rica': 'CR',
  'America/Panama': 'PA',
  'America/Guatemala': 'GT',
  'America/Tegucigalpa': 'HN',
  'America/El_Salvador': 'SV',
  'America/Managua': 'NI',
  'America/Santo_Domingo': 'DO',
  'America/Havana': 'CU',
  'America/Puerto_Rico': 'PR',
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'America/Sao_Paulo': 'BR',
  'America/Manaus': 'BR',
  'America/Fortaleza': 'BR',
  'America/Recife': 'BR',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
}

/** PURA: la zona entra por parámetro para poder probarla sin tocar el reloj. */
export function paisDeZonaHoraria(zona: string | null | undefined): Pais | null {
  if (!zona) return null
  const id = ZONA_A_PAIS[zona]
  if (!id) return null
  return PAISES.find((p) => p.id === id) ?? null
}

export function paisPorId(id: string | null | undefined): Pais | null {
  if (!id) return null
  return PAISES.find((p) => p.id === id) ?? null
}
