import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { verificarWhatsAppSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Sprint 2/3 — paso 2 de la vinculación: canjea el código recibido por
// WhatsApp. Solo aquí se marca `whatsapp_verificado`, que es lo que el
// webhook exige para aceptar comandos de un número.

export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = verificarWhatsAppSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  // El código más reciente sin usar de ESTE usuario. Filtrar por user_id no
  // es opcional: sin eso, un código válido de otra persona serviría acá.
  const { data: fila, error } = await supabaseServer
    .from('whatsapp_codigos_verificacion')
    .select('id, numero, codigo, expira_en, usado')
    .eq('user_id', userId)
    .eq('usado', false)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return errorJson(error.message, 500)
  if (!fila) return errorJson('No hay ningún código pendiente. Pide uno nuevo.', 404)

  if (new Date(fila.expira_en as string).getTime() < Date.now()) {
    return errorJson('El código venció. Pide uno nuevo.', 410)
  }

  if ((fila.codigo as string) !== parsed.data.codigo) {
    // El código NO se marca como usado en un fallo — si un dedo equivocado
    // lo quemara, el usuario tendría que pedir otro cada vez que se
    // equivoca de tecla. La ventana de 10 minutos y el tope de solicitudes
    // por hora son los que acotan el intento por fuerza bruta.
    return errorJson('Ese código no es correcto.', 400)
  }

  // Marcar el código como usado ANTES de vincular: si la vinculación
  // fallara después, el peor caso es que el usuario pida otro código —
  // frente al orden inverso, donde un código ya canjeado seguiría siendo
  // válido para un segundo canje.
  await supabaseServer.from('whatsapp_codigos_verificacion').update({ usado: true }).eq('id', fila.id)

  const { error: errorPerfil } = await supabaseServer
    .from('perfil_academico')
    .update({ whatsapp_numero: fila.numero, whatsapp_verificado: true })
    .eq('user_id', userId)

  if (errorPerfil) {
    // El índice único parcial de la migración es la última defensa contra
    // dos cuentas con el mismo número verificado (la comprobación de
    // /vincular puede quedar obsoleta entre pedir el código y canjearlo).
    if (errorPerfil.code === '23505') return errorJson('Ese número ya está vinculado a otra cuenta de Flow+', 409)
    return errorJson(errorPerfil.message, 500)
  }

  return ok({ verificado: true, numero: fila.numero })
}
