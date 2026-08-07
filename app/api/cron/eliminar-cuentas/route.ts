import { supabaseServer } from '@/lib/server/supabaseServer'
import { borrarArchivo } from '@/lib/server/googleDrive'
import { desvincularGoogle } from '@/lib/server/integracionGoogle'
import { debeEjecutarse } from '@/lib/cuenta/eliminacion'
import { ok, errorJson } from '@/lib/server/respuestas'

// Sprint Soporte + Eliminación de cuenta — mismo patrón que
// app/api/cron/recordatorios/route.ts: auth por CRON_SECRET, determinístico,
// un usuario que falla no bloquea a los demás.
//
// ⚠️ HALLAZGO REAL que cambia el diseño de este cron, verificado contra el
// esquema real antes de escribir una sola línea (no asumido del encargo):
// el encargo decía "esto debería cascadear automáticamente... confirma que
// es así antes de confiar en el orden". Se confirmó que NO es así para la
// mayoría de las tablas. Inspeccionado `pg_constraint` directo: solo
// `perfil_academico`, `integraciones_externas`, `archivos`, `notas` y
// `conversaciones_ia` tienen FK real a `auth.users(id) on delete cascade`.
// `materias`, `tareas`, `horario`, `memoria`, `ai_events` y
// `notificaciones_enviadas` son columnas `user_id uuid` SUELTAS, sin FK a
// `auth.users` — borrar el usuario de `auth.users` NO las toca, y quedarían
// huérfanas para siempre. Por eso este cron borra cada tabla EXPLÍCITAMENTE
// por `user_id`, sin depender de ninguna cascada.
//
// El orden entre las 8 tablas de dominio no importa: las 8 FKs internas
// reales (materias→tareas, materias→horario, tareas→notificaciones_enviadas,
// archivos→conversaciones_ia, y los `set null` de archivos/notas hacia
// tareas/materias/horario) tienen todas una acción ON DELETE explícita
// (CASCADE o SET NULL) — Postgres nunca rechaza un DELETE por eso, sin
// importar en qué orden se borren las tablas. Se eligió un orden legible
// igual (hijos antes que padres), no porque haga falta.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const TABLAS_DOMINIO = ['notas', 'conversaciones_ia', 'notificaciones_enviadas', 'archivos', 'horario', 'tareas', 'materias', 'memoria', 'ai_events'] as const

type ResultadoUsuario =
  | { userId: string; borrado: true; driveResultado: 'no_aplicaba' | 'exitoso' | 'fallo' }
  | { userId: string; borrado: false; motivo: string }

