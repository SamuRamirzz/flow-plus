import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { fechaEjecucion } from '@/lib/cuenta/eliminacion'
import { ok, errorJson } from '@/lib/server/respuestas'

type FilaEstado = { eliminacion_solicitada_en: string | null; eliminar_drive_tambien: boolean | null }

// La fecha de ejecución exacta se calcula ACÁ (servidor) y se manda ya
// resuelta — el cliente no debe reimplementar "solicitada + 14 días" por su
// cuenta, ni depender de que su propio reloj esté bien puesto.
export async function GET() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  const { data, error } = await supabaseServer
    .from('perfil_academico')
    .select('eliminacion_solicitada_en, eliminar_drive_tambien')
    .eq('user_id', auth.userId)
    .maybeSingle<FilaEstado>()

  if (error) return errorJson(error.message, 500)

  if (!data?.eliminacion_solicitada_en) {
    return ok({ solicitada: false })
  }

  return ok({
    solicitada: true,
    solicitadaEn: data.eliminacion_solicitada_en,
    eliminarDriveTambien: data.eliminar_drive_tambien ?? false,
    ejecutaEn: fechaEjecucion(data.eliminacion_solicitada_en).toISOString(),
  })
}
