import { requerirUsuario } from '@/lib/server/usuario'
import { clienteDeSesion } from '@/lib/server/sesion'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { actualizarPerfilSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'
import { nombreCompletoDeClaims } from '@/lib/onboarding/saludo'
import { ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import type { FormatoReloj } from '@/lib/hora'

const COLUMNAS_PERFIL =
  'nombre, apellido, pais, zona_horaria, formato_reloj, max_notif_por_dia, no_molestar_desde, no_molestar_hasta, onboarding_completado, whatsapp_numero, whatsapp_verificado, whatsapp_notificaciones'

type FilaPerfil = {
  nombre: string | null
  apellido: string | null
  pais: string | null
  zona_horaria: string
  formato_reloj: FormatoReloj
  max_notif_por_dia: number
  no_molestar_desde: string | null
  no_molestar_hasta: string | null
  onboarding_completado: boolean
  whatsapp_numero: string | null
  whatsapp_verificado: boolean
  whatsapp_notificaciones: boolean
}

// Mismo shape en GET y en la respuesta de PATCH — camelCase, para que el
// cliente (lib/preferencias.tsx y la categoría Perfil de Ajustes) nunca
// tenga que conocer los nombres de columna reales.
function mapearPerfil(fila: FilaPerfil | null) {
  return {
    nombre: fila?.nombre ?? null,
    apellido: fila?.apellido ?? null,
    pais: fila?.pais ?? null,
    zonaHoraria: fila?.zona_horaria ?? ZONA_HORARIA_POR_DEFECTO,
    formatoReloj: fila?.formato_reloj ?? '24h',
    maxNotifPorDia: fila?.max_notif_por_dia ?? 3,
    noMolestarDesde: fila?.no_molestar_desde ?? null,
    noMolestarHasta: fila?.no_molestar_hasta ?? null,
    onboardingCompletado: fila?.onboarding_completado ?? false,
    whatsappNumero: fila?.whatsapp_numero ?? null,
    whatsappVerificado: fila?.whatsapp_verificado ?? false,
    whatsappNotificaciones: fila?.whatsapp_notificaciones ?? false,
  }
}

// Sección Ajustes — lo que carga app/layout.tsx server-side (vía una
// consulta directa, este GET es para el cliente: PreferenciasProvider no
// necesita pegarle a esto en el primer render, pero cualquier
// re-sincronización sí) y lo que usa la categoría Perfil para poblar el
// formulario al entrar.
export async function GET() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  const { data, error } = await supabaseServer.from('perfil_academico').select(COLUMNAS_PERFIL).eq('user_id', auth.userId).maybeSingle()
  if (error) return errorJson(error.message, 500)

  return ok(mapearPerfil(data))
}

// Sprint Onboarding — marca que el usuario ya vio la pantalla de bienvenida.
// Sección Ajustes — ampliado a cualquier campo de perfil_academico
// (nombre/zona horaria/formato de reloj/preferencias de notificación).
//
// Lo llama components/onboarding/Bienvenida.tsx (onboardingCompletado) Y
// las 4 categorías de Ajustes que editan perfil_academico. Cerrar la
// pestaña a mitad de la bienvenida NO llega acá, y por eso el onboarding
// vuelve a salir la próxima vez — que es justo lo que pedía el encargo.
export async function PATCH(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('El cuerpo de la petición no es JSON válido')
  }

  const parseado = actualizarPerfilSchema.safeParse(body)
  if (!parseado.success) return errorDeValidacion(parseado.error)
  const { onboardingCompletado, nombre, apellido, pais, zonaHoraria, formatoReloj, maxNotifPorDia, noMolestarDesde, noMolestarHasta, whatsappNotificaciones } = parseado.data

  // Mismo patrón que PATCH /api/tareas/[id]: se construye campo por campo
  // según lo que de verdad vino en el body — nunca todo el objeto de una
  // vez, porque un PATCH parcial (ej. solo formatoReloj) pisaría el resto
  // de columnas con `undefined` si no se filtra así.
  const campos: Record<string, unknown> = { user_id: userId }
  if (onboardingCompletado !== undefined) campos.onboarding_completado = onboardingCompletado
  if (nombre !== undefined) campos.nombre = nombre
  if (apellido !== undefined) campos.apellido = apellido
  if (pais !== undefined) campos.pais = pais
  if (zonaHoraria !== undefined) campos.zona_horaria = zonaHoraria
  if (formatoReloj !== undefined) campos.formato_reloj = formatoReloj
  if (maxNotifPorDia !== undefined) campos.max_notif_por_dia = maxNotifPorDia
  if (noMolestarDesde !== undefined) campos.no_molestar_desde = noMolestarDesde
  if (noMolestarHasta !== undefined) campos.no_molestar_hasta = noMolestarHasta
  // Solo la preferencia: el número y su verificación se escriben únicamente
  // desde /api/whatsapp/vincular y /verificar (ver actualizarPerfilSchema).
  if (whatsappNotificaciones !== undefined) campos.whatsapp_notificaciones = whatsappNotificaciones

  // ── Relleno oportunista del nombre ──────────────────────────────────────
  // El trigger `crear_perfil_al_registrarse` solo corre en el INSERT de
  // auth.users, así que un usuario que se dio de alta por magic link (sin
  // nombre) y vinculó Google después se queda con `nombre = NULL` para
  // siempre, aunque su metadata SÍ tenga el nombre. Este es el único
  // momento del ciclo de vida en que ya tenemos una sesión verificada en la
  // mano y estamos escribiendo el perfil de todos modos, así que rellenarlo
  // acá sale gratis y evita una migración de trigger nueva.
  //
  // Si el body YA trae `nombre` explícito (edición deliberada desde
  // Ajustes), este autorelleno no debe pisarlo — por eso solo corre cuando
  // `campos.nombre` sigue sin definir.
  if (campos.nombre === undefined) {
    const { data: perfil } = await supabaseServer.from('perfil_academico').select('nombre').eq('user_id', userId).maybeSingle()
    if (!perfil?.nombre) {
      const supabase = await clienteDeSesion()
      const { data: claims } = await supabase.auth.getClaims()
      const nombreDeClaims = nombreCompletoDeClaims(claims?.claims)
      if (nombreDeClaims) campos.nombre = nombreDeClaims
    }
  }

  // `upsert` y no `update`: un UPDATE contra una fila que no existe afecta 0
  // filas y devuelve éxito sin avisar. La fila PUEDE no existir: el trigger
  // que la crea al registrarse atrapa sus propios errores y deja seguir el
  // alta (decisión deliberada del Sprint Auth) — esto cierra ese hueco sin
  // tocar el trigger.
  const { data: actualizado, error } = await supabaseServer
    .from('perfil_academico')
    .upsert(campos, { onConflict: 'user_id' })
    .select(COLUMNAS_PERFIL)
    .single()

  if (error) return errorJson(error.message, 500)

  return ok(mapearPerfil(actualizado))
}
