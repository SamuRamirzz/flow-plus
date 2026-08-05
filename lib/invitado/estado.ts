import { supabase } from '@/lib/supabase'

const CLAVE_GUEST_ID = 'flowplus_invitado_id'

// Único creador de la marca de invitado — ninguna función de datos la crea
// implícitamente. Así, `esInvitado()` nunca da falso positivo para alguien
// que nunca pasó por el botón "Continuar como invitado" de /login.
export function activarModoInvitado(): string {
  let id = localStorage.getItem(CLAVE_GUEST_ID)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(CLAVE_GUEST_ID, id)
  }
  return id
}

export function getGuestId(): string | null {
  return localStorage.getItem(CLAVE_GUEST_ID)
}

export function limpiarModoInvitado(): void {
  localStorage.removeItem(CLAVE_GUEST_ID)
}

// Async a propósito: no basta con mirar la marca de localStorage. Un
// usuario que activó modo invitado, luego se registró de verdad, y cuya
// sincronización falló por red, se queda con la marca vieja en el
// dispositivo — pero YA tiene sesión real. Sin este segundo chequeo, sus
// mutaciones reales (ya autenticadas) se irían por error al camino local.
//
// `getSession()` y no `getClaims()`: acá es una decisión de UX en el
// cliente (qué camino de datos usar), no un límite de seguridad — ese
// límite sigue siendo RLS + `requerirUsuario()` en cada Route Handler, sin
// cambios. `getSession()` es local (sin red), apropiado para algo que se
// llama en cada lectura/escritura.
export async function esInvitado(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!getGuestId()) return false
  const { data } = await supabase.auth.getSession()
  return !data.session
}
