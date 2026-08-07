import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { ok, errorJson } from '@/lib/server/respuestas'

// Cancelar es de UN SOLO clic a propósito (sin BotonConfirmacion de dos
// toques): la fricción del encargo va toda en SOLICITAR, nunca en
// arrepentirse. Un usuario que ve el banner "tu cuenta se eliminará en N
// días" y decide quedarse no debería tener que confirmar dos veces que
// quiere seguir usando la app.
export async function POST() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  // Se comprueba ANTES de limpiar: un `.update()` sobre la fila de perfil
  // "tiene éxito" aunque no hubiera ninguna solicitud activa (la fila de
  // perfil existe siempre para un usuario real) — sin este chequeo previo,
  // un 404 nunca dispararía y "cancelar sin haber solicitado nada" se vería
  // como éxito, que es engañoso.
  const { data: perfil, error: errorLectura } = await supabaseServer
    .from('perfil_academico')
    .select('eliminacion_solicitada_en')
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (errorLectura) return errorJson(errorLectura.message, 500)
  if (!perfil?.eliminacion_solicitada_en) return errorJson('No hay ninguna solicitud de eliminación pendiente', 404)

  const { error } = await supabaseServer
    .from('perfil_academico')
    .update({ eliminacion_solicitada_en: null, eliminar_drive_tambien: null })
    .eq('user_id', auth.userId)

  if (error) return errorJson(error.message, 500)

  return ok({ cancelado: true })
}
