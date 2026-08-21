import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { consumirLimite } from '@/lib/server/limites'
import { enviarMenuWhatsApp } from '@/lib/server/whatsapp'
import { MENU_PRINCIPAL } from '@/lib/whatsapp/menus'
import { ok, errorJson } from '@/lib/server/respuestas'

// Sprint 2/3 (menús) — "Enviarme el menú de prueba" desde Ajustes.
//
// Manda el MENÚ REAL, no un texto de prueba inventado: si llega y sus
// botones funcionan, queda demostrado el camino completo (token vigente,
// canal vinculado, formato interactivo aceptado por este WhatsApp). Un
// "mensaje de prueba" genérico solo probaría la mitad.
export async function POST() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  const { data: perfil } = await supabaseServer
    .from('perfil_academico')
    .select('whatsapp_numero, whatsapp_chat_id, whatsapp_verificado')
    .eq('user_id', userId)
    .maybeSingle()

  if (!perfil?.whatsapp_verificado) return errorJson('Todavía no has vinculado tu WhatsApp', 400)

  // Se prefiere el chat id si ya se conoce: es la conversación exacta donde
  // el usuario escribe. El teléfono es el respaldo para quien vinculó desde
  // la app y todavía no ha mandado ningún mensaje.
  const destino = (perfil.whatsapp_chat_id as string | null) ?? (perfil.whatsapp_numero as string | null)
  if (!destino) return errorJson('No hay un destino de WhatsApp guardado', 400)

  // Tope antes de enviar (auditoría 2026-08-22). El número del canal es un
  // recurso COMPARTIDO: si WhatsApp lo marca como spam por un bucle contra
  // este endpoint, el canal se cae para todos los usuarios, no solo para
  // quien abusó. Va justo antes del envío para no gastar cupo en las
  // validaciones de arriba, que no cuestan nada.
  const limite = await consumirLimite(userId, 'whatsapp_envio')
  if (limite) return limite

  const envio = await enviarMenuWhatsApp(destino, MENU_PRINCIPAL)
  if (!envio.ok) {
    return errorJson('No se pudo enviar. Puede que la sesión de WhatsApp se haya desvinculado.', 502)
  }

  return ok({ enviado: true })
}
