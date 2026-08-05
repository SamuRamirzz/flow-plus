import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cliente de Supabase para usar SOLO desde Route Handlers — separado de
// lib/supabase.ts (el cliente del navegador).
//
// USA service_role, NO la clave anónima (cambió en el cierre de Fase 1).
// El motivo es un hallazgo concreto de la auditoría: mientras este archivo
// usaba la misma clave anónima que el navegador, era imposible quitarle a
// `anon` el permiso de escritura — hacerlo rompía todas las mutaciones de la
// app, porque el servidor se autenticaba con ese mismo rol (comprobado:
// revocar los grants devolvió "permission denied for table materias" en
// POST /api/tareas). Con una credencial propia del servidor, los permisos de
// `anon` se pueden cerrar sin tocar la funcionalidad, que es justo lo que
// hace la migración 20260801000000.
//
// service_role SALTA RLS por completo. Eso es aceptable —y necesario— acá
// porque cada Route Handler ya filtra explícitamente por getUserId() en cada
// consulta; RLS nunca fue la barrera real del lado del servidor (con la clave
// anónima tampoco lo era: la política es `using (true)`). La barrera real es
// el filtro por user_id del código, y cuando llegue auth pasará a haber
// además una política de verdad para el camino del navegador.
//
// NUNCA prefijar esta variable con NEXT_PUBLIC_: eso la metería en el bundle
// del cliente y regalaría acceso total a la base.
//
// La costura importa para cuando llegue auth: este archivo pasará a crear
// un cliente por request, leyendo la cookie de sesión — lib/supabase.ts
// (el del navegador) no cambia.
//
// CONSTRUCCIÓN PEREZOSA (Sprint 9): antes el cliente se creaba al importar
// el módulo, así que cualquier archivo que lo tuviera en su cadena de
// imports —aunque no llegara a consultar nada— exigía las variables de
// entorno. Eso hacía imposible probar en Vitest piezas puras como
// ContextEngine, cuyo único vínculo con Supabase son los loaders POR
// DEFECTO (que un test sustituye por dobles). Con el Proxy, el cliente se
// construye en el primer acceso real a una propiedad, no al importar; los
// llamadores siguen escribiendo `supabaseServer.from(...)` sin cambio.
let cliente: SupabaseClient | null = null

function obtenerCliente(): SupabaseClient {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRoleKey) {
      throw new Error(
        'Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — el cliente de servidor de Supabase no se puede crear.'
      )
    }
    // persistSession/autoRefreshToken en false: no hay ninguna sesión de
    // usuario que mantener (es una credencial de servicio), y en un proceso
    // de servidor no existe el almacenamiento donde persistirla.
    cliente = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return cliente
}

export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_destino, propiedad, receptor) {
    const valor = Reflect.get(obtenerCliente(), propiedad, receptor)
    // Los métodos se reenlazan al cliente real: si se devolvieran sueltos,
    // `this` dentro de ellos sería el Proxy y no el SupabaseClient.
    return typeof valor === 'function' ? valor.bind(obtenerCliente()) : valor
  },
})
