-- Corrige un DELETE silenciosamente descartado por Realtime en las 3 tablas
-- habilitadas en 20260808000100. Verificado con evidencia real (WebSocket +
-- UI): un DELETE hecho directo en la base nunca llegó al "otro dispositivo"
-- — ni una sola vez, en ningún reintento — pese a que el canal estaba
-- suscrito correctamente y el INSERT de la misma prueba sí llegó.
--
-- Causa raíz, confirmada consultando pg_class.relreplident: las 3 tablas
-- tenían REPLICA IDENTITY 'default' (solo la primary key). Con RLS activa
-- (propietario_* desde 20260804000000_rls_propietario.sql), Realtime
-- necesita evaluar el filtro `user_id=eq.<uid>` contra la fila VIEJA de un
-- DELETE para decidir a quién reenviarlo — pero con identity 'default' esa
-- fila vieja solo trae el id, nunca user_id, así que Realtime no puede
-- evaluar el filtro y descarta el evento sin avisar (ni error, ni log del
-- lado del cliente). INSERT/UPDATE no sufren esto porque siempre viajan con
-- la fila NUEVA completa.
--
-- Aditivo y reversible: no cambia datos ni políticas, solo el nivel de
-- detalle que Postgres incluye en el WAL para estas 3 tablas.
alter table public.tareas replica identity full;
alter table public.horario replica identity full;
alter table public.materias replica identity full;
