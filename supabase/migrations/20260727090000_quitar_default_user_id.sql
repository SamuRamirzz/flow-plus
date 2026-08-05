-- Sprint 6 — cierre del retrofit de user_id.
--
-- El DEFAULT de la migración del Sprint 5 existía para que las escrituras
-- que todavía salían directo del navegador (con la clave anónima) no
-- rompieran. Ya no hay ninguna: crear/actualizar/borrar tareas y materias
-- pasa por Route Handlers (app/api/tareas, app/api/materias) que llaman a
-- getUserId() explícitamente en cada insert. Dejar el DEFAULT a partir de
-- ahora sería un riesgo silencioso: un insert que se le "olvide" pasar
-- user_id quedaría asignado al usuario de mentira sin ningún aviso, en vez
-- de fallar de forma ruidosa como debería.
--
-- Idempotente: DROP DEFAULT sobre una columna que ya no tiene default no
-- da error.
alter table public.materias alter column user_id drop default;
alter table public.tareas   alter column user_id drop default;
