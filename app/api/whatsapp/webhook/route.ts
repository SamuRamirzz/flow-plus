import { supabaseServer } from '@/lib/server/supabaseServer'
import { enviarMensajeWhatsApp, enviarMenuWhatsApp } from '@/lib/server/whatsapp'
import { ejecutarComando } from '@/lib/server/whatsapp/ejecutarComando'
import { ejecutarConIA } from '@/lib/server/whatsapp/ejecutarIA'
import { parsearComando } from '@/lib/whatsapp/parser'
import { MENU_PRINCIPAL, pideMenu, resolverOpcion, comandoDeOpcion } from '@/lib/whatsapp/menus'
import {
  extraerMensajesDeTexto,
  debeProcesarse,
  canalDelPayload,
  normalizarNumero,
  destinoDeRespuesta,
  telefonoDelRemitente,
  type MensajeEntrante,
} from '@/lib/whatsapp/whapi'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'

// Sprint 2/3 — recepción de mensajes de WhatsApp (Whapi.Cloud).
//
// ─────────────────────────────────────────────────────────────────────────
// SEGURIDAD — limitación real, documentada, no disfrazada
// ─────────────────────────────────────────────────────────────────────────
// Whapi.Cloud NO firma sus webhooks: se revisó su documentación completa
// (formato, eventos, modos, reintentos) y no existe HMAC, secreto compartido
// ni cabecera verificable. NO hay verificación criptográfica posible acá;
// todo lo demás es mitigación, y se nombra por lo que es:
//
//   1. Secreto en la URL (`?s=`, WHAPI_WEBHOOK_SECRET) — el control más
//      fuerte disponible, mismo patrón que `CRON_SECRET` en los crons.
//   2. `channel_id` contra WHAPI_CHANNEL_ID — descarta tráfico de otro
//      canal; NO es secreto, así que no cuenta como autenticación.
//   3. Tope de comandos por remitente y hora — acota el abuso, no lo evita.
//
// Un secreto inválido responde 404 y no 401: a un escáner no se le confirma
// que la ruta existe.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ EL CANAL ES UN WHATSAPP PERSONAL — de ahí la regla de silencio
// ─────────────────────────────────────────────────────────────────────────
// Whapi se vincula por QR a una cuenta de WhatsApp real. En este proyecto
// esa cuenta es la PERSONAL del usuario, así que por este webhook pasa
// absolutamente TODA su mensajería: amigos, familia, grupos, todo.
//
// La primera versión trataba cada mensaje entrante como un intento de
// comando: buscaba al remitente, no lo encontraba, y le respondía "Este
// número no está vinculado a Flow+". El resultado real, verificado en
// producción, fue que el bot **le contestó eso a contactos personales del
// usuario** (3 mensajes a 2 personas) y guardó el texto íntegro de sus
// conversaciones privadas en `whatsapp_comandos_log.mensaje_crudo`.
//
// La regla que lo corrige: **de un remitente NO vinculado solo se atiende un
// mensaje que empiece por `/`**. Cualquier otra cosa se ignora por completo
// — sin responder y sin registrar su contenido. Un amigo escribiendo "hola"
// no recibe nada y no queda escrito en ninguna tabla; alguien que escribe
// `/ayuda` sí recibe la explicación de cómo vincularse. A un usuario ya
// vinculado se le atiende todo, porque él sí eligió hablar con Flow+.
export const dynamic = 'force-dynamic'

const MAX_COMANDOS_POR_HORA = 30

type PerfilVinculado = { userId: string; zonaHoraria: string | null }

async function registrar(entrada: {
  userId: string | null
  remitente: string
  mensaje: string
  comando: string | null
  resultado: 'ejecutado' | 'error' | 'no_reconocido'
  detalleError?: string
}): Promise<void> {
  const { error } = await supabaseServer.from('whatsapp_comandos_log').insert({
    user_id: entrada.userId,
    numero_origen: entrada.remitente,
    mensaje_crudo: entrada.mensaje,
    comando_detectado: entrada.comando,
    resultado: entrada.resultado,
    detalle_error: entrada.detalleError ?? null,
  })
  if (error) console.error('[whatsapp/webhook] no se pudo registrar el comando:', error.message)
}

/** Tope por remitente y hora. `creado_en` (masculino) es el nombre real de la columna. */
async function superaLimite(remitente: string): Promise<boolean> {
  const desde = new Date(Date.now() - 3_600_000).toISOString()
  const { count, error } = await supabaseServer
    .from('whatsapp_comandos_log')
    .select('id', { count: 'exact', head: true })
    .eq('numero_origen', remitente)
    .gte('creado_en', desde)

  if (error) {
    console.error('[whatsapp/webhook] no se pudo comprobar el límite:', error.message)
    return false
  }
  return (count ?? 0) >= MAX_COMANDOS_POR_HORA
}

