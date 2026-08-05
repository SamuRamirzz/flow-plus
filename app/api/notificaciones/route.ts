import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { hoyEnZona, ZONA_HORARIA_POR_DEFECTO } from '@/lib/ai/context/fecha'
import { diasEntre } from '@/lib/horario/dias'
import { ok, errorJson } from '@/lib/server/respuestas'

// Lo que NotificationBell.tsx lee — reemplaza el cálculo en cada render
// (new Date() + ventana fija en el cliente) por las filas que el cron de
// hoy ya decidió y guardó en notificaciones_enviadas. `diasRestantes` se
// recalcula acá (no se guarda en la tabla) porque es barato, puro, y
// guardarlo lo dejaría desactualizado si el usuario abre la campana horas
// después de que corrió el cron.
export async function GET() {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta
  const userId = auth.userId

  const { data: perfil } = await supabaseServer.from('perfil_academico').select('zona_horaria').eq('user_id', userId).maybeSingle()

  const zonaHoraria = (perfil?.zona_horaria as string | undefined) ?? ZONA_HORARIA_POR_DEFECTO
  const hoy = hoyEnZona(new Date(), zonaHoraria)

  const { data, error } = await supabaseServer
    .from('notificaciones_enviadas')
    .select('tarea_id, urgencia, agrupada, tareas(titulo, materia_id, fecha_entrega, prioridad)')
    .eq('user_id', userId)
    .eq('fecha', hoy)

  if (error) return errorJson(error.message, 500)

  type FilaTarea = { titulo: string; materia_id: string; fecha_entrega: string | null; prioridad: string }
  const notificaciones = (data ?? [])
    // El embed de PostgREST devuelve `tareas` como objeto cuando la FK es
    // 1:1 (tarea_id → tareas.id) — pero si la tarea se borró después de
    // generarse el recordatorio (on delete cascade la habría borrado
    // también a ELLA, así que esto en la práctica no debería pasar; se
    // filtra igual por si acaso, nunca confiar en que un join siempre
    // resuelve).
    .filter((n) => n.tareas !== null)
    .map((n) => {
      const tarea = n.tareas as unknown as FilaTarea
      return {
        tareaId: n.tarea_id as string,
        titulo: tarea.titulo,
        materiaId: tarea.materia_id,
        prioridad: tarea.prioridad,
        fechaEntrega: tarea.fecha_entrega,
        diasRestantes: tarea.fecha_entrega ? diasEntre(hoy, tarea.fecha_entrega) : null,
        urgencia: n.urgencia as 'baja' | 'media' | 'alta',
        agrupada: n.agrupada as boolean,
      }
    })

  return ok({ hoy, notificaciones })
}
