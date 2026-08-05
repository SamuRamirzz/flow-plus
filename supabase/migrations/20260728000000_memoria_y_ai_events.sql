-- Sprint 9 — memoria persistente, auditoría de IA y perfil académico.
--
-- Esta memoria es una capa DISTINTA de la memoria de sesión del Sub-sprint
-- 7.2 (los turnos de la conversación del overlay, que viven en estado de
-- React y mueren al cerrarlo). Aquella es efímera por diseño; esta persiste
-- entre sesiones y días. Ninguna reemplaza a la otra.

-- Los seis valores del check son EXACTAMENTE los de `MemoryScope` en
-- lib/ai/types/memory.ts. Si algún día se añade un scope al tipo, esta
-- restricción hay que ampliarla en la misma migración o el insert falla —
-- que es justo lo que se quiere: que la base no acepte un scope que el
-- código no conoce.
create table if not exists public.memoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scope text not null check (scope in ('immediate', 'daily', 'weekly', 'permanent', 'academic', 'contextual')),
  -- jsonb y no text: `MemoryEntry.content` es `unknown` (cualquier forma),
  -- y jsonb permite consultarlo/indexarlo después sin migrar los datos.
  content jsonb not null,
  created_at timestamptz not null default now(),
  -- Nullable = no caduca. El barrido de las entradas vencidas es trabajo
  -- del cron (Sprint 11); mientras tanto SupabaseMemoryStore.get() ya las
  -- filtra en la consulta, así que una entrada vencida nunca se sirve
  -- aunque siga en la tabla.
  expires_at timestamptz
);

-- Ruta caliente: "dame la memoria viva de este usuario en este scope".
create index if not exists memoria_user_scope_idx on public.memoria (user_id, scope, created_at desc);

-- Auditoría de ejecuciones de IA. Se llena desde SupabaseEventSink, que es
-- un LISTENER del bus (no parte de él): la observabilidad nunca debe poder
-- añadir latencia ni tumbar una ejecución de usuario.
create table if not exists public.ai_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tipo text not null,
  payload jsonb,
  source text,
  -- Momento en que se emitió el evento en el proceso (no el del insert):
  -- el insert es fire-and-forget y puede llegar milisegundos después.
  emitted_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_events_user_fecha_idx on public.ai_events (user_id, emitted_at desc);
create index if not exists ai_events_tipo_idx on public.ai_events (tipo, emitted_at desc);

-- Perfil académico. Hoy solo carga una cosa, pero es LA que importa:
-- `zona_horaria`. Sin ella el servidor calcula "hoy" con el reloj del
-- proceso (ver la limitación documentada en lib/horario/hoy.ts), y el cron
-- del Sprint 11 correrá en UTC — ambos pueden equivocarse por un día cerca
-- de medianoche si el usuario está en otro huso.
create table if not exists public.perfil_academico (
  user_id uuid primary key,
  zona_horaria text not null default 'America/Bogota',
  nombre text,
  institucion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.memoria           enable row level security;
alter table public.ai_events         enable row level security;
alter table public.perfil_academico  enable row level security;

-- Mismo criterio "permisivo pero con nombre inequívoco" del Sprint 5: hoy
-- no hay auth, el predicado es `true` y el nombre dice que es temporal.
-- Cuando llegue auth, estas tres líneas pasan a `auth.uid() = user_id`.
drop policy if exists "temporal_sin_auth_memoria" on public.memoria;
create policy "temporal_sin_auth_memoria" on public.memoria for all using (true) with check (true);

drop policy if exists "temporal_sin_auth_ai_events" on public.ai_events;
create policy "temporal_sin_auth_ai_events" on public.ai_events for all using (true) with check (true);

drop policy if exists "temporal_sin_auth_perfil_academico" on public.perfil_academico;
create policy "temporal_sin_auth_perfil_academico" on public.perfil_academico for all using (true) with check (true);
