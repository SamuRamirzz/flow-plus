# Comprobaciones previas — `20260808000000_completar_perfil.sql`

Riesgo **muy bajo**: dos columnas nuevas, nullable, sin default, sobre una
tabla existente. No toca ninguna fila ni ninguna política.

Todo lo de esta sección es de solo lectura.

## Vía rápida

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'perfil_academico'
  and column_name in ('apellido', 'pais');
```

Esperado: 0 filas (ninguna de las dos existe todavía).

## Después de aplicar

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'perfil_academico'
  and column_name in ('apellido', 'pais');
```

Esperado: 2 filas, `text`, `is_nullable = YES`, `column_default = null`.

## Cómo revertir

```sql
alter table public.perfil_academico drop column if exists apellido;
alter table public.perfil_academico drop column if exists pais;
```

Sin pérdida de datos de dominio — son campos de perfil adicionales, nunca
la fila en sí.
