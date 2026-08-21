-- Foto de perfil — bucket de Storage + columna de override.
--
-- ─────────────────────────────────────────────────────────────────────────
-- Por qué un bucket PÚBLICO, a diferencia de horarios/tareas/archivos-staging
-- ─────────────────────────────────────────────────────────────────────────
-- Los demás buckets son privados porque guardan documentos (un enunciado de
-- tarea, una foto de horario) que pueden llevar información real de la
-- materia/institución del usuario. Un avatar es justo lo contrario: está
-- pensado para mostrarse en cualquier parte de la UI sin fricción — con un
-- bucket privado, cada `<img>` necesitaría una URL firmada con vencimiento,
-- que hay que renovar; con uno público, es una URL estable que se sirve
-- directo, igual que ya hacen Slack/GitHub con sus avatares.
--
-- La ruta sigue siendo `<user_id>/<archivo>` y solo su DUEÑO puede escribir
-- o borrar ahí (RLS real, no "temporal_sin_auth" — esa forma quedó retirada
-- en 20260804000000, Auth ya está cerrado). Público es "cualquiera con la
-- URL exacta puede VER la foto", nunca "cualquiera puede subir o borrar".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

drop policy if exists "propietario_avatares_insert" on storage.objects;
create policy "propietario_avatares_insert" on storage.objects
  for insert
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "propietario_avatares_delete" on storage.objects;
create policy "propietario_avatares_delete" on storage.objects
  for delete
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- SELECT no necesita política de dueño: el bucket es público, cualquiera
-- (incluido un visitante sin sesión) puede leer un objeto si conoce su URL
-- — eso es lo que "público" significa en Supabase Storage. No hace falta
-- una policy adicional para permitirlo.

-- ─────────────────────────────────────────────────────────────────────────
-- perfil_academico.avatar_url — override manual, nullable
-- ─────────────────────────────────────────────────────────────────────────
-- NO se usa para el avatar de Google: ese se lee en vivo de los claims del
-- JWT (`user_metadata.avatar_url`), igual que ya hace el nombre
-- (nombreActual en CategoriaPerfil.tsx) — sin guardar copia, así que nunca
-- puede quedar desactualizado si el usuario cambia su foto de Google.
-- Esta columna es solo para cuando el usuario SUBE una foto propia, que
-- tiene que ganarle a la de Google mientras esté puesta.
alter table public.perfil_academico add column if not exists avatar_url text;
