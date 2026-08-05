-- Sprint Auth / Fase 3 — RLS real: de `using (true)` a `auth.uid() = user_id`.
--
-- ⚠️⚠️ ORDEN DE APLICACIÓN — NO APLICAR ANTES DE TIEMPO ⚠️⚠️
--
-- Esta migración debe aplicarse DESPUÉS de las dos cosas siguientes, en este
-- orden, y no antes:
--   1. El login funciona de verdad y Samuel ya se registró.
--   2. `supabase/migracion-manual-usuario-original.sql` ya corrió (sus datos
--      ya están bajo su `auth.uid()` real).
--
-- El encargo pedía "no aplicarla antes de que el login funcione". Es
-- necesario pero NO suficiente, y el motivo se descubrió revisando qué lee el
-- navegador: si se aplica con el login ya listo pero los datos todavía bajo
-- `USUARIO_SIN_AUTH`, Samuel entra con su cuenta real y ve **la app vacía** —
-- las 4 lecturas de cliente (cargarMaterias, cargarTareas, cargarHorario y la
-- de app/ai/page.tsx) empezarían a filtrar por un `auth.uid()` que no coincide
-- con el `user_id` de ninguna fila. No se pierde nada, pero parece que sí.
--
-- ─────────────────────────────────────────────────────────────────────────
-- QUÉ SE ROMPE Y QUÉ NO (verificado, no supuesto)
-- ─────────────────────────────────────────────────────────────────────────
-- NO se rompe ninguna ESCRITURA de la app: desde el cierre de Fase 1,
-- `lib/server/supabaseServer.ts` usa SUPABASE_SERVICE_ROLE_KEY, y
-- service_role **salta RLS por completo**. Todos los Route Handlers escriben
-- por ahí. Su barrera real es el filtro `.eq('user_id', getUserId())` del
-- código, que la Fase 4 convierte en la sesión real.
--
-- Sí cambia (y es el objetivo) lo que ve el NAVEGADOR: `anon`/`authenticated`
-- tienen hoy solo el grant SELECT (INSERT/UPDATE/DELETE se revocaron en la
-- migración 20260801000000), así que el efecto neto de esta migración es
-- exactamente "cada quien lee solo lo suyo".

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Las 6 tablas con `user_id` de dominio
-- ═══════════════════════════════════════════════════════════════════════════
-- Confirmado contra el esquema real (no contra la lista del encargo): son
-- estas 7 tablas y ninguna más las que tienen política `temporal_sin_auth_*`.
-- `ai_events` se trata aparte más abajo porque su `user_id` es nullable.

drop policy if exists "temporal_sin_auth_materias" on public.materias;
create policy "propietario_materias" on public.materias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "temporal_sin_auth_tareas" on public.tareas;
create policy "propietario_tareas" on public.tareas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "temporal_sin_auth_horario" on public.horario;
create policy "propietario_horario" on public.horario
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "temporal_sin_auth_memoria" on public.memoria;
create policy "propietario_memoria" on public.memoria
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "temporal_sin_auth_notificaciones_enviadas" on public.notificaciones_enviadas;
create policy "propietario_notificaciones_enviadas" on public.notificaciones_enviadas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- `perfil_academico` NO tiene columna `user_id` separada: su PK **es**
-- `user_id` (verificado). El predicado es el mismo, pero conviene dejar
-- constancia de que acá `user_id` es la clave primaria, no una FK más.
drop policy if exists "temporal_sin_auth_perfil_academico" on public.perfil_academico;
create policy "propietario_perfil_academico" on public.perfil_academico
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `ai_events` — caso deliberado, no el mismo molde
-- ═══════════════════════════════════════════════════════════════════════════
-- Verificado contra la base: `ai_events.user_id` es NULLABLE y sus 627 filas
-- actuales lo tienen en NULL. No es un descuido — `SupabaseEventSink.ts` lo
-- documenta: los eventos del bus llevan `agentId`/`requestId`, casi nunca un
-- `userId`.
--
-- Con este predicado, toda fila con `user_id is null` queda invisible para
-- TODOS los usuarios (`null = uuid` nunca es true en SQL). Eso es lo correcto
-- y se elige a propósito: son eventos de auditoría interna del sistema, no
-- datos de un usuario. Nada en la app los lee hoy (confirmado por grep: cero
-- `select` sobre esta tabla en todo el repo), y si algún día se construye una
-- pantalla de auditoría, se leerá con service_role — el mismo criterio que ya
-- usa el cron, no con la sesión del usuario.
--
-- Las escrituras del sink siguen funcionando porque van por service_role.

drop policy if exists "temporal_sin_auth_ai_events" on public.ai_events;
create policy "propietario_ai_events" on public.ai_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Storage — acá NO es un cambio de predicado, es un arreglo de seguridad
-- ═══════════════════════════════════════════════════════════════════════════
-- HALLAZGO de la Fase 0: las políticas actuales de los buckets `horarios` y
-- `tareas` **no comparan la carpeta del usuario en absoluto** — solo
-- `bucket_id = 'x'`. El plan asumía que ya tenían
-- `(storage.foldername(name))[1] = auth.uid()::text` y que solo había que
-- cambiar el predicado; no es así. Hoy cualquier sesión puede leer y borrar
-- archivos de cualquier otro usuario dentro de esos buckets. Con un solo
-- usuario da igual; en cuanto haya dos, es una fuga real.
--
-- `lib/storage.ts` ya sube a `<user_id>/<archivo>` desde el Sprint 8
-- precisamente para que este predicado sea posible (verificado:
-- `storage.foldername('uuid/archivo.jpg')` → `{uuid}`), así que no hay que
-- mover nada de lo que se suba de ahora en adelante.
--
-- ⚠️ Los 20 objetos ya existentes están bajo el prefijo `USUARIO_SIN_AUTH/` y
-- quedarán inaccesibles con estas políticas. Decisión del usuario: BORRARLOS
-- (son artefactos de prueba, entradas de un análisis de IA de una sola vez que
-- ninguna parte de la app vuelve a leer). Ver el procedimiento.
--
-- `to authenticated`: sin sesión no se toca nada. Las políticas viejas no
-- declaraban rol, así que `anon` también pasaba.

drop policy if exists "temporal_sin_auth_horarios_select" on storage.objects;
drop policy if exists "temporal_sin_auth_horarios_insert" on storage.objects;
drop policy if exists "temporal_sin_auth_horarios_delete" on storage.objects;

create policy "propietario_horarios_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'horarios' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "propietario_horarios_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'horarios' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "propietario_horarios_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'horarios' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "temporal_sin_auth_tareas_select" on storage.objects;
drop policy if exists "temporal_sin_auth_tareas_insert" on storage.objects;
drop policy if exists "temporal_sin_auth_tareas_delete" on storage.objects;

create policy "propietario_tareas_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'tareas' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "propietario_tareas_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tareas' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "propietario_tareas_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'tareas' and (storage.foldername(name))[1] = auth.uid()::text);
