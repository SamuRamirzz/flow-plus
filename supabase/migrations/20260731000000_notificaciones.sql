-- Sprint 11 — recordatorios y notificaciones: cierre de Fase 1.
--
-- Dos piezas:
--   1. Preferencias de notificación en perfil_academico (no existían pese a
--      que el diseño original del sprint las daba por hechas desde el
--      Sprint 9 — verificado contra la migración real y contra la base en
--      vivo antes de escribir esto, no asumido).
--   2. notificaciones_enviadas — el registro que hace posible la regla de
--      no-redundancia (Parte 2.4 del documento de arquitectura): sin esto,
--      el cron no tiene forma de saber "esto ya se lo dije hoy".

-- ---------------------------------------------------------------------
-- 1. Preferencias de notificación
-- ---------------------------------------------------------------------
-- max_notif_por_dia: tope de cuántas notificaciones nuevas por día genera
-- el gate para un usuario, sin importar cuántas tareas candidatas haya —
-- 3 es el default razonable para no ser invasivo (mismo criterio de "no
-- ruido constante" que ya se usó para detectarColisiones en el Sprint 10).
--
-- no_molestar_desde/hasta: nullable = sin restricción (default). El cron
-- corre UNA VEZ AL DÍA, no continuamente, así que esto no es un silenciador
-- de notificaciones push a cualquier hora — es una condición que el cron
-- evalúa contra SU PROPIO momento de ejecución en la zona horaria del
-- usuario: si cae dentro de la ventana, ese día no genera nada para ese
-- usuario (se retoma al día siguiente). Ver lib/ai/context/fecha.ts
-- (horaEnZona) para el cálculo.
alter table public.perfil_academico
  add column if not exists max_notif_por_dia integer not null default 3,
  add column if not exists no_molestar_desde time,
  add column if not exists no_molestar_hasta time;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfil_academico_max_notif_chk') then
    alter table public.perfil_academico add constraint perfil_academico_max_notif_chk
      check (max_notif_por_dia >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. notificaciones_enviadas
-- ---------------------------------------------------------------------
-- tipo = el `tipo` de LA TAREA (examen/ejercicios/ensayo/lectura/proyecto/
-- otro), no una categoría de notificación aparte — se reusa tal cual llega
-- de `tareas.tipo` en toda la cadena (ventanas.ts lo recibe como parte de
-- la tarea, gate.ts lo pasa a través sin transformarlo). Vive en la llave
-- de no-redundancia junto con fecha para que, si el tipo de una tarea
-- cambia (ej. de 'otro' a 'examen' porque el usuario la corrigió), la
-- vieja fila con el tipo anterior no bloquee un recordatorio nuevo bajo el
-- tipo correcto.
--
-- fecha (date, no timestamptz derivado): el día calendario, en la zona del
-- usuario, en que el cron generó la fila — calculado por el propio cron
-- con hoyEnZona(), NUNCA derivado de created_at::date (que dependería del
-- timezone de sesión de Postgres, no del usuario). Es la clave real de "no
-- duplicar si el cron corre dos veces el mismo día": la segunda corrida
-- vuelve a calcular `hoy`, consulta las filas con esa misma fecha, y
-- decidirNotificar() las ve en `yaEnviadas` y no las repite.
--
-- La unicidad se garantiza en la BASE, no solo en el gate determinístico —
-- mismo criterio de "defensa en profundidad" que materias_user_nombre_uniq
-- (Sprint 5): si alguna vez el cron corriera dos veces en paralelo (ej. un
-- reintento de Vercel superpuesto), el índice único evita el duplicado
-- aunque la lógica de la aplicación fallara.
create table if not exists public.notificaciones_enviadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  tipo text not null,
  urgencia text not null check (urgencia in ('baja', 'media', 'alta')),
  fecha date not null,
  -- true si esta fila se generó junto con al menos otra en la misma
  -- corrida del cron para el mismo usuario (ver notification/gate.ts) —
  -- informativo para quien lea la tabla directamente; NotificationBell
  -- deriva el agrupado del tamaño de la respuesta, no de esta columna.
  agrupada boolean not null default false,
  canal text not null default 'pasiva' check (canal in ('pasiva', 'push', 'email')),
  created_at timestamptz not null default now()
);

create unique index if not exists notificaciones_enviadas_dedupe_idx
  on public.notificaciones_enviadas (tarea_id, tipo, fecha);

create index if not exists notificaciones_enviadas_user_fecha_idx
  on public.notificaciones_enviadas (user_id, fecha desc);

alter table public.notificaciones_enviadas enable row level security;

drop policy if exists "temporal_sin_auth_notificaciones_enviadas" on public.notificaciones_enviadas;
create policy "temporal_sin_auth_notificaciones_enviadas" on public.notificaciones_enviadas
  for all using (true) with check (true);

-- Al llegar auth (ver el plan, sección "Sprint Auth"), la línea que cambia:
-- create policy "propietario_notificaciones_enviadas" on public.notificaciones_enviadas
--   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
