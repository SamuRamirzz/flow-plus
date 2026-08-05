import { ZodError } from 'zod'

// Envelope uniforme para todos los Route Handlers de la app — cada endpoint
// nuevo lo reusa en vez de construir Response.json(...) a mano con formas
// distintas cada vez.
export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status })
}

export function errorJson(mensaje: string, status = 400): Response {
  return Response.json({ error: mensaje }, { status })
}

// Primer mensaje de error de zod, en español porque el resto de la app
// (toasts, mensajes de HomeworkAgent) lo está — zod no traduce sus
// mensajes por defecto, así que cada schema debe declarar su propio
// `message` en español (ver lib/api/schemas.ts); esto solo evita repetir
// el `.issues[0].message` en cada Route Handler.
export function errorDeValidacion(error: ZodError): Response {
  const primero = error.issues[0]
  return errorJson(primero?.message ?? 'Datos inválidos', 400)
}

// Sprint Auth — respuesta única para "no hay sesión". Los 11 Route Handlers que
// llaman `getUserId()` la usan al atrapar `ErrorNoAutenticado`, para que el
// cliente reciba siempre un 401 con la misma forma y pueda distinguirlo de un
// 400 de validación (que sí es culpa de los datos, no de la sesión).
export function errorNoAutenticado(): Response {
  return errorJson('Necesitas iniciar sesión', 401)
}
