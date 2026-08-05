# Comprobaciones previas — antes de aplicar `20260803000000_auth_perfil_y_trigger.sql`

Riesgo bajo, pero **no** es aditiva pura como las últimas: añade una FK a
`auth.users` y un trigger sobre `auth.users`. Nada de esto puede romper la app
tal como está hoy (ver la justificación abajo), pero sí conviene confirmar el
estado de partida porque la FK depende de él.

Todo lo de esta sección es de solo lectura.

## Vía rápida — las 3 cosas que la migración da por ciertas

```sql
-- 1. auth.users está vacía (si NO lo está, para y avisa: la FK not valid
--    seguiría aplicándose bien, pero el trigger podría chocar con perfiles
--    que ya existan y hay que revisar el caso antes).
select count(*) as usuarios_registrados from auth.users;

-- 2. perfil_academico tiene exactamente 1 fila, la del usuario sin auth.
select user_id, nombre, zona_horaria from public.perfil_academico;

-- 3. No existe ya la FK ni el trigger (la migración es re-ejecutable en el
--    trigger vía `drop ... if exists`, pero la FK NO lo es).
select conname from pg_constraint
where conrelid = 'public.perfil_academico'::regclass
  and conname = 'perfil_academico_user_id_fkey';

select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created';
```

Estado esperado:

| Consulta | Esperado |
|---|---|
| 1 | `0` |
| 2 | 1 fila, `user_id = 00000000-0000-0000-0000-000000000001` |
| 3 | ambas **sin filas** |

Si la consulta 3 devuelve la FK, la migración fallará con "constraint already
exists" — es la única parte no idempotente. En ese caso, revisar si ya se
aplicó antes en vez de forzarla.

## Por qué es seguro aplicarla ahora, antes de que exista el login

- **Ningún código escribe `perfil_academico`.** Verificado por grep sobre todo
  el repo: los únicos 3 puntos que la tocan
  (`app/api/cron/recordatorios/route.ts`, `app/api/notificaciones/route.ts`,
  `lib/ai/context/loaders.ts`) hacen `select ... maybeSingle()`. Una FK nueva
  no puede romper una escritura que no existe.
- **El trigger no puede dispararse todavía.** Solo corre con un `insert` en
  `auth.users`, y no hay ningún flujo de registro construido aún.
- **La FK va `not valid`**, así que la fila huérfana actual (la del usuario sin
  auth) no bloquea nada. Se valida en la Fase 2, después de reasignar los datos.

## Estado de partida (para comparar después)

```sql
select
  (select count(*) from public.materias)                as materias,
  (select count(*) from public.tareas)                  as tareas,
  (select count(*) from public.horario)                 as horario,
  (select count(*) from public.memoria)                 as memoria,
  (select count(*) from public.ai_events)               as ai_events,
  (select count(*) from public.perfil_academico)        as perfil_academico,
  (select count(*) from public.notificaciones_enviadas) as notificaciones;
```

Valores al momento de escribir esto (2026-07-30):

| tabla | filas |
|---|---|
| materias | 33 |
| tareas | 8 |
| horario | 0 |
| memoria | 0 |
| ai_events | 627 |
| perfil_academico | 1 |
| notificaciones_enviadas | 5 |

Esta migración **no crea ni borra ninguna fila** — los 7 números deben quedar
idénticos después de aplicarla.

## Después de aplicar

```sql
-- La FK existe y está marcada como NO validada (convalidated = false).
select conname, convalidated, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.perfil_academico'::regclass
  and conname = 'perfil_academico_user_id_fkey';
```

Esperado: 1 fila, `convalidated = false`, definición
`FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`.

```sql
-- El trigger y su función existen.
select tgname, tgenabled from pg_trigger
where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created';

select proname, prosecdef from pg_proc
where proname = 'crear_perfil_al_registrarse';
```

Esperado: trigger con `tgenabled = 'O'` (activo), y la función con
`prosecdef = true` (es `security definer`).

## Cómo revertir

```sql
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.crear_perfil_al_registrarse();
alter table public.perfil_academico drop constraint if exists perfil_academico_user_id_fkey;
```

Revierte por completo, sin pérdida de datos — esta migración no toca ninguna
fila, solo añade estructura.
