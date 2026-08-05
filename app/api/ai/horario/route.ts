import { aiOrchestrator } from '@/lib/ai'
import { bootstrapAI } from '@/lib/ai/bootstrap'
import { createId } from '@/lib/ai/utils'
import { CLASS_SCHEDULE_AGENT_ID, type ClassScheduleAgentOutput } from '@/lib/ai/agents/classSchedule'
import { requerirUsuario } from '@/lib/server/usuario'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { cargarHorarioServidor } from '@/lib/server/horario'
import { diffHorario } from '@/lib/horario/diff'
import { analizarHorarioSchema } from '@/lib/api/schemas'
import { ok, errorJson, errorDeValidacion } from '@/lib/server/respuestas'

// Sprint 8 — lee una foto de horario y PROPONE bloques. No escribe nada en
// la tabla `horario`: devuelve la propuesta + el diff contra lo que el
// usuario ya tiene, y el guardado real lo hace la grilla de /horario con los
// endpoints del Sprint 7 (app/api/horario[/[id]]) cuando el usuario
// confirma. Un solo camino de escritura, como el resto del proyecto.
bootstrapAI()

export const BUCKET_HORARIOS = 'horarios'

export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorJson('Body inválido: se esperaba JSON')
  }

  const parsed = analizarHorarioSchema.safeParse(body)
  if (!parsed.success) return errorDeValidacion(parsed.error)

  const userId = auth.userId
  const { ruta } = parsed.data

  // La imagen viaja por Storage, no en el body: una foto de celular pesa
  // 3-8MB y mandarla como base64 en JSON la infla otro ~33% y se come el
  // límite de body del Route Handler. El cliente sube el archivo reducido y
  // acá solo llega su ruta.
  const { data: archivo, error: errorDescarga } = await supabaseServer.storage.from(BUCKET_HORARIOS).download(ruta)
  if (errorDescarga || !archivo) {
    return errorJson(`No se pudo leer la imagen subida: ${errorDescarga?.message ?? 'no encontrada'}`, 404)
  }

  const base64 = Buffer.from(await archivo.arrayBuffer()).toString('base64')
  const mimeType = archivo.type || 'image/jpeg'

  const result = await aiOrchestrator.execute<ClassScheduleAgentOutput>(
    CLASS_SCHEDULE_AGENT_ID,
    {
      id: createId('req'),
      agentId: CLASS_SCHEDULE_AGENT_ID,
      userId,
      input: 'Extrae todos los bloques de este horario de clases.',
      metadata: { adjuntos: [{ tipo: 'imagen', datosBase64: base64, mimeType }] },
    },
    { userId, generatedAt: Date.now() }
  )

  // Bug real encontrado probando el flujo de foto de punta a punta
  // (verificando el aviso de materias nuevas, no relacionado con esta
  // rama): esto devolvía `result` crudo, sin el envelope `{resultado,
  // diff}` que SIEMPRE espera el cliente (importarHorarioDesdeFoto
  // destructura `resultado` de la respuesta) — con HTTP 200 (Response.json
  // sin status es 200 por default) pero sin esa forma, `resultado` quedaba
  // `undefined` y el acceso a `resultado.status` explotaba en el cliente
  // ANTES de llegar al mensaje de error ya construido en PropuestaFoto.tsx
  // (rama `tipoRespuesta !== 'bloques'`). `diff` vacío: esta rama de
  // fallo nunca llega a leerlo (importarFoto.ts corta antes), pero mantiene
  // el tipo de retorno honesto en vez de mandar `undefined` donde el
  // contrato promete un DiffHorario real.
  if (result.status !== 'success' || !result.output) {
    return ok({ resultado: result, diff: { agregados: [], movidos: [], sinCambios: [], eliminados: [] } })
  }

  // El diff se calcula acá y no en el agente: es determinístico y no
  // necesita al modelo (lib/horario/diff.ts es puro y está testeado sin
  // red). El agente hace una sola cosa — imagen → bloques.
  const [guardado, { data: materias }] = await Promise.all([
    cargarHorarioServidor(userId),
    supabaseServer.from('materias').select('id, nombre').eq('user_id', userId),
  ])

  const nombrePorMateriaId = new Map((materias ?? []).map((m) => [m.id as string, m.nombre as string]))
  const diff = diffHorario({ guardado, propuesto: result.output.bloques, nombrePorMateriaId })

  return ok({ resultado: result, diff })
}
