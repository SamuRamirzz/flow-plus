# Comprobaciones previas — `20260806000000_completada_en.sql`

Riesgo **muy bajo**: una columna nueva nullable, sin default forzado,
aditiva pura. No toca ninguna fila existente ni ninguna política.

Todo lo de esta sección es de solo lectura.

## Vía rápida

```sql
-- 1. La columna no existe todavía.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'tareas'
  and column_name = 'completada_en';

-- 2. Estado real de la tabla (para comparar después — no debe cambiar).
select count(*) as total, count(*) filter (where completada) as completadas
from public.tareas;
```

Estado esperado al escribir esto (2026-08-06): `tareas` en **0 filas**
(la tabla quedó vacía tras la limpieza del Sprint Auth) — no hay ninguna
fila que pudiera necesitar retro-llenado.

## Después de aplicar

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'tareas'
  and column_name = 'completada_en';
```

Esperado: `timestamptz`, `is_nullable = YES`, `column_default = null`.

## Cómo revertir

```sql
alter table public.tareas drop column if exists completada_en;
```

Sin pérdida de datos de dominio — la columna solo guarda un dato adicional
sobre completado, nunca la fila en sí.
