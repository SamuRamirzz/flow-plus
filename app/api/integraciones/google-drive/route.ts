import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { desvincularGoogle } from '@/lib/server/integracionGoogle'
import { ok, errorJson } from '@/lib/server/respuestas'

// Sprint Archivos / Tramo 2a — Fase 6. Gestión de la vinculación con Google
// Drive, separado de `obtenerAccessTokenValido()` (que solo devuelve un
// token, nunca el estado completo para mostrar en UI) y de `desvincularGoogle`
// (lib/server/integracionGoogle.ts, la I/O real de borrar/revocar).

type FilaVinculacion = {
  cuenta_email: string | null
  vinculada_en: string
  ultimo_refresco_en: string | null
  ultimo_error: string | null
  revocada_en: string | null
}

export async function GET() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  const { data, error } = await supabaseServer
    .from('integraciones_externas')
    .select('cuenta_email, vinculada_en, ultimo_refresco_en, ultimo_error, revocada_en')
    .eq('user_id', auth.userId)
    .eq('proveedor', 'google')
    .maybeSingle<FilaVinculacion>()

  if (error) return errorJson(error.message, 500)
  if (!data) return ok({ estado: 'sin_vinculacion' })

  if (data.revocada_en) {
    return ok({ estado: 'revocada', revocadaEn: data.revocada_en, detalle: data.ultimo_error })
  }

  return ok({
    estado: 'vinculada',
    cuentaEmail: data.cuenta_email,
    vinculadaEn: data.vinculada_en,
    ultimoRefrescoEn: data.ultimo_refresco_en,
  })
}

export async function DELETE() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  try {
    const habiaVinculacion = await desvincularGoogle(auth.userId)
    if (!habiaVinculacion) return errorJson('No hay ninguna vinculación de Google Drive', 404)
    return ok({ desvinculado: true })
  } catch (error) {
    return errorJson(`No se pudo desvincular Google Drive: ${error instanceof Error ? error.message : String(error)}`, 500)
  }
}
