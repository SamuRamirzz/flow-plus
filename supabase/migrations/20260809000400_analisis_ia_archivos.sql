-- Sprint Archivos / Fase 7 — análisis de IA sobre archivos ya subidos.
--
-- Hasta acá la IA solo entendía archivos EN EL MOMENTO de conversar
-- (adjuntos de /ai, bucket efímero `tareas`): nada leía nunca un archivo ya
-- guardado en Archivos/Drive. Estas columnas son lo que hace posible que un
-- PDF subido tenga resumen, tipo de documento y tareas detectadas asociadas
-- de forma persistente.
--
-- TODAS nullable, ninguna con default que implique "ya analizado": un
-- archivo subido antes de esta migración (o cuyo análisis falló, o que es un
-- .docx que no se puede leer) es un estado NORMAL, no un error. La UI
-- distingue "todavía no analizado" (analizado_en is null, sin error) de
-- "se intentó y falló" (analisis_error not null) — dos mensajes distintos
-- para el usuario, así que dos columnas distintas y no un booleano.
alter table public.archivos
  add column if not exists resumen_ia text,
  add column if not exists tipo_documento text,
  add column if not exists tareas_detectadas jsonb,
  add column if not exists analizado_en timestamptz,
  add column if not exists analisis_error text,
  -- Mismo criterio que `conversaciones_ia.resumen_intentos` (Fase 1): corta
  -- el reintento infinito. Un archivo cuyo análisis falla siempre (formato
  -- que el modelo rechaza, tamaño excesivo) no puede quedar gastando tokens
  -- cada vez que alguien abre la pantalla de Archivos.
  add column if not exists analisis_intentos smallint not null default 0,
  -- La columna "Última apertura" de la tabla de Archivos. Nullable: un
  -- archivo recién subido que nadie abrió todavía no tiene fecha de
  -- apertura, y mostrar la de creación ahí sería mentir.
  add column if not exists ultima_apertura_en timestamptz;

alter table public.archivos
  drop constraint if exists archivos_analisis_intentos_chk;
alter table public.archivos
  add constraint archivos_analisis_intentos_chk check (analisis_intentos >= 0);

-- Lista cerrada, mismo criterio que `origen`/`creado_por` en las otras
-- tablas: el modelo elige de este enum, no inventa etiquetas libres que
-- después la UI no sabría cómo mostrar.
alter table public.archivos
  drop constraint if exists archivos_tipo_documento_chk;
alter table public.archivos
  add constraint archivos_tipo_documento_chk
  check (tipo_documento is null or tipo_documento in ('examen', 'guia', 'apuntes', 'enunciado', 'horario', 'otro'));

alter table public.archivos
  drop constraint if exists archivos_tareas_detectadas_chk;
alter table public.archivos
  add constraint archivos_tareas_detectadas_chk
  check (tareas_detectadas is null or jsonb_typeof(tareas_detectadas) = 'array');

-- Alimenta la franja "Actividad de IA reciente": los archivos ya analizados,
-- más recientes primero. Parcial porque la enorme mayoría de las filas (las
-- no analizadas) nunca participan de esa consulta.
create index if not exists archivos_user_analizado_idx
  on public.archivos (user_id, analizado_en desc) where analizado_en is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- conversaciones_ia.archivo_id
-- ═══════════════════════════════════════════════════════════════════════════
-- "Conversación con IA sobre este archivo" reusa la tabla que ya existe en
-- vez de crear una `conversaciones_archivo` paralela: es exactamente la
-- misma forma de dato (turnos + resumen opcional), y así los endpoints de
-- historial ya construidos siguen sirviendo sin tocarse.
--
-- `on delete cascade` y NO `set null` — al revés que en `notas`: una nota es
-- prosa que el usuario escribió y sobrevive a que se borre su ancla, pero
-- una conversación SOBRE un archivo no tiene ningún sentido sin el archivo
-- (cada pregunta y cada respuesta refieren a un contenido que ya no existe).
alter table public.conversaciones_ia
  add column if not exists archivo_id uuid references public.archivos(id) on delete cascade;

create index if not exists conversaciones_ia_archivo_idx
  on public.conversaciones_ia (user_id, archivo_id) where archivo_id is not null;
