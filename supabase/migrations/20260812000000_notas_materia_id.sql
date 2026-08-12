-- Sprint Sistema de Notas Unificado — cuarta ancla para `notas`: `materia_id`.
--
-- Hasta ahora una nota podía anclarse a una tarea, un bloque de horario o un
-- archivo, pero no a una materia en general (una nota que no es sobre una
-- clase puntual ni una tarea concreta, sino sobre la materia como un todo —
-- ej. "el profe cambia de salón cada semana, revisar el grupo de WhatsApp").
-- Decisión explícita del usuario para este sprint: agregar la 4ta ancla
-- ahora en vez de posponerla a un sprint aparte.
--
-- `on delete set null`, mismo criterio que las otras 3 anclas — una nota es
-- prosa que el usuario escribió; que la materia se borre no debe destruirla,
-- la deja "suelta" (mismo criterio ya documentado en la migración original).
alter table public.notas add column if not exists materia_id uuid references public.materias(id) on delete set null;

create index if not exists notas_user_materia_idx
  on public.notas (user_id, materia_id) where materia_id is not null;

-- El check anterior contaba 3 anclas; se reemplaza por uno que cuenta las 4
-- sin cambiar la semántica ("como mucho una a la vez", nunca "exactamente
-- una" — una nota suelta con las 4 en null sigue siendo un estado válido,
-- ya usado en producción antes de este sprint).
alter table public.notas drop constraint if exists notas_ancla_chk;
alter table public.notas add constraint notas_ancla_chk
  check (num_nonnulls(tarea_id, bloque_horario_id, archivo_id, materia_id) <= 1);
