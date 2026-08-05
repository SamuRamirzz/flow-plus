# Comprobaciones previas — antes de aplicar `20260730000000_icono_materia.sql`

Migración mínima y aditiva: agrega UNA columna nueva (`icono text not null
default 'GraduationCap'`) a `materias`. No toca filas existentes, no puede
fallar por datos sucios — no hay ninguna restricción sobre el histórico,
solo un `add column ... default`.

Todo lo de abajo es de solo lectura.

## Vía rápida

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'materias' and column_name = 'icono';
```

- **Sin filas** → se aplica sin más.
- **Ya existe** (`add column if not exists` la hace idempotente igual, no
  falla) → avísame si el tipo no es `text` o el default no es
  `'GraduationCap'`, porque el código esperaría exactamente eso.

## Estado de partida (para comparar después)

```sql
select count(*) as materias_actuales from public.materias;
```

Después de migrar debe ser el mismo número — esta migración no crea ni
borra filas.

## Después de aplicar

```sql
select count(*) as materias, count(*) filter (where icono = 'GraduationCap') as con_icono_por_defecto
from public.materias;
```

Todas las materias **existentes** arrancan en `'GraduationCap'` (el
respaldo neutro) hasta que:
- se corra el backfill retroactivo de una sola vez (ver el resumen de la
  sesión — reasigna por el mapeo determinístico, sin gastar IA, a las
  materias que ya existían antes de este sub-sprint), o
- se editen a mano.

Las materias **nuevas**, creadas después de aplicar esta migración, ya
reciben su ícono real automáticamente desde el primer momento — no
necesitan backfill.
