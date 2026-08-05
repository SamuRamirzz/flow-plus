# Comprobaciones previas — antes de aplicar `20260726120000_user_id_y_rls.sql`

La migración es idempotente, pero **dos de sus pasos fallan a propósito si los
datos actuales los contradicen**. Eso es deseable (mejor enterarse que meter una
restricción que no cubre el histórico), pero conviene saberlo *antes* de
aplicarla y no a mitad.

Ejecuta esto en el editor SQL de Supabase. Todo es de solo lectura.

## 0. Vía rápida — las tres comprobaciones en una sola consulta

```sql
select 'materias duplicadas' as comprobacion,
       coalesce(string_agg(nombre_norm || ' (x' || veces || ')', ', '), 'ninguna — ok') as resultado
from (
  select lower(nombre) as nombre_norm, count(*) as veces
  from public.materias group by lower(nombre) having count(*) > 1
) d
union all
select 'prioridades invalidas',
       coalesce(string_agg(coalesce(prioridad, '(null)') || ' (x' || veces || ')', ', '), 'ninguna — ok')
from (
  select prioridad, count(*) as veces from public.tareas
  where prioridad is null or prioridad not in ('baja','media','alta')
  group by prioridad
) p
union all
select 'conteo de partida',
       (select count(*) from public.materias) || ' materias, ' ||
       (select count(*) from public.tareas)   || ' tareas';
```

Si las dos primeras filas dicen `ninguna — ok`, la migración se aplica sin
problemas. Anota el conteo de partida: después de migrar debe ser idéntico.

Si alguna encuentra suciedad, abajo está el detalle y cómo limpiarla.

---

## 1. ¿Hay materias con nombre duplicado?

La migración crea `materias_user_nombre_uniq (user_id, lower(nombre))`.
Si esto devuelve filas, **la migración fallará**.

```sql
select lower(nombre) as nombre_normalizado, count(*) as veces
from public.materias
group by lower(nombre)
having count(*) > 1;
```

**Si devuelve filas:** decide con cuál te quedas y reasigna las tareas de la
duplicada antes de migrar:

```sql
-- Ver qué tareas cuelgan de cada duplicada
select m.id, m.nombre, count(t.id) as tareas
from public.materias m
left join public.tareas t on t.materia_id = m.id
where lower(m.nombre) = 'nombre_en_conflicto'
group by m.id, m.nombre;

-- Mover las tareas a la que se queda, y borrar la otra
-- update public.tareas set materia_id = '<id_que_se_queda>' where materia_id = '<id_a_borrar>';
-- delete from public.materias where id = '<id_a_borrar>';
```

## 2. ¿Hay prioridades fuera de baja|media|alta?

La migración añade `tareas_prioridad_chk` y luego la valida contra el
histórico. Si esto devuelve filas, **el `VALIDATE CONSTRAINT` fallará**.

```sql
select prioridad, count(*) as veces
from public.tareas
where prioridad is null or prioridad not in ('baja','media','alta')
group by prioridad;
```

**Si devuelve filas:** normaliza antes de migrar. Por ejemplo:

```sql
-- update public.tareas set prioridad = 'media'
-- where prioridad is null or prioridad not in ('baja','media','alta');
```

## 3. Estado de partida (para comparar después)

```sql
select
  (select count(*) from public.materias) as materias,
  (select count(*) from public.tareas)   as tareas;
```

Anota estos números. Después de migrar deben ser **exactamente los mismos**:
esta migración no crea ni borra filas, solo añade columnas y restricciones.

## 4. ¿Ya existe alguna de las columnas o índices?

Solo informativo — la migración usa `if not exists` en todo.

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'tareas'
  and column_name in ('user_id','tipo','origen','confianza','fecha_inferida','motivo_fecha');

select policyname, tablename from pg_policies
where schemaname = 'public' and tablename in ('materias','tareas');
```

---

## Después de aplicar — verificación del Sprint 5

```sql
-- (a) Un solo grupo, sin nulls
select user_id, count(*) from public.tareas   group by user_id;
select user_id, count(*) from public.materias group by user_id;

-- (b) RLS realmente activa en ambas tablas
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('materias','tareas');
```

Y la comprobación que de verdad demuestra que RLS está encendida — porque
`rowsecurity = true` con una política permisiva es indistinguible de estar
apagada desde la app:

```sql
-- Romper a propósito durante 30 segundos
alter policy "temporal_sin_auth_tareas" on public.tareas using (false);
```

Recarga la app: **la lista de tareas debe quedar vacía**. Si sigue mostrando
tareas, RLS no está aplicándose y hay que investigarlo. Luego revierte:

```sql
alter policy "temporal_sin_auth_tareas" on public.tareas using (true);
```
