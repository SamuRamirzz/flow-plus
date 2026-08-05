import { getGuestId } from './estado'
import { datosInvitadoVacios, type DatosInvitado } from './tipos'

const CLAVE_DATOS = 'flowplus_invitado_datos'

// Shell mínimo sobre localStorage — sin lógica propia a propósito. Toda la
// lógica real (dedup, resolución de materia, completada_en, etc.) vive en
// operaciones.ts, puro y testeable sin tocar este archivo.
export function leerDatosInvitado(): DatosInvitado {
  const guestId = getGuestId()
  if (!guestId) return datosInvitadoVacios('')

  const crudo = localStorage.getItem(CLAVE_DATOS)
  if (!crudo) return datosInvitadoVacios(guestId)

  try {
    const datos = JSON.parse(crudo) as DatosInvitado
    return { ...datos, guestId }
  } catch {
    return datosInvitadoVacios(guestId)
  }
}

export function guardarDatosInvitado(datos: DatosInvitado): void {
  localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos))
}

export function limpiarDatosInvitado(): void {
  localStorage.removeItem(CLAVE_DATOS)
}