async function eliminarCuenta(userId: string, solicitadaEn: string, eliminarDriveTambien: boolean): Promise<ResultadoUsuario> {
  // El email se captura ANTES de borrar nada: después de `auth.admin.deleteUser`
  // ya no hay de dónde leerlo, y sin él el registro de auditoría no serviría
  // para identificar a quién correspondía la cuenta borrada.
  const { data: usuario, error: errorUsuario } = await supabaseServer.auth.admin.getUserById(userId)
  if (errorUsuario || !usuario?.user) {
    return { userId, borrado: false, motivo: `No se pudo leer el usuario en auth.users: ${errorUsuario?.message ?? 'no existe'}` }
  }
  const email = usuario.user.email ?? null

  // ── Drive, ANTES de tocar integraciones_externas ────────────────────────
  // `desvincularGoogle` borra la fila (y con ella, el único token que
  // permite hablarle a Drive) — el folder tree tiene que borrarse antes de
  // eso, o quedaría sin credencial para hacerlo.
  let driveResultado: 'no_aplicaba' | 'exitoso' | 'fallo' = 'no_aplicaba'
  if (eliminarDriveTambien) {
    const { data: integracion } = await supabaseServer
      .from('integraciones_externas')
      .select('carpeta_raiz_id')
      .eq('user_id', userId)
      .eq('proveedor', 'google')
      .maybeSingle<{ carpeta_raiz_id: string | null }>()

    if (integracion?.carpeta_raiz_id) {
      // `borrarArchivo` sobre una CARPETA: la API de Drive borra
      // permanentemente (bypassa la papelera) la carpeta Y todos sus
      // descendientes propiedad del usuario en la misma llamada — no hace
      // falta recorrer el árbol a mano. Ya trata un 404 (carpeta ya no
      // existe) como éxito.
      const borrado = await borrarArchivo(userId, integracion.carpeta_raiz_id)
      driveResultado = borrado.ok ? 'exitoso' : 'fallo'
      if (!borrado.ok) {
        // Best-effort, mismo criterio que el resto de la integración de
        // Drive en este proyecto (resolverIcono, resolverDedup,
        // desvincularGoogle): un fallo de Drive no debe bloquear el borrado
        // de la cuenta que el usuario pidió hace 14 días y ya no puede
        // cancelar. Queda registrado en la auditoría para seguimiento
        // manual, no silenciado.
        console.error(`[cron/eliminar-cuentas] no se pudo borrar la carpeta de Drive de ${userId}:`, borrado.detalle)
      }
    }
  }

  // Revoca el grant de Google y borra `integraciones_externas` — se hace
  // pase lo que pase con `eliminarDriveTambien` (la cuenta se está
  // borrando igual; no tiene sentido dejar un token de acceso vivo a un
  // Drive que Flow+ ya no va a volver a tocar). `desvincularGoogle` ya es
  // best-effort por dentro (nunca lanza si Google no responde).
  await desvincularGoogle(userId).catch((e) => console.error(`[cron/eliminar-cuentas] no se pudo desvincular Drive de ${userId}:`, e instanceof Error ? e.message : e))

  // ── Postgres: las 9 tablas de dominio, explícitas ───────────────────────
  const tablasBorradas: Record<string, number> = {}
  for (const tabla of TABLAS_DOMINIO) {
    const { error, count } = await supabaseServer.from(tabla).delete({ count: 'exact' }).eq('user_id', userId)
    if (error) throw new Error(`no se pudo borrar ${tabla}: ${error.message}`)
    tablasBorradas[tabla] = count ?? 0
  }

  const { error: errorPerfil, count: countPerfil } = await supabaseServer.from('perfil_academico').delete({ count: 'exact' }).eq('user_id', userId)
  if (errorPerfil) throw new Error(`no se pudo borrar perfil_academico: ${errorPerfil.message}`)
  tablasBorradas.perfil_academico = countPerfil ?? 0

  // ── auth.users al final ─────────────────────────────────────────────────
  // Es lo que de verdad quita la capacidad de iniciar sesión. Se hace al
  // final, no al principio, porque si esto tiene éxito y algo de arriba
  // hubiera fallado a mitad de camino, el usuario ya no podría volver a
  // entrar para reclamar sus datos — mejor que un fallo deje basura
  // huérfana reclamable que una cuenta fantasma sin dueño.
  const { error: errorAuth } = await supabaseServer.auth.admin.deleteUser(userId)
  if (errorAuth) throw new Error(`no se pudo borrar de auth.users: ${errorAuth.message}`)

  const { error: errorLog } = await supabaseServer.from('eliminaciones_cuenta_log').insert({
    user_id: userId,
    email,
    solicitada_en: solicitadaEn,
    elimino_drive: eliminarDriveTambien,
    drive_resultado: driveResultado,
    tablas_borradas: tablasBorradas,
  })
  // Best-effort: el borrado real (lo irreversible) ya ocurrió y tuvo éxito.
  // Perder la fila de auditoría es un problema de trazabilidad, no una
  // razón para reportar la eliminación como fallida cuando no lo fue.
  if (errorLog) console.error(`[cron/eliminar-cuentas] no se pudo escribir el log de auditoría de ${userId}:`, errorLog.message)

  return { userId, borrado: true, driveResultado }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return errorJson('CRON_SECRET no está configurado en el servidor', 500)

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) return errorJson('No autorizado', 401)

  const ahora = new Date()

  try {
    const { data: pendientes, error } = await supabaseServer
      .from('perfil_academico')
      .select('user_id, eliminacion_solicitada_en, eliminar_drive_tambien')
      .not('eliminacion_solicitada_en', 'is', null)

    if (error) return errorJson(error.message, 500)

    // Segunda comprobación en memoria con `debeEjecutarse` (la misma función
    // pura que usa la UI para calcular la fecha) además del filtro SQL —
    // documenta explícitamente el umbral en un solo lugar con tests, en vez
    // de confiar en que la resta de intervalos de Postgres y la aritmética
    // de JS coincidan siempre al milisegundo.
    const listas = (pendientes ?? []).filter((p) => debeEjecutarse(p.eliminacion_solicitada_en as string, ahora))

    const resultados: ResultadoUsuario[] = []
    const fallos: { userId: string; error: string }[] = []

    for (const perfil of listas) {
      const userId = perfil.user_id as string
      try {
        resultados.push(await eliminarCuenta(userId, perfil.eliminacion_solicitada_en as string, Boolean(perfil.eliminar_drive_tambien)))
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : 'Error desconocido'
        console.error('[cron/eliminar-cuentas] falló el usuario', userId, mensaje)
        fallos.push({ userId, error: mensaje })
      }
    }

    return ok({
      ejecutadoEn: ahora.toISOString(),
      solicitudesPendientesTotal: (pendientes ?? []).length,
      procesadas: resultados.length,
      resultados,
      ...(fallos.length > 0 ? { fallos } : {}),
    })
  } catch (e) {
    return errorJson(e instanceof Error ? e.message : 'Error desconocido', 500)
  }
}
