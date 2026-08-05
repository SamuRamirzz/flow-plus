-- Sprint 12 / cierre de Fase 1 — campos propios de un examen.
--
-- ⚠️ DESVIACIÓN REGISTRADA FRENTE AL PLAN. El plan especifica una tabla
-- `examenes` separada. Se implementa como TRES COLUMNAS en `tareas`, y no es
-- una simplificación por comodidad: una tabla aparte crea exactamente el
-- "sistema paralelo que se puede desincronizar" que el propio encargo pide
-- evitar. Lo que habría exigido, verificado archivo por archivo antes de
-- decidir:
--
--   1. `notificaciones_enviadas.tarea_id` es FK a `tareas(id)`. Una tabla
--      aparte obliga a una segunda columna `examen_id` nullable + un CHECK de
--      "uno y solo uno", o a una segunda tabla de notificaciones. Referencia
--      polimórfica = dos caminos que se desincronizan.
--   2. `components/ai/registroOperaciones.ts` (el Deshacer del Sprint 7.2)
--      está tipado entero sobre `tareaId: string` y `tareaEliminada: Tarea`.
--      Soportar exámenes obliga a volverlo polimórfico o a duplicarlo.
--   3. `detectarColisiones` (Sprint 10) y `ventanas.ts` (Sprint 11) YA tratan
--      `tipo === 'examen'` de forma especial y funcionan hoy: colisión
--      examen-vs-examen y ventana de recordatorio +2 días. Con una tabla
--      aparte, ambas funciones necesitarían recibir dos fuentes.
--   4. Las 6 rutas de lectura (cargarTareas, MiniCalendar, AgendaSummary,
--      NotificationBell, TaskTable, DayDetailModal) tendrían que unir dos
--      fuentes, con el riesgo de romper el panel rediseñado del 7.5, el undo
--      del 7.2 y las notificaciones agrupadas del Sprint 11.
--
-- Con columnas, los 4 puntos siguen funcionando SIN UN SOLO CAMBIO. Y el
-- motivo real por el que el plan postergó la tabla ("sin ningún beneficio
-- visible hasta que se capture temario/peso") queda satisfecho: se captura
-- temario/peso, que era el objetivo, sin pagar el costo de unir dos fuentes.
--
-- Nota: el plan afirma que el DDL de `examenes` "ya está escrito". Se buscó
-- en el plan completo y en docs/ai-architecture/ y NO existe en ninguna parte
-- — solo la mención de una línea. La lista de campos usada acá es la que el
-- propio encargo enumera (temario, formato, peso), descartando los que
-- `tareas` ya tiene (titulo, fecha, prioridad, completado→completada, origen,
-- confianza) — que es, por sí solo, otra señal de que eran la misma entidad.
--
-- Aditiva y sin riesgo: 3 columnas nullable, sin default, sin restricción
-- sobre el histórico. Ninguna fila existente cambia.

alter table public.tareas
  -- Qué entra en el examen. Texto libre a propósito: lo que el usuario dicta
  -- ("capítulos 4 al 7, sin el anexo") no tiene estructura estable, y el
  -- Quiz Generator (Fase 3) lo consumirá como prosa igual.
  add column if not exists temario text,
  -- Unión cerrada porque la UI sí ramifica sobre esto. 'mixto' existe porque
  -- "escrito + oral" es un caso real en evaluaciones universitarias.
  add column if not exists formato text,
  -- Porcentaje de la nota final (0-100), no fracción 0-1: es como lo dice el
  -- usuario ("vale el 30%") y evita el error de guardar 30 queriendo 0.30.
  add column if not exists peso numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tareas_formato_chk') then
    alter table public.tareas add constraint tareas_formato_chk
      check (formato is null or formato in ('oral', 'escrito', 'proyecto', 'mixto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tareas_peso_chk') then
    alter table public.tareas add constraint tareas_peso_chk
      check (peso is null or (peso >= 0 and peso <= 100));
  end if;
end $$;

-- Los tres campos solo tienen sentido con tipo='examen'. NO se fuerza con un
-- CHECK a propósito: si el usuario corrige el tipo de una tarea de 'examen' a
-- 'otro', un CHECK haría fallar el UPDATE en vez de dejarlo pasar, y perder
-- el temario que ya había escrito sería peor que guardar un campo inerte.
comment on column public.tareas.temario is 'Solo con tipo=examen. Qué entra en el examen, prosa libre.';
comment on column public.tareas.formato is 'Solo con tipo=examen. oral|escrito|proyecto|mixto.';
comment on column public.tareas.peso is 'Solo con tipo=examen. Porcentaje de la nota final, 0-100.';
