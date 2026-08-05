# Comprobaciones previas — antes de aplicar `20260802000000_campos_examen.sql`

Aditiva y de riesgo mínimo: 3 columnas nullable sin default sobre `tareas`.
No toca ninguna fila existente y no puede fallar por datos sucios (los dos
CHECK admiten `null`, y todas las filas actuales tendrán `null` en los tres
campos).

Todo lo de abajo es de solo lectura.

## Vía rápida

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'tareas'
  and column_name in ('temario', 'formato', 'peso');
```

- **Sin filas** → se aplica sin más (el estado esperado).
- **Ya existen** → `add column if not exists` la hace idempotente igual; avisar
  si el tipo no es `text`/`text`/`numeric`, porque el código espera eso.

## Estado de partida (para comparar después)

```sql
select count(*) as tareas_totales,
       count(*) filter (where tipo = 'examen') as examenes
from public.tareas;
```

Al aplicar, ambos números deben quedar idénticos — esta migración no crea ni
borra filas.

## Después de aplicar

```sql
select titulo, tipo, temario, formato, peso
from public.tareas where tipo = 'examen';
```

Los exámenes que ya existían aparecen con los tres campos en `null` — correcto:
nadie los había capturado todavía. Se llenan cuando el usuario cree o edite un
examen desde `/ai` o `AddTaskBar` de aquí en adelante; no hay backfill posible
(la información no existe en ninguna parte para recuperarla).

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint where conname in ('tareas_formato_chk', 'tareas_peso_chk');
```

Debe devolver las dos restricciones, ambas admitiendo `null`.
