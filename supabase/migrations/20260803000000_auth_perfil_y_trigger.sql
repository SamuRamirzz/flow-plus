-- Sprint Auth / Fase 1 — `perfil_academico` pasa a ser la tabla de perfil
-- real, atada a `auth.users`, con creación automática al registrarse.
--
-- ⚠️ DECISIÓN REGISTRADA: NO se crea la tabla `perfiles` que pide el encargo.
-- Consultado el usuario con la evidencia del esquema real, eligió extender
-- `perfil_academico`. El motivo: esa tabla YA es la tabla de perfil, solo que
-- nadie la había llamado así —
--   · su PK ya es `user_id` (uuid), no un `id` propio;
--   · ya tiene `nombre` e `institucion`, que es exactamente lo que el encargo
--     proponía poner en `perfiles` ("nombre para mostrar, fecha de creación");
--   · ya tiene `created_at`.
-- Crear `perfiles` al lado habría dejado `nombre` en dos tablas (duplicado que
-- se desincroniza) o exigido migrarlo de una a la otra sin ganar nada. Su
-- propósito declarado desde el Sprint 9 ("configuración académica del
-- usuario") no entra en conflicto con guardar su nombre: ambas cosas son
-- "datos del usuario que la app controla", que es justo el criterio con el que
-- el encargo justificaba la tabla nueva.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUÉ LA FK VA `NOT VALID`, y no es pereza
-- ─────────────────────────────────────────────────────────────────────────
-- Hoy `perfil_academico` tiene EXACTAMENTE UNA fila, con
-- user_id = '00000000-0000-0000-0000-000000000001' (USUARIO_SIN_AUTH), y
-- `auth.users` está VACÍA (0 filas, verificado contra la base real antes de
-- escribir esto). Una FK validada de inmediato fallaría al aplicarse: esa
-- fila referencia un usuario que no existe.
--
-- `NOT VALID` es la herramienta correcta y no debilita nada a futuro:
-- Postgres NO comprueba las filas existentes, pero SÍ exige la FK en todo
-- INSERT/UPDATE nuevo. O sea: desde este momento es imposible crear un
-- perfil huérfano, y la única fila huérfana es la que ya sabemos que existe
-- y que la Fase 2 va a reasignar. Cuando esa migración de datos corra, se
-- cierra con `validate constraint` (una línea, en esa migración, no acá).
--
-- Mismo patrón que la migración 20260726120000 ya usó para
-- `tareas_prioridad_chk`: añadir `not valid` y validar después.
--
-- Seguro de aplicar HOY, antes de que exista cualquier login:
--   · Ningún código escribe `perfil_academico` — verificado por grep sobre
--     todo el repo: los 4 puntos que la tocan (cron/recordatorios,
--     api/notificaciones, ai/context/loaders) hacen `select`, nunca insert
--     ni update. La FK nueva no puede romper una escritura que no existe.
--   · El trigger solo dispara con un registro real en `auth.users`, y hoy no
--     hay ninguno ni forma de crearlo (el login no está construido todavía).

alter table public.perfil_academico
  add constraint perfil_academico_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade
  not valid;

-- ─────────────────────────────────────────────────────────────────────────
-- Creación automática del perfil al registrarse
-- ─────────────────────────────────────────────────────────────────────────
-- Patrón oficial de Supabase (docs/guides/auth/managing-user-data),
-- verificado contra la documentación real, incluida su advertencia textual:
-- "If the trigger fails, it could block signups, so test your code
-- thoroughly."
--
-- Esa advertencia es la razón de las DOS defensas de abajo, y conviene
-- entender por qué son gratis:
--
--   1. `on conflict (user_id) do nothing` — si por cualquier motivo ya
--      existe un perfil para ese uuid (la migración de datos de la Fase 2
--      corriendo a mitad de un registro, un reintento del propio Supabase),
--      el registro no falla.
--   2. El bloque `exception` — cualquier otro fallo inesperado se registra
--      como WARNING y el registro CONTINÚA. Se puede hacer porque un perfil
--      ausente degrada con gracia y está comprobado: los 3 lectores usan
--      `.maybeSingle()` y caen a sus valores por defecto
--      (`?? ZONA_HORARIA_POR_DEFECTO`, `?? 3`) — ver
--      app/api/cron/recordatorios/route.ts y lib/ai/context/loaders.ts. Un
--      perfil que falta se puede crear después; un registro bloqueado deja
--      al usuario sin poder entrar a la app, que es mucho peor.
--
-- `security definer` + `set search_path = ''`: el trigger corre con los
-- permisos del dueño (necesario, porque el usuario que se registra todavía
-- no tiene permiso sobre `public`), y con search_path vacío TODA referencia
-- va calificada por esquema — es la recomendación de Supabase para no dejar
-- una función security definer secuestrable por un search_path manipulado.

create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `nombre` sale de la metadata del proveedor cuando existe. Google manda
  -- `full_name` y/o `name`; un registro por teléfono no manda ninguno de los
  -- dos y `nombre` queda null a propósito (la columna es nullable) — la UI
  -- pedirá el nombre después si hace falta.
  -- zona_horaria / max_notif_por_dia NO se listan: sus DEFAULT de la tabla
  -- ('America/Bogota' y 3) ya son los correctos y así no se duplican acá.
  insert into public.perfil_academico (user_id, nombre)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (user_id) do nothing;

  return new;
exception
  when others then
    raise warning 'crear_perfil_al_registrarse falló para %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();
