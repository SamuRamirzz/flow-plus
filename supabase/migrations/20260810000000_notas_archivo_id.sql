-- Sprint Archivos / Notas en el panel de detalle — tercer ancla para `notas`.
--
-- Hasta ahora una nota podía anclarse a una tarea o a un bloque de horario,
-- pero NO a un archivo — un hueco real: el encargo de este sprint asumía que
-- `archivo_id` ya existía en `notas` (copiándolo de `conversaciones_ia`, que
-- sí lo tiene desde Fase 7), y no es así. Verificado contra
-- information_schema antes de escribir esta migración.
--
-- `on delete set null`, igual que `tarea_id`/`bloque_horario_id` — una nota
-- es prosa que el usuario escribió; que el archivo al que estaba anclada se
-- borre no debe destruirla, la deja "suelta" (mismo criterio ya documentado
-- en la migración original de `notas`).
alter table public.notas add column if not exists archivo_id uuid references public.archivos(id) on delete set null;

create index if not exists notas_user_archivo_idx
  on public.notas (user_id, archivo_id) where archivo_id is not null;

-- El check original solo contaba 2 anclas; se reemplaza por uno que cuenta
-- las 3 sin cambiar la semántica ("como mucho una a la vez").
alter table public.notas drop constraint if exists notas_ancla_chk;
alter table public.notas add constraint notas_ancla_chk
  check (num_nonnulls(tarea_id, bloque_horario_id, archivo_id) <= 1);
