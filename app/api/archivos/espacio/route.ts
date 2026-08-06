import { requerirUsuario } from '@/lib/server/usuario'
import { obtenerEspacioUsado } from '@/lib/server/googleDrive'
import { estadoHttpParaClase } from '@/lib/integraciones/googleDrive'
import { ok, errorJson } from '@/lib/server/respuestas'

export async function GET() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  const resultado = await obtenerEspacioUsado(auth.userId)
  if (!resultado.ok) return errorJson(`No se pudo obtener el espacio usado en Drive: ${resultado.detalle}`, estadoHttpParaClase(resultado.clase))

  return ok(resultado.datos)
}