/**
 * Busca al usuario dueño de este remitente. Dos caminos, y el orden importa:
 *   1. `whatsapp_chat_id` exacto — funciona SIEMPRE, incluido un LID, y es
 *      lo que se guarda cuando alguien se vincula desde WhatsApp.
 *   2. `whatsapp_numero` por dígitos — solo si el remitente llegó con un
 *      teléfono real. Nunca se intenta con un LID: sus dígitos parecen un
 *      teléfono sin serlo, y podrían colisionar con el número de otro.
 */
async function buscarUsuario(mensaje: MensajeEntrante): Promise<PerfilVinculado | null> {
  const chatId = destinoDeRespuesta(mensaje)

  const { data: porChat } = await supabaseServer
    .from('perfil_academico')
    .select('user_id, zona_horaria')
    .eq('whatsapp_chat_id', chatId)
    .maybeSingle()
  if (porChat) return { userId: porChat.user_id as string, zonaHoraria: porChat.zona_horaria as string | null }

  const telefono = telefonoDelRemitente(mensaje)
  if (!telefono) return null

  const { data: verificados } = await supabaseServer
    .from('perfil_academico')
    .select('user_id, zona_horaria, whatsapp_numero')
    .eq('whatsapp_verificado', true)
    .not('whatsapp_numero', 'is', null)

  const encontrado = (verificados ?? []).find((p) => normalizarNumero(p.whatsapp_numero as string) === telefono)
  if (!encontrado) return null

  // Se aprende el chat id la primera vez que esa persona escribe, para que
  // las siguientes no dependan de volver a resolver el teléfono.
  await supabaseServer.from('perfil_academico').update({ whatsapp_chat_id: chatId }).eq('user_id', encontrado.user_id)

  return { userId: encontrado.user_id as string, zonaHoraria: encontrado.zona_horaria as string | null }
}

/**
 * `/vincular <codigo>` — el único comando que atiende a alguien NO vinculado.
 *
 * Existe porque la vinculación por teléfono no alcanza: si el remitente
 * llega como LID nunca podrá emparejarse con un número, por muy bien que
 * haya completado el formulario de Ajustes. Acá se ata la cuenta al
 * identificador REAL con el que esa persona escribe, sea el que sea.
 */
async function intentarVinculacionPorCodigo(mensaje: MensajeEntrante, codigo: string): Promise<string> {
  const { data: fila } = await supabaseServer
    .from('whatsapp_codigos_verificacion')
    .select('id, user_id, numero, codigo, expira_en, usado')
    .eq('codigo', codigo)
    .eq('usado', false)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!fila) return 'Ese código no es válido. Pide uno nuevo desde *Ajustes → WhatsApp* en Flow+.'
  if (new Date(fila.expira_en as string).getTime() < Date.now()) return 'Ese código ya venció. Pide uno nuevo desde Flow+.'

  const chatId = destinoDeRespuesta(mensaje)
  const telefono = telefonoDelRemitente(mensaje)

  const cambios: Record<string, unknown> = { whatsapp_chat_id: chatId, whatsapp_verificado: true }
  // Solo se guarda el teléfono si de verdad lo conocemos. Si llegó como LID,
  // se conserva el que el usuario escribió en Ajustes (`fila.numero`), que
  // es el destino válido para las notificaciones salientes.
  cambios.whatsapp_numero = telefono ? `+${telefono}` : fila.numero

  const { error } = await supabaseServer.from('perfil_academico').update(cambios).eq('user_id', fila.user_id)
  if (error) {
    if (error.code === '23505') return 'Ese WhatsApp ya está vinculado a otra cuenta de Flow+.'
    return 'No pude completar la vinculación. Inténtalo de nuevo.'
  }

  await supabaseServer.from('whatsapp_codigos_verificacion').update({ usado: true }).eq('id', fila.id)
  return '✅ Listo, tu WhatsApp quedó vinculado a Flow+.\n\nEscribe */ayuda* para ver lo que puedes hacer.'
}

