-- Sprint Onboarding — marca explícita de "este usuario ya vio la bienvenida".
--
-- ⚠️ VA EN `perfil_academico`, NO EN UNA TABLA `perfiles`.
-- El encargo de este sprint dice textualmente "la fila de perfil
-- (`public.perfiles`, creada en el Sprint de Auth vía el trigger de
-- `on auth.users insert`)". Esa tabla NO EXISTE: verificado contra la base
-- real (`information_schema.tables` en `public` devuelve exactamente
-- ai_events, horario, materias, memoria, notificaciones_enviadas,
-- perfil_academico, tareas). El Sprint Auth evaluó crear `perfiles` y
-- decidió lo contrario, con la justificación completa escrita en la cabecera
-- de 20260803000000_auth_perfil_y_trigger.sql: `perfil_academico` YA era la
-- tabla de perfil (PK = user_id, ya tenía nombre/institucion/created_at), y
-- duplicarla habría dejado `nombre` en dos sitios desincronizándose. El
-- trigger `on_auth_user_created` inserta ahí, no en `perfiles`.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUÉ UNA COLUMNA EXPLÍCITA Y NO "created_at hace menos de 1 minuto"
-- ─────────────────────────────────────────────────────────────────────────
-- El encargo ofrecía las dos opciones y ya se inclinaba por esta; la base
-- real lo confirma. Comparar `created_at` contra `now()` habría fallado en
-- el caso más común de este proyecto: el usuario real
-- (samugame79@gmail.com) tiene su perfil creado a las 20:43 y su última
-- sesión a las 23:12 — dos horas y media de diferencia. Con la heurística
-- de tiempo, un usuario que se registra y entra un rato después nunca vería
-- el onboarding; y uno que reinstala o vuelve a entrar a los 30 segundos lo
-- vería dos veces. Una columna de estado no tiene ninguno de los dos modos
-- de fallo.
--
-- `not null default false` (y no nullable): un perfil sin la marca es un
-- perfil que no completó el onboarding, que es exactamente `false`. Nullable
-- añadiría un tercer estado ("no sé") que ninguna rama de la UI sabría
-- renderizar.
--
-- Aditiva pura y segura de aplicar en caliente:
--   · Los 3 perfiles existentes (1 real + 2 usuarios de prueba creados por
--     los scripts de diagnóstico del magic link) quedan en `false`, o sea
--     "verán el onboarding la próxima vez que entren" — que es el
--     comportamiento correcto y deseado para los tres.
--   · Ningún lector actual de `perfil_academico` hace `select *`: los 3
--     puntos que la tocan (app/api/cron/recordatorios, app/api/notificaciones,
--     lib/ai/context/loaders.ts) piden columnas nombradas, así que una
--     columna nueva no puede romperles el tipo ni el parseo.

alter table public.perfil_academico
  add column if not exists onboarding_completado boolean not null default false;

comment on column public.perfil_academico.onboarding_completado is
  'true una vez que el usuario terminó O saltó explícitamente la pantalla de bienvenida. Cerrar la pestaña a mitad NO lo marca: solo lo escribe PATCH /api/perfil ante una acción deliberada.';
