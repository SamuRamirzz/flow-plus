# Comprobaciones previas — `20260805000000_onboarding_completado.sql`

Riesgo **muy bajo**: una columna nueva con `default`, aditiva pura, sin
tocar ninguna fila existente ni ninguna política. Aun así, el patrón del
proyecto es confirmar el estado de partida antes de correr nada.

Todo lo de esta sección es de solo lectura.

## Vía rápida — lo que la migración da por cierto

```sql
-- 1. La tabla se llama perfil_academico y NO existe una tabla `perfiles`
--    (el encargo del sprint asumía que sí; ver la cabecera de la migración).
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

-- 2. La columna no existe todavía (la migración es idempotente vía
--    `add column if not exists`, pero conviene saber si ya se aplicó).
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'perfil_academico'
  and column_name = 'onboarding_completado';

-- 3. Cuántos perfiles quedarán en `false` (= verán el onboarding).
select count(*) as perfiles from public.perfil_academico;
```

Estado esperado:

| Consulta | Esperado |
|---|---|
| 1 | 7 tablas, **sin** `perfiles` |
| 2 | sin filas |
| 3 | `3` al momento de escribir esto |

## Estado de partida (2026-07-30)

`auth.users` y `perfil_academico` tienen **3 filas cada una**, en
correspondencia 1:1 — el trigger `on_auth_user_created` del Sprint Auth
está funcionando:

| user_id | email | qué es |
|---|---|---|
| `28d00f49…` | samugame79@gmail.com | **el usuario real** (identidades `email` + `google` vinculadas automáticamente por email compartido) |
| `5db56dc6…` | diagnostico-magic-link@example.com | usuario de prueba creado por un script de diagnóstico del magic link |
| `d0128ff4…` | diagnostico-magic-link-2@example.com | ídem |

⚠️ **Los dos usuarios `diagnostico-*` son basura de diagnóstico y conviene
borrarlos** (`admin.generateLink` crea el usuario aunque el correo nunca se
envíe — no era obvio de antemano). No los borra esta migración: es una
acción destructiva sobre `auth.users` y va aparte, con confirmación
explícita. `delete from auth.users where email like 'diagnostico-%'`
arrastra sus perfiles solo, por la FK `on delete cascade` de la Fase 1.

## Después de aplicar

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'perfil_academico'
  and column_name = 'onboarding_completado';

select user_id, onboarding_completado from public.perfil_academico;
```

Esperado: `boolean`, `NO` (not null), default `false`; y los 3 perfiles en
`false`.

## Cómo revertir

```sql
alter table public.perfil_academico drop column if exists onboarding_completado;
```

Sin pérdida de datos de dominio — la columna solo guarda un estado de UI que
se vuelve a derivar mostrando el onboarding otra vez.
