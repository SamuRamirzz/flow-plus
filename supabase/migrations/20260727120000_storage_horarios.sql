-- Sprint 8 — bucket de Storage para las fotos de horario.
--
-- Privado (public = false): una foto del horario identifica al estudiante,
-- su carrera y dónde está a cada hora de la semana. No hay ninguna razón
-- para que sea legible por URL pública. El servidor la lee con la misma
-- clave del proyecto que ya usa para el resto (lib/server/supabaseServer.ts).
--
-- Se conserva el original (no solo la versión reducida que ve el modelo)
-- porque el documento de arquitectura contempla mostrar el recorte de la
-- zona dudosa junto al campo que la IA no leyó con confianza — sin el
-- original no se puede hacer después.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('horarios', 'horarios', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- Políticas: mismo criterio "permisivo pero con nombre inequívoco" que las
-- tablas de dominio (Sprint 5). Hoy no hay auth, así que el predicado es
-- `true` y el nombre dice explícitamente que es temporal. Cuando llegue
-- auth, ESTAS son las líneas que cambian —  el predicado pasa a comparar el
-- primer segmento del path (`storage.foldername(name))[1]`) contra
-- `auth.uid()`, que es la razón por la que el cliente ya sube a
-- `<user_id>/<archivo>` desde ahora, aunque todavía no signifique nada.
drop policy if exists "temporal_sin_auth_horarios_select" on storage.objects;
create policy "temporal_sin_auth_horarios_select" on storage.objects
  for select using (bucket_id = 'horarios');

drop policy if exists "temporal_sin_auth_horarios_insert" on storage.objects;
create policy "temporal_sin_auth_horarios_insert" on storage.objects
  for insert with check (bucket_id = 'horarios');

drop policy if exists "temporal_sin_auth_horarios_delete" on storage.objects;
create policy "temporal_sin_auth_horarios_delete" on storage.objects
  for delete using (bucket_id = 'horarios');
