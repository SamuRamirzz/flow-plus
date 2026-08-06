# Comprobaciones previas — antes de aplicar `20260809000200_storage_archivos_staging.sql`

Riesgo **bajo**: crea un bucket de Storage nuevo (`archivos-staging`) y 3
políticas RLS sobre `storage.objects`. No modifica ningún bucket existente,
ninguna tabla, ninguna fila.

---

## Vía rápida — ¿ya está aplicada?

```sql
select id from storage.buckets where id = 'archivos-staging';

select policyname from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname like '%archivos_staging%';
```

- **0 filas en ambas** → no aplicada, seguir.
- **Bucket presente + 3 políticas** → ya aplicada; avisar antes de reaplicar.

---

## Estado de partida

```sql
-- Confirma el patrón de nombre de política que se está replicando.
select policyname, cmd from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname like 'propietario_%';
-- esperado: propietario_horarios_{select,insert,delete}, propietario_tareas_{select,insert,delete}
```

---

## Después de aplicar

```sql
-- 1) El bucket, con los límites correctos
select id, public, file_size_limit, array_length(allowed_mime_types, 1) as n_mime_types
 from storage.buckets where id = 'archivos-staging';
-- esperado: public=false, file_size_limit=52428800, n_mime_types=14

-- 2) Las 3 políticas, por dueño (no "temporal_sin_auth")
select policyname, cmd, roles from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname like '%archivos_staging%';
-- esperado: 3 filas, propietario_archivos_staging_{select,insert,delete}, roles={authenticated}
```

## Prueba funcional (opcional, con una cuenta de prueba desechable)

```sql
-- Sin sesión (anon) o con el user_id de otra cuenta en el prefijo del path:
-- una subida a 'archivos-staging' con path que NO empieza por el propio
-- auth.uid() debe fallar por RLS. Verificable más fácil desde el propio
-- endpoint POST /api/archivos (rechaza con 400 antes de tocar Storage si
-- `ruta` no empieza por `${userId}/`) que con SQL crudo.
```

---

## Cómo revertir

```sql
drop policy if exists "propietario_archivos_staging_select" on storage.objects;
drop policy if exists "propietario_archivos_staging_insert" on storage.objects;
drop policy if exists "propietario_archivos_staging_delete" on storage.objects;
delete from storage.buckets where id = 'archivos-staging';
```

Sin efecto sobre `horarios`/`tareas`/ninguna tabla de dominio. Pérdida:
cualquier objeto que haya quedado en staging sin limpiarse (el diseño del
endpoint ya lo borra tras reenviarlo a Drive, así que en operación normal el
bucket debería estar casi siempre vacío).
