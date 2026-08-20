import { requerirUsuario } from '@/lib/server/usuario'
import { crearTareaServidor } from '@/lib/server/tareas'
import { crearTareaSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Borde HTTP de la creación de tareas. Toda la lógica real vive en
// `crearTareaServidor` (lib/server/tareas.ts) desde el Sprint 2/3 — se
// extrajo de acá para que el ejecutor de comandos de WhatsApp pueda crear
// tareas por el MISMO camino, sin duplicar la resolución de materia, la
// inferencia de fecha desde el horario, el enriquecimiento de examen ni la
// validación de CalendarAgent, y sin hacerse un fetch HTTP a sí mismo.
// Mismo patrón que ya siguen lib/server/horario.ts y lib/server/notas.ts.
//
// Este handler conserva exactamente lo que le corresponde a un borde HTTP:
// autenticar, validar el body con zod, y traducir el resultado a códigos de
// estado. La respuesta es byte a byte la misma que antes de la extracción.
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

  const parsed = crearTareaSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const resultado = await crearTareaServidor(userId, parsed.data)
  if (!resultado.ok) return errorJson(resultado.error, resultado.status)

  return ok(
    {
      tarea: resultado.tarea,
      materiaCreada: resultado.materiaCreada,
      posibleDuplicado: resultado.posibleDuplicado,
      fechaInferida: resultado.fechaInferida,
      avisoFecha: resultado.avisoFecha,
      colisiones: resultado.colisiones,
    },
    201
  )
}
