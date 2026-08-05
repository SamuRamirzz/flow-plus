# Comprobaciones previas — antes de aplicar `20260809000100_archivos_notas_conversaciones.sql`

Riesgo **bajo-medio**: tres tablas nuevas, ninguna existente se modifica. A
diferencia de la migración de Fase 0, ésta sí tiene **FK contra tablas con datos
vivos** (`tareas`, `materias`, `horario`, `auth.users`). Las FK se validan al
crearse, pero como las tres tablas nacen vacías no hay ninguna fila que pueda
fallar la validación.

**Estado: verificado contra la base en vivo el 2026-08-05, antes de escribir la
migración.**

---

## Vía rápida — ¿ya está aplicada?

```sql
select table_name from information_schema.tables
 where table_schema='public'
   and table_name in ('archivos','notas','conversaciones_ia');
```

- **0 filas** → no aplicada, seguir.
- **1-3 filas** → aplicada (total o parcialmente); avisar antes de reaplicar.

*Verificado 2026-08-05: 0 filas.*

---

## Estado de partida (bloqueante — hay que consultarlo, no asumirlo)

```sql
-- Las 3 tablas referenciadas tienen que existir, o las FK fallan.
select to_regclass('public.tareas')   as tareas,
       to_regclass('public.materias') as materias,
       to_regclass('public.horario')  as horario;

-- Decide si la FK compuesta de `archivos` era una alternativa viable.
select column_name, is_nullable from information_schema.columns
 where table_schema='public' and table_name='tareas' and column_name='materia_id';

select count(*)::int from auth.users;
```

*Verificado 2026-08-05:*
- *Las tres tablas existen.*
- ***`tareas.materia_id` es NULLABLE*** *— esto es lo que descarta la FK
  compuesta `(tarea_id, materia_id) → tareas(id, materia_id)`: con semántica
  MATCH SIMPLE, una FK compuesta ni se evalúa si una columna es null, así que la
  garantía de "el archivo siempre tiene la materia de su tarea" sería parcial.
  Confirma la decisión de columnas independientes documentada en la migración.*
- *4 usuarios.*

---

## Después de aplicar

```sql
-- 1) Las 3 tablas, con RLS activa
select tablename, rowsecurity from pg_tables
 where schemaname='public' and tablename in ('archivos','notas','conversaciones_ia');
-- esperado: 3 filas, rowsecurity = true en las 3

-- 2) Una política propietario_* por tabla
select tablename, policyname, cmd from pg_policies
 where schemaname='public' and tablename in ('archivos','notas','conversaciones_ia');
-- esperado: propietario_archivos | propietario_notas | propietario_conversaciones_ia, todas ALL

-- 3) Los constraints que codifican las decisiones de diseño
select conname from pg_constraint
 where conname in ('notas_ancla_chk','conversaciones_ia_mensajes_chk');
-- esperado: los 2

-- 4) Los grants heredados de 20260801000000 siguen siendo los correctos.
--    VERIFICARLO, no darlo por hecho: si alguien tocó el default del esquema,
--    estas tablas nacerían con escritura abierta al navegador.
select has_table_privilege('authenticated','public.archivos','insert') as insert_no_deberia,
       has_table_privilege('authenticated','public.archivos','select') as select_si_deberia;
-- esperado: false | true
```

---

## Prueba funcional del constraint que más criterio encierra

`notas_ancla_chk` es la única regla de negocio que vive en la base, así que
conviene comprobarla de verdad y no solo que exista:

```sql
-- Debe FALLAR (una nota no puede estar anclada a una tarea Y a un bloque):
insert into public.notas (user_id, tarea_id, bloque_horario_id, contenido)
values ('<un-user-id-real>', '<una-tarea-real>', '<un-bloque-real>', 'prueba');
-- esperado: ERROR ... viola la restricción «notas_ancla_chk»

-- Debe FUNCIONAR (nota suelta, sin ancla — es un estado válido con nombre):
insert into public.notas (user_id, contenido) values ('<un-user-id-real>', 'nota suelta');
-- luego: delete from public.notas where contenido = 'nota suelta';
```

---

## Cómo revertir

```sql
drop table if exists public.archivos;
drop table if exists public.notas;
drop table if exists public.conversaciones_ia;
```

Sin efecto sobre `tareas`/`materias`/`horario`/`auth.users`: las FK salen de las
tablas que se borran, no entran en ellas. Pérdida: archivos, notas y
conversaciones — inexistentes en el momento de aplicar esta migración, y hasta
que los tramos posteriores construyan los endpoints que las escriben.
