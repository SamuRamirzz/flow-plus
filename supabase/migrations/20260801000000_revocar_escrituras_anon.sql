-- Cierre de Fase 1 — endurecimiento de permisos. Hallazgo de la auditoría.
--
-- QUÉ ENCONTRÓ LA AUDITORÍA: las 7 tablas de `public` tienen RLS activa,
-- pero las 7 políticas son `using (true) with check (true)` y los roles
-- `anon`/`authenticated` conservaban los grants por defecto de Supabase
-- (SELECT, INSERT, UPDATE, DELETE, TRUNCATE...). Verificado empíricamente
-- con la clave anónima —la que viaja en el bundle del navegador y cualquiera
-- puede leer desde devtools—: se pudo leer las tareas reales del usuario,
-- insertar una fila en `ai_events` y emitir un UPDATE sobre `tareas` sin que
-- ninguna política lo rechazara. Tener "RLS activa" silenciaba el lint de
-- Supabase pero no protegía nada.
--
-- ⚠️ ORDEN OBLIGATORIO — ESTA MIGRACIÓN DEPENDE DE UN CAMBIO DE CÓDIGO.
-- Un primer intento de esta misma migración rompió TODAS las escrituras de
-- la app y hubo que revertirlo: `lib/server/supabaseServer.ts` usaba la
-- MISMA clave anónima del lado del servidor, así que quitarle escritura a
-- `anon` se la quitaba también a los Route Handlers (síntoma real:
-- POST /api/tareas → "permission denied for table materias").
-- Antes de aplicar esto, `supabaseServer.ts` DEBE estar usando
-- SUPABASE_SERVICE_ROLE_KEY (ya lo está — mismo commit que esta migración).
--
-- QUÉ HACE: revoca los permisos de ESCRITURA de los roles públicos. Ya no
-- los necesita nadie — el Sprint 6 movió todas las mutaciones a Route
-- Handlers, que ahora se autentican con service_role; verificado por grep
-- que no queda ni una llamada a .insert/.update/.delete/.upsert sobre tablas
-- de `public` desde el cliente del navegador.
--
-- QUÉ *NO* HACE, a propósito: no revoca SELECT. Cuatro lecturas siguen
-- saliendo del navegador con la clave anónima (lib/tasks.ts,
-- lib/horario/cargar.ts, app/ai/page.tsx) y revocar SELECT las rompería.
--
-- RIESGO RESIDUAL ACEPTADO Y CONOCIDO (decisión explícita del usuario):
-- cualquiera con la clave pública todavía puede LEER todos los datos del
-- usuario. Lo que ya no puede es modificarlos, borrarlos, ni vaciar una
-- tabla con TRUNCATE. El cierre de la lectura llega con el predicado
-- `auth.uid() = user_id` del sprint de Auth (ya escrito, comentado, en cada
-- migración) o moviendo esas 4 lecturas a Route Handlers.
--
-- Tampoco toca `storage.objects`: lib/storage.ts sube archivos desde el
-- cliente (buckets `horarios`/`tareas`) y eso vive en el esquema `storage`,
-- no en `public`. Sus políticas se endurecen en el sprint de Auth, cuando el
-- primer segmento del path pueda compararse contra auth.uid().
--
-- Idempotente: REVOKE sobre un permiso que ya no está no da error.

revoke insert, update, delete, truncate on public.materias                from anon, authenticated;
revoke insert, update, delete, truncate on public.tareas                  from anon, authenticated;
revoke insert, update, delete, truncate on public.horario                 from anon, authenticated;
revoke insert, update, delete, truncate on public.memoria                 from anon, authenticated;
revoke insert, update, delete, truncate on public.ai_events               from anon, authenticated;
revoke insert, update, delete, truncate on public.perfil_academico        from anon, authenticated;
revoke insert, update, delete, truncate on public.notificaciones_enviadas from anon, authenticated;

-- Que las tablas FUTURAS no vuelvan a nacer con escritura abierta: sin esto,
-- la próxima migración que haga `create table` repone el problema en
-- silencio. (No afecta a service_role, que es un rol con bypass.)
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;
