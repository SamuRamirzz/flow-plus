-- Sprint 5 — Fundación de datos
--
-- Prepara materias/tareas para multiusuario SIN implementar auth todavía:
-- añade user_id con una constante, activa RLS con política permisiva, y
-- endurece el esquema (índices, constraints, columnas que las fases de IA
-- siguientes necesitan).
--
-- Por qué user_id AHORA si no hay auth: el tipo es uuid para poder hacer
-- FK a auth.users más adelante sin migrar datos, y activar RLS después
-- sería el paso peligroso (todo se rompe de golpe). Activándola ahora con
-- un predicado permisivo, lo único que cambia al llegar auth es ese
-- predicado — una línea por tabla.
--
-- Idempotente: se puede correr dos veces sin error.

-- ---------------------------------------------------------------------
-- 1. user_id
-- ---------------------------------------------------------------------
-- El DEFAULT existe para que las escrituras que hoy salen directo del
-- navegador sigan funcionando. Se elimina en el Sprint 6, cuando todas
-- las mutaciones pasen por Route Handlers. Quitarlo ahora rompería la app.
alter table public.materias
  add column if not exists user_id uuid not null default '00000000-0000-0000-0000-000000000001';
alter table public.tareas
  add column if not exists user_id uuid not null default '00000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------
-- 2. Índices
-- ---------------------------------------------------------------------
create index if not exists materias_user_idx        on public.materias (user_id);
create index if not exists tareas_user_fecha_idx    on public.tareas (user_id, fecha_entrega);
create index if not exists tareas_user_materia_idx  on public.tareas (user_id, materia_id);
-- Parcial: la consulta más frecuente de la app es "pendientes por fecha".
create index if not exists tareas_pendientes_idx
  on public.tareas (user_id, fecha_entrega) where completada = false;

-- Convierte la deduplicación de materias por nombre —hoy un .find() en el
-- cliente dentro de lib/tasks.ts, susceptible a carrera cuando /ai crea
-- varias tareas de la misma materia nueva a la vez— en una garantía de la
-- base de datos.
-- OJO: falla si ya existen nombres duplicados. Ver supabase/PREFLIGHT.md
-- (comprobación 1) antes de aplicar.
create unique index if not exists materias_user_nombre_uniq
  on public.materias (user_id, lower(nombre));

-- ---------------------------------------------------------------------
-- 3. Constraints de dominio
-- ---------------------------------------------------------------------
-- prioridad es texto libre hoy aunque la UI solo emite baja|media|alta.
-- NOT VALID + VALIDATE por separado: si hay filas sucias, VALIDATE falla
-- y nos enteramos, en vez de que la restricción entre silenciosamente sin
-- cubrir el histórico.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tareas_prioridad_chk') then
    alter table public.tareas
      add constraint tareas_prioridad_chk check (prioridad in ('baja','media','alta')) not valid;
  end if;
end $$;

alter table public.tareas validate constraint tareas_prioridad_chk;

-- ---------------------------------------------------------------------
-- 4. Columnas que necesitan las fases de IA siguientes
-- ---------------------------------------------------------------------
-- Se añaden ahora porque ya estamos tocando la tabla; evita una segunda
-- migración con bloqueo más adelante.
--   tipo            → ya lo produce HomeworkAgent (DetectedTask.tipo) y hoy se descarta
--   origen          → distingue tarea manual de tarea creada por IA
--   confianza       → confianza del modelo en la extracción
--   fecha_inferida  → true si la fecha la puso el horario, no el usuario (Sprint 7)
--   motivo_fecha    → "Matemáticas se dicta los lunes", para mostrarlo en la UI
alter table public.tareas
  add column if not exists tipo text not null default 'otro',
  add column if not exists origen text not null default 'manual',
  add column if not exists confianza numeric,
  add column if not exists fecha_inferida boolean not null default false,
  add column if not exists motivo_fecha text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tareas_tipo_chk') then
    alter table public.tareas add constraint tareas_tipo_chk
      check (tipo in ('ejercicios','examen','ensayo','lectura','proyecto','otro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tareas_origen_chk') then
    alter table public.tareas add constraint tareas_origen_chk
      check (origen in ('manual','ia_texto','ia_foto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tareas_confianza_chk') then
    alter table public.tareas add constraint tareas_confianza_chk
      check (confianza is null or (confianza >= 0 and confianza <= 1));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.materias enable row level security;
alter table public.tareas   enable row level security;

-- TEMPORAL, permisiva. El nombre está elegido para que sea imposible
-- confundirla con una política real en una revisión futura.
drop policy if exists "temporal_sin_auth_materias" on public.materias;
create policy "temporal_sin_auth_materias" on public.materias
  for all using (true) with check (true);

drop policy if exists "temporal_sin_auth_tareas" on public.tareas;
create policy "temporal_sin_auth_tareas" on public.tareas
  for all using (true) with check (true);

-- Al llegar auth (cualquier momento después del Sprint 6), ESTO es todo
-- lo que cambia en la base de datos:
--
--   drop policy "temporal_sin_auth_tareas" on public.tareas;
--   create policy "propietario_tareas" on public.tareas
--     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
--
-- y en el código, lib/server/usuario.ts pasa a leer la sesión.
