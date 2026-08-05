-- Sprint 7 — horario semanal de clases.
--
-- Una fila por (materia, día) — no un array de días — porque una materia
-- puede tener horas/aula distintas en cada día que se dicta, y porque "qué
-- materias hay el día X" (la consulta que realmente importa para
-- inferirFechaEntrega) es una query indexada sobre una fila por día, no
-- una búsqueda dentro de un array en cada fila de materia.
--
-- dia_semana usa la convención ISO-8601 (1=lunes … 7=domingo), NO la de
-- JavaScript (0=domingo … 6=sábado) — el producto es en español, la semana
-- empieza en lunes, y SegmentedToggle ya renderiza L-M-X-J-V-S-D. La
-- conversión entre ambas vive en un único lugar: lib/horario/dias.ts.
-- Sin DEFAULT en user_id (a diferencia de materias/tareas en el Sprint 5):
-- esta tabla nace DESPUÉS de que todas las escrituras ya pasan por Route
-- Handlers, así que no hay periodo transitorio de escritura directa desde
-- el cliente que cubrir — el único punto de escritura (app/api/horario)
-- siempre pasa user_id explícitamente desde el primer día.
create table if not exists public.horario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  materia_id uuid not null references public.materias(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora_inicio time,
  hora_fin time,
  aula text,
  profesor text,
  activo boolean not null default true,
  -- Nullable a propósito: permite versionar un cambio de horario detectado
  -- (Class Schedule Agent, Sprint 8: "detecté un cambio en tu horario") sin
  -- destruir el histórico — no se usan todavía, pero costarían una segunda
  -- migración con bloqueo si se añadieran después.
  vigente_desde date,
  vigente_hasta date,
  origen text not null default 'manual' check (origen in ('manual', 'foto')),
  confianza numeric check (confianza between 0 and 1),
  created_at timestamptz not null default now(),
  constraint horario_horas_chk check (hora_fin is null or hora_inicio is null or hora_fin > hora_inicio)
);

-- Ruta caliente de inferirFechaEntrega: "qué materias se dictan el día X
-- para este usuario". Parcial sobre `activo` porque los bloques desactivados
-- (versión vieja de un horario cambiado) no deben entrar en la inferencia.
create index if not exists horario_user_dia_idx on public.horario (user_id, dia_semana) where activo;
create index if not exists horario_user_materia_idx on public.horario (user_id, materia_id) where activo;

alter table public.horario enable row level security;

drop policy if exists "temporal_sin_auth_horario" on public.horario;
create policy "temporal_sin_auth_horario" on public.horario
  for all using (true) with check (true);
