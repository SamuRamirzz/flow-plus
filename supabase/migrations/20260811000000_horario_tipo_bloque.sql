-- Sprint Zonas de horario — "Ingreso", "Salida", "Descanso" dejan de ser
-- materias falsas y pasan a ser bloques especiales reales de `horario`.
--
-- Hasta hoy la única forma de representar un bloque sin clase era crear una
-- materia llamada "Ingreso"/"Salida"/"Descanso" y agendarla como si fuera
-- una asignatura — contamina el selector de materias, el conteo "por
-- materia" de Home/estadísticas, y el picker de materia de cualquier tarea
-- nueva. `tipo` reemplaza ese hack: `materia_id` pasa a ser NULLABLE, y es
-- obligatorio EXACTAMENTE cuando `tipo = 'clase'` (biconstricción completa,
-- no solo "clase exige materia" — un bloque especial tampoco puede
-- cargar una materia real) — mismo criterio que ya usa `crearTareaSchema`
-- en el código (materiaId nullable + .refine() a nivel de aplicación), acá
-- espejado con un check a nivel de base como defensa en profundidad, igual
-- que `horario_horas_chk` ya es el gemelo en BD del refine de orden de
-- horas en `lib/api/schemas.ts`.
alter table public.horario
  alter column materia_id drop not null;

alter table public.horario
  add column tipo text not null default 'clase'
    check (tipo in ('clase', 'ingreso', 'salida', 'descanso'));

alter table public.horario
  add constraint horario_tipo_materia_chk
    check ((tipo = 'clase') = (materia_id is not null));

-- El índice existente (`horario_user_materia_idx`) ya tolera materia_id
-- nulo sin cambios: un índice parcial sobre `where activo` no exige que la
-- columna indexada sea NOT NULL, simplemente no indexa filas con
-- materia_id null (que de todos modos nunca se consultan por materia).
