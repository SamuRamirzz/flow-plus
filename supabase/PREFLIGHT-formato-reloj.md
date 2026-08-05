# Comprobaciones previas — `20260807000000_formato_reloj.sql`

Riesgo **muy bajo**: una columna nueva `not null` con default fijo,
aditiva pura. No toca ninguna fila existente ni ninguna política.

Todo lo de esta sección es de solo lectura.

## Vía rápida

```sql
-- 1. La columna no existe todavía.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'perfil_academico'
  and column_name = 'formato_reloj';

-- 2. Estado real de la tabla (para comparar después — no debe cambiar el conteo).
select count(*) as total from public.perfil_academico;
```

## Después de aplicar

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'perfil_academico'
  and column_name = 'formato_reloj';

select conname from pg_constraint where conname = 'perfil_academico_formato_reloj_chk';
```

Esperado: `text`, `is_nullable = NO`, `column_default = '24h'::text`, y el
constraint presente. Todas las filas existentes deben quedar en `'24h'`
(el default se aplica automáticamente a las filas ya existentes en un
`ALTER TABLE ADD COLUMN ... DEFAULT` sobre Postgres).

## Cómo revertir

```sql
alter table public.perfil_academico drop constraint if exists perfil_academico_formato_reloj_chk;
alter table public.perfil_academico drop column if exists formato_reloj;
```

Sin pérdida de datos de dominio — la columna solo guarda una preferencia
de presentación, nunca la fila en sí.
