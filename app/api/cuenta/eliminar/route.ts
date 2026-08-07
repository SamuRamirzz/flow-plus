import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { solicitarEliminacionCuentaSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Sprint Soporte + Eliminación de cuenta.
//
// Este endpoint NUNCA borra nada — solo marca la intención y arranca el
// período de gracia de 14 días. El borrado real lo hace
// app/api/cron/eliminar-cuentas/route.ts, y solo cuando ya pasaron. Separar
// las dos cosas es lo que hace posible cancelar: si esto borrara al toque,
// no habría nada que cancelar.
export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = solicitarEliminacionCuentaSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const ahora = new Date().toISOString()

  // upsert (no insert): puede que ya exista una fila de perfil_academico
  // (el caso normal) o no (perfil borrado a mano, o el trigger de registro
  // falló silenciosamente — ver el comentario de crear_perfil_al_registrarse
  // sobre por qué eso se tolera). Un upsert cubre los dos sin una consulta
  // previa para decidir cuál hacer.
  const { data, error } = await supabaseServer
    .from('perfil_academico')
    .upsert(
      { user_id: auth.userId, eliminacion_solicitada_en: ahora, eliminar_drive_tambien: parsed.data.eliminarDriveTambien },
      { onConflict: 'user_id' }
    )
    .select('eliminacion_solicitada_en, eliminar_drive_tambien')
    .single()

  if (error) return errorJson(error.message, 500)

  return ok({ eliminacionSolicitadaEn: data.eliminacion_solicitada_en, eliminarDriveTambien: data.eliminar_drive_tambien })
}
