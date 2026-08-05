import { aiOrchestrator } from '@/lib/ai'
import { bootstrapAI } from '@/lib/ai/bootstrap'
import { createId } from '@/lib/ai/utils'
import { HOMEWORK_AGENT_ID, type HomeworkAgentOutput } from '@/lib/ai/agents/homework'
import { requerirUsuario } from '@/lib/server/usuario'

// Primera versión con IA real (Sprint 2): HomeworkAgent llama a Gemini
// 2.5 Flash-Lite con salida estructurada. Sigue sin OCR/imágenes/PDF y sin
// persistencia propia — la pantalla /ai es quien decide si guarda el
// resultado en Supabase, este endpoint solo devuelve el AgentResult.
bootstrapAI()

export async function POST(request: Request) {
  const auth = await requerirUsuario()
  if (!auth.ok) return auth.respuesta

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido: se esperaba JSON' }, { status: 400 })
  }

  const text =
    typeof body === 'object' && body !== null && 'text' in body ? (body as { text: unknown }).text : undefined

  if (typeof text !== 'string' || text.trim().length === 0) {
    return Response.json({ error: 'El campo "text" es requerido y debe ser un string no vacío' }, { status: 400 })
  }

  // Sprint 9: ya NO se pasa un contexto mínimo a mano. Pasarlo
  // cortocircuitaría la carga real (execute() usa `context ?? build(...)`),
  // y HomeworkAgent declara `contextScopes: ['schedule','identity']` — así
  // recibe la fecha en la zona horaria del usuario y sus materias reales,
  // en vez del reloj del proceso y ninguna materia.
  //
  // También pasa a usar el userId real del proyecto en vez del literal
  // 'dev-user': el contexto consulta `materias`/`horario`/`perfil_academico`
  // filtrando por user_id, y con un id inventado no encontraría nada.
  const userId = auth.userId
  const result = await aiOrchestrator.execute<HomeworkAgentOutput>(HOMEWORK_AGENT_ID, {
    id: createId('req'),
    agentId: HOMEWORK_AGENT_ID,
    userId,
    input: text,
  })

  return Response.json(result)
}