export async function POST(request: Request) {
  const secretoEsperado = process.env.WHAPI_WEBHOOK_SECRET
  const { searchParams } = new URL(request.url)
  if (!secretoEsperado || searchParams.get('s') !== secretoEsperado) {
    return new Response('Not found', { status: 404 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ ok: true, ignorado: 'body no es JSON' })
  }

  const canalEsperado = process.env.WHAPI_CHANNEL_ID
  const canal = canalDelPayload(payload)
  if (canalEsperado && canal && canal !== canalEsperado) {
    console.warn('[whatsapp/webhook] payload de un canal distinto:', canal)
    return Response.json({ ok: true, ignorado: 'canal no coincide' })
  }

  const mensajes = extraerMensajesDeTexto(payload).filter(debeProcesarse)
  if (mensajes.length === 0) return Response.json({ ok: true, procesados: 0 })

  let procesados = 0
  let ignorados = 0

  for (const mensaje of mensajes) {
    const destino = destinoDeRespuesta(mensaje)
    const texto = mensaje.texto.trim()
    const esComando = texto.startsWith('/')

    try {
      const usuario = await buscarUsuario(mensaje)

      // ── La regla de silencio ──
      // Sin vinculación y sin `/`, esto es correspondencia privada del
      // dueño del teléfono. Ni se responde ni se guarda su contenido.
      if (!usuario && !esComando) {
        ignorados++
        continue
      }

      if (await superaLimite(destino)) {
        await registrar({ userId: usuario?.userId ?? null, remitente: destino, mensaje: texto, comando: null, resultado: 'error', detalleError: 'límite por hora superado' })
        continue
      }

      if (!usuario) {
        // Llega acá solo si escribió un comando: sí merece respuesta.
        const vinculacion = texto.match(/^\/vincular\s+(\d{6})\s*$/i)
        const respuesta = vinculacion
          ? await intentarVinculacionPorCodigo(mensaje, vinculacion[1])
          : 'Este WhatsApp no está vinculado a ninguna cuenta de Flow+.\n\nEntra a *Ajustes → WhatsApp* en la app, pide un código y respóndeme aquí con:\n`/vincular 123456`'

        await enviarMensajeWhatsApp(destino, respuesta)
        await registrar({ userId: null, remitente: destino, mensaje: texto, comando: vinculacion ? 'vincular' : null, resultado: 'no_reconocido', detalleError: 'remitente no vinculado' })
        procesados++
        continue
      }

      const hoy = hoyEnZona(new Date(), usuario.zonaHoraria ?? ZONA_HORARIA_POR_DEFECTO)

      // ── Enrutado, en orden de coste creciente ──
      // 1. Opción de menú tocada (o su número, si se cayó al fallback de
      //    texto) → se traduce al comando equivalente. El menú solo ESCRIBE
      //    el comando por ti; no hay un camino de ejecución paralelo que
      //    pueda divergir de `/tareas`.
      // 2. Petición de menú ("hola", "menú") → se manda el menú.
      // 3. Empieza por `/` → parser determinístico: gratis e instantáneo.
      // 4. Cualquier otra cosa → la IA. Es lo que permite escribir "ensayo
      //    de historia para el viernes" sin recordar ninguna sintaxis, y
      //    cuesta una llamada a Gemini, por eso va la última.
      const opcion = mensaje.esOpcion || /^\d+$/.test(texto) ? resolverOpcion(MENU_PRINCIPAL, texto) : null
      const comandoDeMenu = opcion ? comandoDeOpcion(opcion.id) : null

      if (!comandoDeMenu && !mensaje.esOpcion && pideMenu(texto)) {
        await enviarMenuWhatsApp(destino, MENU_PRINCIPAL)
        await registrar({ userId: usuario.userId, remitente: destino, mensaje: texto, comando: 'menu', resultado: 'ejecutado' })
        procesados++
        continue
      }

      const textoAEjecutar = comandoDeMenu ?? texto
      const resultado = textoAEjecutar.startsWith('/')
        ? await ejecutarComando(usuario.userId, parsearComando(textoAEjecutar, hoy))
        : await ejecutarConIA(usuario.userId, textoAEjecutar)

      await enviarMensajeWhatsApp(destino, resultado.respuesta)
      await registrar({
        userId: usuario.userId,
        remitente: destino,
        mensaje: texto,
        comando: comandoDeMenu ? `menu→${comandoDeMenu}` : textoAEjecutar.startsWith('/') ? parsearComando(textoAEjecutar, hoy).tipo : 'ia',
        resultado: resultado.resultado,
        detalleError: resultado.detalleError,
      })
      procesados++
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error)
      console.error('[whatsapp/webhook] fallo procesando un mensaje:', detalle)
      // El texto no se registra en el camino de error: podría ser un mensaje
      // privado que ni siquiera llegó a clasificarse como comando.
      await registrar({ userId: null, remitente: destino, mensaje: esComando ? texto : '(mensaje no procesado)', comando: null, resultado: 'error', detalleError: detalle })
    }
  }

  return Response.json({ ok: true, procesados, ignorados })
}
