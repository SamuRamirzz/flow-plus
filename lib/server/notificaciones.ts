import { supabaseServer } from './supabaseServer'
import { enviarMensajeWhatsApp } from './whatsapp'
import type { TipoNotificacion, EntidadTipoNotificacion } from '@/lib/notificaciones/tipos'

export type { TipoNotificacion, EntidadTipoNotificacion, FilaNotificacion } from '@/lib/notificaciones/tipos'

// Sprint 1/3 — Sistema de Notificaciones. Única puerta de entrada para
// CREAR una notificación general (tabla `notificaciones`, distinta de
// `notificaciones_enviadas` — ver el comentario de cabecera de la
// migración 20260819000000 para la diferencia entre ambas). Todo
// disparador de la Parte B pasa por acá, nunca por un insert directo
// disperso en cada punto del código — mismo criterio que `crearNota()`
// en lib/server/notas.ts: un solo lugar que el Sprint 2/3 (WhatsApp)
// puede interceptar para agregar el envío por ese canal sin tocar cada
// disparador individual.

type ParametrosCrearNotificacion = {
  userId: string
  tipo: TipoNotificacion
  titulo: string
  cuerpo?: string
  entidadTipo?: EntidadTipoNotificacion
  entidadId?: string
}

// Nunca lanza — mismo criterio defensivo que `resolverIcono`/`resolverDedup`/
// `resolverCamposExamen`: un fallo al crear una notificación (red, tabla
// bloqueada un instante) NUNCA debe interrumpir la operación principal que
// la disparó (crear una tarea, que el cron corra, que la IA cree una nota).
// El llamador no necesita ni el resultado ni manejar un error — si algo
// sale mal queda logueado para diagnóstico y listo.
export async function crearNotificacion(params: ParametrosCrearNotificacion): Promise<void> {
  try {
    const { error } = await supabaseServer.from('notificaciones').insert({
      user_id: params.userId,
      tipo: params.tipo,
      titulo: params.titulo,
      cuerpo: params.cuerpo ?? null,
      entidad_tipo: params.entidadTipo ?? null,
      entidad_id: params.entidadId ?? null,
    })
    if (error) console.error('[notificaciones] no se pudo crear la notificación:', error.message)
  } catch (error) {
    console.error('[notificaciones] excepción creando la notificación:', error)
  }

  // Sprint 2/3 (Parte F) — segundo canal de ENTREGA de la misma
  // notificación. Este es exactamente el punto de intercepción que el
  // Sprint 1/3 dejó preparado al centralizar la creación acá: ningún
  // disparador (cron de recordatorios, IA creando notas) necesitó cambiar
  // ni una línea para ganar WhatsApp.
  //
  // Va DESPUÉS del insert y con su propio try/catch: la notificación
  // in-app es la fuente de verdad y ya está guardada pase lo que pase con
  // WhatsApp — un canal secundario caído nunca puede costar la notificación
  // principal.
  await entregarPorWhatsApp(params)
}

// Se separa en su propia función para que el camino de WhatsApp no pueda
// hacer fallar el de arriba ni siquiera por un error de programación.
async function entregarPorWhatsApp(params: ParametrosCrearNotificacion): Promise<void> {
  try {
    const { data: perfil } = await supabaseServer
      .from('perfil_academico')
      .select('whatsapp_numero, whatsapp_verificado, whatsapp_notificaciones')
      .eq('user_id', params.userId)
      .maybeSingle()

    // Las tres condiciones son necesarias y distintas: tener número, haberlo
    // verificado, y haber pedido explícitamente recibir notificaciones por
    // ahí (vincular no implica querer que te escriban).
    if (!perfil?.whatsapp_numero || !perfil.whatsapp_verificado || !perfil.whatsapp_notificaciones) return

    const cuerpo = params.cuerpo ? `\n${params.cuerpo}` : ''
    await enviarMensajeWhatsApp(perfil.whatsapp_numero as string, `*${params.titulo}*${cuerpo}`)
  } catch (error) {
    console.error('[notificaciones] excepción entregando por WhatsApp:', error)
  }
}
