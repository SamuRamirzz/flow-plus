-- Sprint 1/3 — Sistema de Notificaciones (in-app).
--
-- Tabla general de notificaciones para el usuario, DISTINTA de
-- `notificaciones_enviadas` (Sprint 11): esa tabla es un LEDGER interno de
-- deduplicación para el cron de recordatorios (qué tarea+tipo+fecha ya se
-- procesó ese día; nunca la lee el cliente). Esta es el MODELO DE PRODUCTO —
-- lo que la campana y el panel muestran, con estado leída/no leída, borrado
-- individual, y cualquier tipo de evento (no solo tareas). El cron de
-- recordatorios sigue escribiendo en notificaciones_enviadas para su propia
-- deduplicación Y, además, en esta tabla para lo que ve el usuario (ver
-- app/api/cron/recordatorios/route.ts).
--
-- `canal` anticipa el Sprint 2/3 (WhatsApp) como un segundo canal de ENTREGA
-- de la misma notificación — hoy solo se usa 'app', pero el campo ya existe
-- para no tener que migrar de nuevo cuando llegue ese sprint.
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  tipo text not null check (tipo in (
    'tarea_vencida', 'tarea_proxima', 'recordatorio_horario',
    'nota_agregada', 'mensaje_ia', 'sistema'
  )),
  titulo text not null,
  cuerpo text,

  -- entidad_tipo/entidad_id: a qué apunta esta notificación, para poder
  -- navegar ahí con un clic. Ninguna FK real a propósito — apunta a una de
  -- 4 tablas distintas según el tipo, y la fila referida puede haberse
  -- borrado después (la notificación sigue siendo válida como historial
  -- aunque su destino ya no exista; la UI simplemente no podrá navegar).
  entidad_tipo text check (entidad_tipo in ('tarea', 'bloque_horario', 'archivo', 'nota')),
  entidad_id uuid,

  leida boolean not null default false,
  creada_en timestamptz not null default now(),
  canal text not null default 'app' check (canal in ('app', 'whatsapp'))
);

-- Ruta caliente de la campana: "mis no leídas" (para el badge/contador).
-- Índice parcial: solo indexa lo que de verdad se consulta por este camino
-- — una notificación ya leída nunca se vuelve a buscar así.
create index if not exists idx_notificaciones_user_no_leidas
  on public.notificaciones (user_id, leida)
  where leida = false;

-- Ruta caliente del panel completo: lista paginada por recencia.
create index if not exists idx_notificaciones_user_creada
  on public.notificaciones (user_id, creada_en desc);

alter table public.notificaciones enable row level security;

-- Una sola política `for all`, mismo patrón que archivos/notas/
-- conversaciones_ia desde que Auth quedó cerrado (20260804000000): el
-- bloqueo real de escritura para anon/authenticated no lo hace esta
-- política sino los GRANTs por defecto (revocados en
-- 20260801000000_revocar_escrituras_anon.sql vía `alter default
-- privileges`, que ya cubre cualquier tabla nueva) — INSERT solo puede
-- pasar por `supabaseServer` (service_role), que salta RLS por completo.
-- La política de acá existe para SELECT (lo que lee el cliente, incluida
-- la suscripción de Realtime) y para acotar UPDATE/DELETE al dueño como
-- defensa en profundidad.
drop policy if exists "propietario_notificaciones" on public.notificaciones;
create policy "propietario_notificaciones" on public.notificaciones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime — mismo patrón que 20260808000100/20260808000200 (tareas/
-- horario/materias): sin la tabla en la publicación, un canal se suscribe
-- pero nunca recibe nada; sin REPLICA IDENTITY FULL, un DELETE bajo RLS se
-- descarta en silencio porque Realtime necesita la fila vieja completa
-- (incluido user_id) para evaluar el filtro `user_id=eq.<uid>`. Se aplican
-- las dos desde el principio para esta tabla nueva, en vez de repetir la
-- investigación que encontró ese bug la primera vez (ver el comentario de
-- 20260808000200 para el diagnóstico original).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;

alter table public.notificaciones replica identity full;
