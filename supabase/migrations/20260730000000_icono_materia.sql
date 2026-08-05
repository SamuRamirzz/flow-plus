-- Sub-sprint — ícono automático por materia.
--
-- Aditiva y mínima: UNA columna nueva, con default, sin restricción sobre
-- el histórico. No borra ni modifica ninguna fila; no puede fallar por
-- datos existentes (a diferencia de la migración del Sprint 5, que sí
-- podía chocar con duplicados/prioridades sucias).
--
-- El valor es el nombre del ícono de lucide-react como string (ej.
-- "Calculator") — la base nunca sabe de React, solo guarda el nombre; la
-- UI lo resuelve al componente real (components/ui/iconosMateria.tsx).
--
-- Se asigna server-side al crear una materia (lib/server/materias.ts,
-- resolverOCrearMateria): primero por mapeo determinístico de palabras
-- clave (lib/materias/asignarIcono.ts, gratis y sin red); si el nombre no
-- calza con ningún patrón conocido, cae a IconoMateriaAgent (Gemini,
-- modeloLigero) como respaldo; si eso también falla o no está disponible,
-- 'GraduationCap' (el mismo default de acá) — nunca queda una materia sin
-- ícono.
alter table public.materias
  add column if not exists icono text not null default 'GraduationCap';
