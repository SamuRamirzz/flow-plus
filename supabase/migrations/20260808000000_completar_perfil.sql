-- Pantalla "Completa tu perfil" (paso nuevo dentro de /bienvenida) —
-- apellido y país, para completar lo que el nombre solo no cubre.
--
-- Van en `perfil_academico`, NO en una tabla `perfiles` (esa tabla no
-- existe — ya corregido dos veces antes en este proyecto, ver los
-- comentarios de 20260803000000_auth_perfil_y_trigger.sql y
-- 20260805000000_onboarding_completado.sql).
--
-- Nullable, sin default — mismo patrón que `nombre`/`institucion` ya
-- existentes en esta tabla: un perfil sin estos campos es uno que no
-- completó el formulario todavía, y esa ausencia ES la señal que usa
-- Bienvenida.tsx para decidir si mostrar el paso (sin agregar un booleano
-- nuevo — la validación del formulario garantiza que, una vez enviado, no
-- quedan a medias).
--
-- `pais` sin tilde (ASCII), por consistencia con el resto de columnas de
-- esta tabla (`zona_horaria`, no `zona_horária`). Guarda el código ISO
-- 3166-1 alpha-2 (ej. 'CO', 'MX'), no el nombre — la UI resuelve el
-- nombre a partir de una lista curada (lib/ajustes/paises.ts).
alter table public.perfil_academico
  add column if not exists apellido text,
  add column if not exists pais text;

comment on column public.perfil_academico.apellido is
  'Nullable = el usuario no completó el formulario de "completa tu perfil" todavía.';
comment on column public.perfil_academico.pais is
  'Código ISO 3166-1 alpha-2 (ej. CO, MX), no el nombre. Nullable = perfil sin completar.';
