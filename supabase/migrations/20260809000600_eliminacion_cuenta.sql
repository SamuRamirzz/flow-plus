-- Sprint Soporte + Eliminación de cuenta — dos piezas, ninguna otra tabla se toca.
--
-- ─────────────────────────────────────────────────────────────────────────
-- 1. `perfil_academico` gana el estado de una solicitud de eliminación
-- ─────────────────────────────────────────────────────────────────────────
-- Va en `perfil_academico` y no en una tabla nueva `solicitudes_eliminacion`:
-- es un estado transitorio de EXACTAMENTE un usuario a la vez (nunca hay
-- historial de solicitudes previas que consultar — si cancela y vuelve a
-- pedirlo, es una solicitud nueva que pisa la anterior), y `perfil_academico`
-- ya es la tabla de "un registro por usuario" del proyecto. Una tabla aparte
-- solo para dos columnas nullable habría sido una JOIN adicional en cada
-- lectura sin ganar nada — mismo criterio que ya usó este archivo para NO
-- crear `perfiles` en el Sprint Auth.
--
-- `eliminacion_solicitada_en = null` es el estado normal (sin solicitud
-- pendiente). Al solicitar, se setea junto con `eliminar_drive_tambien`. Al
-- cancelar, los dos vuelven a `null` — no queda rastro de que alguien pidió
-- y se arrepintió, que es justo el comportamiento esperado ("cancelar" borra
-- la intención, no la archiva).
alter table public.perfil_academico
  add column if not exists eliminacion_solicitada_en timestamptz,
  add column if not exists eliminar_drive_tambien boolean;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Auditoría de eliminaciones ejecutadas — SIN FK a auth.users
-- ─────────────────────────────────────────────────────────────────────────
-- A propósito, no un descuido: el punto de esta tabla es sobrevivir al
-- usuario que describe. Con FK a auth.users (incluso on delete set null)
-- perdería sentido apenas se ejecuta el borrado que registra. Mismo criterio
-- que ya usan `memoria`/`ai_events` (user_id como uuid suelto, sin FK) —
-- acá el motivo es más fuerte todavía: esas dos sobreviven por omisión, esta
-- necesita sobrevivir por diseño.
--
-- `email` se captura ANTES de borrar auth.users porque después ya no hay de
-- dónde leerlo — ni `perfil_academico` lo guarda (solo `nombre`). Sin esta
-- copia, el registro de auditoría diría "se borró la cuenta uuid X" sin
-- forma humana de saber a quién correspondía.
--
-- RLS activa pero SIN política — nadie (ni con clave anónima, ni con un JWT
-- válido) puede leer ni escribir esta tabla desde el cliente; solo
-- `supabaseServer` (service_role, que salta RLS) la toca, exactamente igual
-- que el resto de los crons.
create table if not exists public.eliminaciones_cuenta_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  solicitada_en timestamptz not null,
  ejecutada_en timestamptz not null default now(),
  elimino_drive boolean not null,
  drive_resultado text not null check (drive_resultado in ('no_aplicaba', 'exitoso', 'fallo')),
  tablas_borradas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists eliminaciones_cuenta_log_user_idx on public.eliminaciones_cuenta_log (user_id);

alter table public.eliminaciones_cuenta_log enable row level security;
