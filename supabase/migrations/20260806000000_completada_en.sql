-- Sprint Home — registra CUÁNDO se completó una tarea, no solo que se
-- completó.
--
-- Sin esto, "puntualidad" (¿la completaste antes o después de vencer?) no
-- es calculable: `tareas` tiene `created_at` (cuándo se creó la fila) pero
-- ninguna columna que capture el momento del toggle a `completada = true`.
-- Verificado contra el esquema real (`information_schema.columns`), no
-- asumido.
--
-- Nullable a propósito, NO `not null default now()`: una tarea que nunca se
-- completó no tiene fecha de completado, y forzar un default inventaría un
-- dato que no existe. Las filas ya completadas antes de esta migración
-- quedan en `null` — son datos reales sin este dato específico, no un error;
-- lib/estadisticas/agregacion.ts las cuenta aparte (`sinDato`) en vez de
-- tratarlas como "a tiempo" o "tarde" por adivinanza.

alter table public.tareas
  add column if not exists completada_en timestamptz;

comment on column public.tareas.completada_en is
  'Se llena cuando completada pasa a true (PATCH /api/tareas/[id]); se limpia a null si vuelve a false. Null en una tarea nunca completada, o en una completada antes de que esta columna existiera — no confundir "sin dato" con "hace mucho tiempo".';
