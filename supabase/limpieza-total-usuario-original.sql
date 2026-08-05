-- ═══════════════════════════════════════════════════════════════════════════
-- LIMPIEZA TOTAL, DE UNA SOLA VEZ — borra todo lo de USUARIO_SIN_AUTH
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Reemplaza el diseño original de este sprint (reasignar cada fila al uuid
-- real del usuario, preservando los datos). Decisión explícita del usuario:
-- los datos actuales (33 materias, 8 tareas) son mayormente de prueba y no
-- vale la pena conservarlos — mejor empezar con la cuenta real en blanco que
-- cargar con datos de auditoría.
--
-- Esto es una SIMPLIFICACIÓN real, no solo un atajo: al no haber nada que
-- reasignar, desaparece el riesgo que motivaba todo el cuidado del diseño
-- anterior (fusionar `perfil_academico`, verificar que ningún UPDATE dejara
-- una fila a medio mover, validar la FK al final). Un usuario nuevo entra a
-- una app vacía — no hay ningún estado intermedio que pueda quedar mal.
--
-- ⚠️ Igual que la migración de datos original, vive FUERA de
-- `supabase/migrations/`: es una operación de una sola vez, no algo que el
-- CLI deba reaplicar en cada `db push`.
--
-- Este archivo NO necesita editarse antes de correr — a diferencia del
-- diseño anterior, no depende de pegar ningún uuid: borra todo lo que hoy
-- pertenece a la constante conocida, sin importar quién se vaya a registrar
-- después.

begin;

do $$
declare
  viejo_uid uuid := '00000000-0000-0000-0000-000000000001';  -- USUARIO_SIN_AUTH
  n_notif int; n_tareas int; n_horario int; n_materias int; n_memoria int; n_perfil int; n_eventos int;
begin
  -- Orden por dependencia de FK (todas ON DELETE CASCADE, verificado contra
  -- la base real, pero se borra explícito en vez de confiar solo en cascada:
  -- así el conteo de cada tabla queda claro en el NOTICE final).
  delete from public.notificaciones_enviadas where user_id = viejo_uid;
  get diagnostics n_notif = row_count;

  delete from public.tareas where user_id = viejo_uid;
  get diagnostics n_tareas = row_count;

  delete from public.horario where user_id = viejo_uid;
  get diagnostics n_horario = row_count;

  delete from public.materias where user_id = viejo_uid;
  get diagnostics n_materias = row_count;

  delete from public.memoria where user_id = viejo_uid;
  get diagnostics n_memoria = row_count;

  -- ai_events: sus filas del usuario viejo (si hay alguna explícita; la
  -- inmensa mayoría tiene user_id NULL, esas NO se tocan — son auditoría de
  -- sistema sin dueño, no datos personales, y no es lo que se pidió limpiar).
  delete from public.ai_events where user_id = viejo_uid;
  get diagnostics n_eventos = row_count;

  delete from public.perfil_academico where user_id = viejo_uid;
  get diagnostics n_perfil = row_count;

  raise notice 'Borrado bajo % → notificaciones:% tareas:% horario:% materias:% memoria:% perfil:% ai_events:%',
    viejo_uid, n_notif, n_tareas, n_horario, n_materias, n_memoria, n_perfil, n_eventos;

  -- Comprobación final dentro de la misma transacción — si algo quedó atrás
  -- (ej. una FK con ON DELETE distinto de CASCADE que no se tuvo en cuenta),
  -- se aborta y no se guarda nada en vez de dejar un borrado parcial.
  if exists (select 1 from public.materias where user_id = viejo_uid)
     or exists (select 1 from public.tareas where user_id = viejo_uid)
     or exists (select 1 from public.horario where user_id = viejo_uid)
     or exists (select 1 from public.memoria where user_id = viejo_uid)
     or exists (select 1 from public.perfil_academico where user_id = viejo_uid)
     or exists (select 1 from public.notificaciones_enviadas where user_id = viejo_uid) then
    raise exception 'Quedó algo sin borrar bajo % — abortando.', viejo_uid;
  end if;

  raise notice 'OK: no queda ninguna fila bajo %', viejo_uid;
end $$;

commit;

-- ── Verificación posterior (correr aparte, después del commit) ────────────
-- select 'materias' t, count(*) from public.materias
-- union all select 'tareas', count(*) from public.tareas
-- union all select 'horario', count(*) from public.horario
-- union all select 'memoria', count(*) from public.memoria
-- union all select 'perfil_academico', count(*) from public.perfil_academico
-- union all select 'notificaciones', count(*) from public.notificaciones_enviadas;
--
-- Todas en 0. `ai_events` puede seguir teniendo filas (las de user_id NULL,
-- que no se tocan a propósito).
--
-- Los 20 archivos de Storage bajo este mismo prefijo se borran aparte, con
-- la API de Storage (no con SQL) — ver PROCEDIMIENTO-migracion-usuario.md.
