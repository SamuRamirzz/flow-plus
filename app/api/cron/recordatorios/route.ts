import { supabaseServer } from '@/lib/server/supabaseServer'
import { hoyEnZona, horaEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import { calcularVentanaRecordatorio } from '@/lib/ai/agents/reminder'
import { decidirNotificar, type CandidatoNotificacion } from '@/lib/ai/agents/notification'
import { ok, errorJson } from '@/lib/server/respuestas'

// Vercel Cron invoca este endpoint una vez al día (ver vercel.json, "0 13
// * * *" = 13:00 UTC ≈ 08:00 America/Bogota). No usa ningún modelo — mismo
// criterio que calendar/validar.ts (Sprint 10): toda la decisión (ventanas,
// no-redundancia, tope diario, agrupación) es determinística, así que esto
// corre con cero tokens y cero latencia de proveedor.
//
// Verificado contra la documentación real de Vercel (no asumido): en el
// plan Hobby (el esperado para este proyecto personal), la hora exacta NO
// es exacta — Vercel puede disparar en cualquier momento DENTRO de la hora
// indicada (08:00:00–08:59:59), para repartir carga entre cuentas. Y la
// entrega puede duplicarse (reintento interno de Vercel) — por eso
// `ignoreDuplicates` + el índice único de la migración no son opcionales,
// son la garantía real de "correr dos veces no duplica", más que
// decidirNotificar por sí solo.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Comparación de strings "HH:MM" — funciona lexicográficamente igual que
// numéricamente para este formato de ancho fijo, así que no hace falta
// parsear a minutos. Maneja el caso de una ventana que cruza medianoche
// (ej. desde=22:00, hasta=07:00): si `desde > hasta`, la ventana real es
// "desde ESA hora hasta medianoche, MÁS desde medianoche hasta esa hora".
function enVentanaDeNoMolestar(horaActual: string, desde: string | null, hasta: string | null): boolean {
  if (!desde || !hasta) return false
  const d = desde.slice(0, 5)
  const h = hasta.slice(0, 5)
  return d <= h ? horaActual >= d && horaActual < h : horaActual >= d || horaActual < h
}

type ResultadoUsuario =
  | { userId: string; procesado: false; motivo: 'no_molestar'; hoy: string }
  | { userId: string; procesado: true; hoy: string; candidatos: number; notificadas: number }

// Todo el trabajo de un usuario vive en esta función. La nota de secuencia del
// Sprint 11 decía: "el día que exista una lista real de usuarios, el handler
// pasa de `procesarUsuario(getUserId(), ahora)` a iterar esa lista llamando
// esto mismo por cada uno — esta función no cambia en absoluto".
//
// Sprint Auth: se cumplió literalmente. Esta función NO cambió ni una línea;
// solo el handler de abajo. Cada usuario trae su propio `perfil_academico`
// (zona horaria, tope diario, no-molestar), así que las tres cosas ya eran
// por-persona desde el Sprint 11 — no eran globales disfrazadas.
async function procesarUsuario(userId: string, ahora: Date): Promise<ResultadoUsuario> {
  const { data: perfil } = await supabaseServer
    .from('perfil_academico')
    .select('zona_horaria, max_notif_por_dia, no_molestar_desde, no_molestar_hasta')
    .eq('user_id', userId)
    .maybeSingle()

  const zonaHoraria = (perfil?.zona_horaria as string | undefined) ?? ZONA_HORARIA_POR_DEFECTO
  const maxPorDia = (perfil?.max_notif_por_dia as number | undefined) ?? 3
  const hoy = hoyEnZona(ahora, zonaHoraria)

  // "No molestar" evaluado contra el momento en que CORRE el cron (una vez
  // al día), no contra un horario intradía: si este momento cae en la
  // ventana configurada, este usuario simplemente no recibe nada hoy — se
  // retoma en la próxima corrida (mañana). Ver el comentario de la
  // migración para la justificación completa de este alcance.
  const noMolestarDesde = (perfil?.no_molestar_desde as string | null | undefined) ?? null
  const noMolestarHasta = (perfil?.no_molestar_hasta as string | null | undefined) ?? null
  if (enVentanaDeNoMolestar(horaEnZona(ahora, zonaHoraria), noMolestarDesde, noMolestarHasta)) {
    return { userId, procesado: false, motivo: 'no_molestar', hoy }
  }

  const { data: tareas, error: errorTareas } = await supabaseServer
    .from('tareas')
    .select('id, fecha_entrega, prioridad, tipo')
    .eq('user_id', userId)
    .eq('completada', false)

  if (errorTareas) throw new Error(errorTareas.message)

  const candidatos: CandidatoNotificacion[] = (tareas ?? [])
    .map((t) => {
      const tarea = { id: t.id as string, fecha: t.fecha_entrega as string | null, prioridad: t.prioridad as string, tipo: t.tipo as string }
      return { tarea, ventana: calcularVentanaRecordatorio(tarea, hoy) }
    })
    .filter(({ ventana }) => ventana.debeRecordar)
    .map(({ tarea, ventana }) => ({ tareaId: tarea.id, urgencia: ventana.urgencia, tipo: tarea.tipo }))

  if (candidatos.length === 0) return { userId, procesado: true, hoy, candidatos: 0, notificadas: 0 }

  // Filtrado a HOY acá, no dentro de decidirNotificar (que no sabe de
  // fechas) — mismo patrón que POST /api/tareas filtra "mismo día" antes
  // de llamar a detectarColisiones (Sprint 10).
  const { data: yaEnviadasHoy, error: errorYaEnviadas } = await supabaseServer
    .from('notificaciones_enviadas')
    .select('tarea_id, tipo')
    .eq('user_id', userId)
    .eq('fecha', hoy)

  if (errorYaEnviadas) throw new Error(errorYaEnviadas.message)

  const yaEnviadas = (yaEnviadasHoy ?? []).map((n) => ({ tareaId: n.tarea_id as string, tipo: n.tipo as string }))
  const decisiones = decidirNotificar(candidatos, yaEnviadas, maxPorDia)

  if (decisiones.length === 0) return { userId, procesado: true, hoy, candidatos: candidatos.length, notificadas: 0 }

  const porTareaId = new Map(candidatos.map((c) => [c.tareaId, c]))
  const filas = decisiones.map((d) => {
    const candidato = porTareaId.get(d.tareaId)!
    return { user_id: userId, tarea_id: d.tareaId, tipo: candidato.tipo, urgencia: candidato.urgencia, fecha: hoy, agrupada: d.agrupar }
  })

  // ignoreDuplicates + el índice único (tarea_id, tipo, fecha) de la
  // migración son la defensa REAL contra una corrida solapada — si dos
  // invocaciones del cron chocan (reintento de Vercel, doble trigger a
  // mano), la segunda no falla ni duplica, simplemente no repite lo que la
  // primera ya insertó. decidirNotificar ya debería haber filtrado esto
  // por su cuenta contra `yaEnviadas`, así que en el camino normal esta
  // defensa nunca se activa — está para el camino anormal.
  const { error: errorInsert } = await supabaseServer
    .from('notificaciones_enviadas')
    .upsert(filas, { onConflict: 'tarea_id,tipo,fecha', ignoreDuplicates: true })

  if (errorInsert) throw new Error(errorInsert.message)

  return { userId, procesado: true, hoy, candidatos: candidatos.length, notificadas: filas.length }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return errorJson('CRON_SECRET no está configurado en el servidor', 500)

  // Un cron sin este chequeo es un endpoint público que escribe en la base
  // — aunque este sprint no llame a ningún proveedor pagado (a diferencia
  // de, por ejemplo, un cron que sí disparara IA), sigue siendo un punto de
  // escritura no autenticado si se deja abierto.
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) return errorJson('No autorizado', 401)

  const ahora = new Date()

  try {
    // Sprint Auth — multi-usuario real. Se itera sobre los usuarios que
    // PODRÍAN necesitar un recordatorio (los que tienen alguna tarea
    // pendiente), no sobre todos los registrados: un usuario sin tareas
    // pendientes no puede generar ninguna notificación, así que consultarlo
    // sería trabajo garantizado a cero.
    //
    // Nota de escala (el encargo pide no introducir a propósito una consulta
    // que escale mal): esto es 1 consulta para la lista + 3 por usuario. Con
    // decenas de usuarios es irrelevante. Si algún día son miles, el cambio
    // natural es traer las tareas pendientes de TODOS en una sola consulta y
    // agruparlas en memoria — pero eso complica `procesarUsuario` sin ningún
    // beneficio medible hoy, así que no se hace por adelantado.
    //
    // `service_role` (supabaseServer) es correcto acá y es el caso que su
    // propio comentario reserva: el cron legítimamente cruza usuarios, así
    // que RLS no debe aplicarle.
    const { data: filas, error: errorUsuarios } = await supabaseServer
      .from('tareas')
      .select('user_id')
      .eq('completada', false)

    if (errorUsuarios) return errorJson(errorUsuarios.message, 500)

    const userIds = [...new Set((filas ?? []).map((f) => f.user_id as string))]

    // Secuencial, no en paralelo: son escrituras contra la misma tabla y el
    // volumen es mínimo. Un `Promise.all` acá solo añadiría contención y
    // haría más difícil atribuir un fallo a un usuario concreto.
    const resultados: ResultadoUsuario[] = []
    const fallos: { userId: string; error: string }[] = []
    for (const userId of userIds) {
      try {
        resultados.push(await procesarUsuario(userId, ahora))
      } catch (error) {
        // Un usuario que falla NO debe impedir que los demás reciban sus
        // recordatorios — el cron corre una vez al día, y abortar entero por
        // uno solo dejaría a todos sin notificaciones hasta mañana.
        const mensaje = error instanceof Error ? error.message : 'Error desconocido'
        console.error('[cron/recordatorios] falló el usuario', userId, mensaje)
        fallos.push({ userId, error: mensaje })
      }
    }

    return ok({
      ejecutadoEn: ahora.toISOString(),
      usuariosConsiderados: userIds.length,
      usuarios: resultados,
      ...(fallos.length > 0 ? { fallos } : {}),
    })
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : 'Error desconocido', 500)
  }
}
