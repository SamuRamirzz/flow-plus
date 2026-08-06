-- Sprint Archivos / Tramo 2a — bucket de staging para subir archivos antes de
-- reenviarlos a Google Drive.
--
-- Mismo patrón "Storage-first" que ya usan `horarios`/`tareas`: el cliente
-- sube primero acá, y el endpoint (POST /api/archivos) solo recibe la ruta,
-- descarga el objeto con supabaseServer, lo reenvía a Drive, y borra el
-- objeto de staging — este bucket nunca es el destino final del archivo.
--
-- A diferencia de `horarios`/`tareas` (creados antes de Auth con el patrón
-- "temporal_sin_auth_*" y corregidos después en 20260804000000), este bucket
-- nace con RLS por dueño desde el día uno — Auth ya existe, no hay motivo
-- para repetir la ventana insegura.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'archivos-staging',
  'archivos-staging',
  false,
  52428800, -- 50MB
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- Mismo predicado por carpeta que `propietario_horarios_*`/`propietario_tareas_*`
-- (20260804000000): el path se sube como `<user_id>/<archivo>`, verificado
-- también en POST /api/archivos antes de tocar el objeto.
create policy "propietario_archivos_staging_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'archivos-staging' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "propietario_archivos_staging_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'archivos-staging' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "propietario_archivos_staging_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'archivos-staging' and (storage.foldername(name))[1] = auth.uid()::text);
