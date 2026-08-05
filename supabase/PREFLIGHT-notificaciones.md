# Comprobaciones previas — antes de aplicar `20260731000000_notificaciones.sql`

Dos piezas, ambas aditivas: columnas nuevas con default sobre `perfil_academico`
(no toca filas existentes) y una tabla nueva. No puede fallar por datos
existentes — no hay ninguna restricción sobre histórico.

**Verificado contra la base en vivo antes de escribir la migración** (no
solo contra los archivos de migración locales): consulta de solo lectura vía
el cliente anónimo, confirmando que ni `notificaciones_enviadas` ni las tres
columnas de preferencias existían todavía. El propio diseño del sprint las
daba por hechas desde el Sprint 9 — no lo eran.

## Vía rápida

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'perfil_academico'
  and column_name in ('max_notif_por_dia', 'no_molestar_desde', 'no_molestar_hasta');

select count(*) from information_schema.tables
where table_schema = 'public' and table_name = 'notificaciones_enviadas';
```

- **Sin filas en ambas** → se aplica sin más (el estado esperado, confirmado
  el 2026-07-29).
- **Ya existen** → avisar antes de aplicar, revisar que el tipo/default
  coincida con lo que espera el código (`integer default 3`, `time`
  nullable, `time` nullable).

## Estado de partida (para comparar después)

```sql
select count(*) as tareas_pendientes from public.tareas where completada = false;
select count(*) as usuarios_con_perfil from public.perfil_academico;
```

## Después de aplicar

```sql
select user_id, max_notif_por_dia, no_molestar_desde, no_molestar_hasta
from public.perfil_academico;
```
Todo usuario existente debe mostrar `max_notif_por_dia = 3` y las dos
columnas de horario en `null` (sin restricción) — nadie configuró
preferencias todavía, es el estado neutro esperado.

```sql
select count(*) from public.notificaciones_enviadas; -- debe ser 0, tabla recién creada
```

## Después de la primera corrida real del cron

```sql
select tarea_id, tipo, urgencia, fecha, agrupada, created_at
from public.notificaciones_enviadas
order by created_at desc;
```
Cada fila debe tener una única combinación `(tarea_id, tipo, fecha)` —
el índice único lo garantiza, esto es solo para confirmarlo a ojo.
