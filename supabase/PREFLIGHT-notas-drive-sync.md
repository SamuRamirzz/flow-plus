# Comprobaciones previas — antes de aplicar `20260809000300_notas_drive_sync.sql`

Riesgo **bajo**: agrega una columna nullable y un índice único parcial a
`notas`. No modifica ninguna otra tabla, no toca datos existentes.

---

## Vía rápida — ¿ya está aplicada?

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='notas' and column_name='drive_sync_error';

select indexname from pg_indexes
 where schemaname='public' and tablename='notas' and indexname='notas_user_drive_uniq';
```

- **0 filas en ambas** → no aplicada, seguir.
- **Ambas presentes** → ya aplicada; avisar antes de reaplicar.

---

## Estado de partida

```sql
-- Confirma que no hay ya filas con drive_file_id duplicado por usuario
-- (si las hubiera, el índice único fallaría al crearse).
select user_id, drive_file_id, count(*) from public.notas
 where drive_file_id is not null
 group by user_id, drive_file_id having count(*) > 1;
-- esperado: 0 filas (la tabla `notas` está vacía hoy — Fase 4.1 nunca escribió nada todavía)
```

---

## Después de aplicar

```sql
select column_name, is_nullable from information_schema.columns
 where table_schema='public' and table_name='notas' and column_name='drive_sync_error';
-- esperado: 1 fila, is_nullable = 'YES'

select indexname, indexdef from pg_indexes
 where schemaname='public' and tablename='notas' and indexname='notas_user_drive_uniq';
-- esperado: 1 fila, definición incluye "WHERE (drive_file_id IS NOT NULL)"
```

---

## Cómo revertir

```sql
drop index if exists public.notas_user_drive_uniq;
alter table public.notas drop column if exists drive_sync_error;
```

Sin efecto sobre ninguna otra tabla. Pérdida: nada — la tabla `notas` está
vacía en el momento de aplicar esta migración.
