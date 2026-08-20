# Comprobaciones previas — `20260819000000_notificaciones.sql`

Riesgo **bajo**: tabla nueva (`public.notificaciones`), no toca ninguna tabla
ni fila existente. Distinta de `notificaciones_enviadas` (Sprint 11, sigue
intacta) — ver el comentario de cabecera de la migración para la diferencia.

Todo lo de esta sección es de solo lectura.

## Vía rápida

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'notificaciones';
```

Esperado: 0 filas (la tabla no existe todavía).

```sql
select pubname from pg_publication_tables
where schemaname = 'public' and tablename = 'notificaciones';
```

Esperado: 0 filas (nada que registrar todavía — se agrega en esta misma migración).

## Después de aplicar

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'notificaciones'
order by ordinal_position;
```

Esperado: 9 columnas (`id`, `user_id`, `tipo`, `titulo`, `cuerpo`,
`entidad_tipo`, `entidad_id`, `leida`, `creada_en`, `canal` — 10 en
realidad, contar bien al verificar).

```sql
select relrowsecurity, relreplident from pg_class
where relname = 'notificaciones' and relnamespace = 'public'::regnamespace;
```

Esperado: `relrowsecurity = true`, `relreplident = 'f'` (FULL).

```sql
select polname, polcmd from pg_policies
where schemaname = 'public' and tablename = 'notificaciones';
```

Esperado: 1 fila, `propietario_notificaciones`, `polcmd = '*'` (ALL).

```sql
select pubname from pg_publication_tables
where schemaname = 'public' and tablename = 'notificaciones';
```

Esperado: 1 fila, `supabase_realtime`.

```sql
select has_table_privilege('authenticated', 'notificaciones', 'insert'),
       has_table_privilege('authenticated', 'notificaciones', 'select');
```

Esperado: `insert = false` (heredado de `alter default privileges` de
`20260801000000`), `select = true` (RLS filtra por fila, no por columna —
el cliente puede leer, solo lo suyo).

## Cómo revertir

```sql
alter publication supabase_realtime drop table public.notificaciones;
drop table if exists public.notificaciones;
```

Sin pérdida de datos de dominio — la tabla es puramente aditiva, ninguna
otra tabla ni endpoint existente depende de ella.
