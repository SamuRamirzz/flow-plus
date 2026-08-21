import { supabaseServer } from '@/lib/server/supabaseServer'
import { errorJson } from '@/lib/server/respuestas'
import { POLITICAS, excedeLimite, inicioVentana, type AccionLimitada } from '@/lib/limites/politica'

// Tope de uso por acción costosa. Ver supabase/migrations/20260822000000
// para por qué esto cuenta filas en una tabla y no usa Redis ni memoria.
//
// Las reglas (cuánto, en cuánto tiempo, qué mensaje) viven en
// lib/limites/politica.ts, que es puro y está testeado. Acá solo va el I/O.

/**
 * Comprueba el tope y, si hay margen, registra el uso.
 *
 * Devuelve `null` si se puede continuar, o una `Response` 429 lista para
 * devolver desde el Route Handler.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Falla ABIERTO a propósito, y conviene ser explícito sobre el trade-off
 * ─────────────────────────────────────────────────────────────────────────
 * Si la consulta del contador falla, se deja pasar. Es el mismo criterio que
 * ya usa el limitador del webhook de WhatsApp, y el motivo es que un fallo
 * acá casi siempre significa que Postgres no responde — en ese estado la
 * petición se va a caer igual unos milisegundos después, y bloquearla desde
 * el limitador solo cambiaría un error real por un 429 engañoso que le dice
 * al usuario "estás yendo muy rápido" cuando el problema es del servidor.
 *
 * El coste asumido es real y se nombra: con el contador caído, el tope no
 * protege. Por eso el fallo se registra con console.error en vez de
 * tragarse en silencio — un pico de estos en los logs es la señal de que el
 * limitador dejó de existir sin que nadie se enterara, que es exactamente el
 * modo de fallo silencioso que esta auditoría encontró en el tope del
 * webhook (consultaba una columna con el nombre equivocado y llevaba
 * desactivado desde siempre, respondiendo 200 como si funcionara).
 */
export async function consumirLimite(userId: string, accion: AccionLimitada): Promise<Response | null> {
  const politica = POLITICAS[accion]
  const desde = inicioVentana(Date.now(), politica).toISOString()

  const { count, error } = await supabaseServer
    .from('limites_uso')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('accion', accion)
    .gte('creado_en', desde)

  if (error) {
    console.error(`[limites] no se pudo comprobar el tope de "${accion}":`, error.message)
    return null
  }

  if (excedeLimite(count ?? 0, politica)) {
    return errorJson(politica.mensaje, 429)
  }

  // Se registra DESPUÉS de aprobar, no antes: registrar primero contaría
  // también los intentos ya rechazados, y un usuario bloqueado se
  // autoprolongaría el bloqueo indefinidamente solo por reintentar.
  const { error: errorInsert } = await supabaseServer.from('limites_uso').insert({ user_id: userId, accion })
  if (errorInsert) console.error(`[limites] no se pudo registrar el uso de "${accion}":`, errorInsert.message)

  return null
}

/**
 * Borra filas fuera de cualquier ventana vigente. La tabla es un contador,
 * no un historial: una fila de hace un día ya no puede influir en ningún
 * tope, así que conservarla solo hace crecer la tabla para siempre.
 *
 * Lo llama el cron diario. Nunca lanza — que la limpieza falle no puede
 * tumbar la corrida del cron, que tiene trabajo más importante que hacer.
 */
export async function purgarLimitesViejos(): Promise<number> {
  const ventanaMaxima = Math.max(...Object.values(POLITICAS).map((p) => p.ventanaMinutos))
  // Margen de 1 hora sobre la ventana más larga: no hay ninguna prisa por
  // borrar al minuto exacto, y así una corrida que se retrase no deja filas
  // dentro de una ventana todavía viva.
  const corte = new Date(Date.now() - (ventanaMaxima + 60) * 60_000).toISOString()

  try {
    const { error, count } = await supabaseServer
      .from('limites_uso')
      .delete({ count: 'exact' })
      .lt('creado_en', corte)
    if (error) {
      console.error('[limites] no se pudieron purgar los topes viejos:', error.message)
      return 0
    }
    return count ?? 0
  } catch (e) {
    console.error('[limites] fallo inesperado al purgar:', e instanceof Error ? e.message : e)
    return 0
  }
}

/**
 * Borra códigos de verificación de WhatsApp ya vencidos.
 *
 * Un código es una credencial de un solo uso guardada en claro. Una vez
 * vencido no sirve para nada —`/vincular` comprueba `expira_en`— así que
 * conservarlo solo deja credenciales muertas acumulándose en la base para
 * siempre. Encontrado en la auditoría del 2026-08-22 (4 códigos vencidos
 * seguían almacenados). Severidad baja: no son canjeables. Se limpia igual,
 * porque el dato más seguro es el que no está.
 *
 * Margen de 24h sobre el vencimiento: la ventana real son 10 minutos, y así
 * queda rastro suficiente para diagnosticar un problema de vinculación
 * reciente sin conservar nada a largo plazo.
 */
export async function purgarCodigosVencidos(): Promise<number> {
  const corte = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  try {
    const { error, count } = await supabaseServer
      .from('whatsapp_codigos_verificacion')
      .delete({ count: 'exact' })
      .lt('expira_en', corte)
    if (error) {
      console.error('[limites] no se pudieron purgar los códigos vencidos:', error.message)
      return 0
    }
    return count ?? 0
  } catch (e) {
    console.error('[limites] fallo inesperado al purgar códigos:', e instanceof Error ? e.message : e)
    return 0
  }
}
