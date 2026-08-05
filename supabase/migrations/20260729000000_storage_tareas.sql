-- Sub-sprint 7.3 — bucket de Storage para adjuntos de tareas (foto o PDF de
-- un enunciado), subidos desde /ai.
--
-- Bucket NUEVO y separado de `horarios` (Sprint 8), no reusado: son buckets
-- con propósito distinto (una foto de horario identifica carrera/ubicación
-- semanal; un enunciado de tarea es un documento de una materia puntual) y
-- `horarios` restringe `allowed_mime_types` a solo imagen — ampliarlo a PDF
-- ahí mezclaría dos features en una misma política de acceso sin necesidad.
--
-- Privado (public = false), mismo criterio que `horarios`: el servidor lo
-- lee con la misma clave de proyecto (lib/server/supabaseServer.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tareas', 'tareas', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- Políticas: mismo criterio "permisivo pero con nombre inequívoco" que
-- `horarios`. El predicado es `true` porque no hay auth todavía; el path
-- ya se sube como `<user_id>/<archivo>` (lib/storage.ts, subirArchivo) para
-- que activar auth después sea cambiar solo el predicado, no re-subir nada.
drop policy if exists "temporal_sin_auth_tareas_select" on storage.objects;
create policy "temporal_sin_auth_tareas_select" on storage.objects
  for select using (bucket_id = 'tareas');

drop policy if exists "temporal_sin_auth_tareas_insert" on storage.objects;
create policy "temporal_sin_auth_tareas_insert" on storage.objects
  for insert with check (bucket_id = 'tareas');

drop policy if exists "temporal_sin_auth_tareas_delete" on storage.objects;
create policy "temporal_sin_auth_tareas_delete" on storage.objects
  for delete using (bucket_id = 'tareas');
