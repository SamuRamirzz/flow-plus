# Comprobaciones previas — antes de aplicar `20260728000000_memoria_y_ai_events.sql`

A diferencia de la migración del Sprint 5, esta **solo crea tablas nuevas**:
no toca `materias`, `tareas` ni `horario`, no añade restricciones sobre datos
existentes y no puede fallar por suciedad del histórico. El riesgo real es
otro: **que alguno de los tres nombres ya esté ocupado** por algo distinto.

Todo lo de abajo es de solo lectura.

## 0. Vía rápida — ¿está libre el camino?

```sql
select 'tablas que ya existen' as comprobacion,
       coalesce(string_agg(table_name, ', '), 'ninguna — ok, se crean las 3') as resultado
from information_schema.tables
where table_schema = 'public'
  and table_name in ('memoria', 'ai_events', 'perfil_academico')
union all
select 'gen_random_uuid disponible',
       case when exists (select 1 from pg_proc where proname = 'gen_random_uuid')
            then 'sí — ok' else 'NO: falta la extensión pgcrypto' end
union all
select 'usuarios distintos en tareas',
       coalesce((select count(distinct user_id)::text from public.tareas), '0');
```

- **`ninguna — ok`** en la primera fila → se aplica sin más.
- Si alguna tabla ya existe, la migración usa `create table if not exists`, así
  que **no la sobrescribe ni falla** — pero tampoco le añadirá las columnas que
  falten. En ese caso, mira el punto 1 antes de continuar.
- `gen_random_uuid` viene de `pgcrypto`, ya presente en Supabase por defecto
  (las tablas de sprints anteriores lo usan). Si dijera que falta, algo
  cambió en el proyecto y conviene parar.
- La tercera fila debería decir `1`: todo el proyecto sigue con un único
  usuario (`USUARIO_SIN_AUTH`) hasta que llegue auth.

## 1. Solo si alguna de las tres tablas ya existía

Compara la forma real contra la que espera el código:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('memoria', 'ai_events', 'perfil_academico')
order by table_name, ordinal_position;
```

Columnas que el código espera:

- **`memoria`**: `id`, `user_id`, `scope`, `content` (jsonb), `created_at`, `expires_at`
- **`ai_events`**: `id`, `user_id`, `tipo`, `payload` (jsonb), `source`, `emitted_at`, `created_at`
- **`perfil_academico`**: `user_id` (PK), `zona_horaria`, `nombre`, `institucion`, `created_at`, `updated_at`

Si falta alguna columna en una tabla preexistente, dímelo antes de aplicar:
hay que decidir entre `alter table ... add column` o renombrar la vieja, y eso
depende de si tiene datos que valga la pena conservar.

## 2. Informativo — políticas ya existentes con esos nombres

La migración hace `drop policy if exists` antes de cada `create policy`, así
que es idempotente. Esto es solo para saber qué había:

```sql
select policyname, tablename from pg_policies
where schemaname = 'public'
  and tablename in ('memoria', 'ai_events', 'perfil_academico');
```

---

## Después de aplicar — verificación

```sql
-- (a) Las tres tablas existen y tienen RLS encendida
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('memoria', 'ai_events', 'perfil_academico');

-- (b) El check de `scope` acepta exactamente los 6 valores de MemoryScope.
--     Las 6 primeras filas deben devolver true; la última, false.
select 'immediate'  as scope, 'immediate'  = any(array['immediate','daily','weekly','permanent','academic','contextual']) as aceptado
union all select 'daily',      'daily'      = any(array['immediate','daily','weekly','permanent','academic','contextual'])
union all select 'weekly',     'weekly'     = any(array['immediate','daily','weekly','permanent','academic','contextual'])
union all select 'permanent',  'permanent'  = any(array['immediate','daily','weekly','permanent','academic','contextual'])
union all select 'academic',   'academic'   = any(array['immediate','daily','weekly','permanent','academic','contextual'])
union all select 'contextual', 'contextual' = any(array['immediate','daily','weekly','permanent','academic','contextual'])
union all select 'inventado',  'inventado'  = any(array['immediate','daily','weekly','permanent','academic','contextual']);

-- (c) Prueba real del check: el primero entra, el segundo DEBE fallar.
insert into public.memoria (user_id, scope, content)
values ('00000000-0000-0000-0000-000000000001', 'permanent', '{"prueba": true}'::jsonb);

-- Este debe dar error 23514 (violación de check). Si NO falla, el check no quedó puesto:
-- insert into public.memoria (user_id, scope, content)
-- values ('00000000-0000-0000-0000-000000000001', 'inventado', '{}'::jsonb);

-- Limpia la fila de prueba:
delete from public.memoria where content = '{"prueba": true}'::jsonb;
```

## 3. Tu zona horaria (opcional pero recomendable)

La tabla usa `America/Bogota` por defecto. Si no es la tuya, crea tu perfil
con la correcta — el servidor la usará para calcular "hoy" y el cron del
Sprint 11 para no equivocarse de día cerca de medianoche:

```sql
insert into public.perfil_academico (user_id, zona_horaria)
values ('00000000-0000-0000-0000-000000000001', 'America/Bogota')
on conflict (user_id) do update set zona_horaria = excluded.zona_horaria;
```

Si no creas ninguna fila no pasa nada: el loader de contexto cae al valor por
defecto y lo reporta como tal.
