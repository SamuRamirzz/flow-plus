-- Sprint Archivos / Fase 1 — esquema de Archivos, Notas e Historial de IA.
--
-- Tres tablas nuevas, ninguna existente se toca. Las tres nacen ya con la
-- política `propietario_*` (auth.uid() = user_id): el patrón "temporal sin
-- auth" con `using(true)` es histórico y quedó eliminado en 20260804000000 —
-- Auth está completo desde entonces, así que no aplica.
--
-- Nada de esto se USA todavía: los endpoints, la integración con Drive y la
-- parte de IA son tramos posteriores. Se crea el esquema completo de una para
-- no tener que alterar más adelante tablas que ya tengan datos vivos.

-- ═══════════════════════════════════════════════════════════════════════════
-- archivos
-- ═══════════════════════════════════════════════════════════════════════════
-- DECISIÓN: `tarea_id` y `materia_id` son INDEPENDIENTES, no se hereda la
-- materia de la tarea.
--
-- Un archivo de una materia SIN ninguna tarea asociada (el programa del curso,
-- apuntes de clase, una guía) es un caso de producto de primera clase. Si
-- `materia_id` se derivara de `tarea_id`, ese archivo no tendría materia y
-- "todos los archivos de Cálculo" pasaría de ser un índice a ser un `or` con
-- join.
--
-- El riesgo de desincronización es real y conocido: si una tarea cambia de
-- materia, `archivos.materia_id` queda obsoleto. Se acepta a propósito porque
-- la sincronización tiene que vivir en el código de todas formas — cuando una
-- tarea cambia de materia, su archivo también debe MOVERSE DE CARPETA en
-- Drive, y eso un trigger de Postgres no puede hacerlo. Si el endpoint ya va a
-- tocar la fila, actualizar una columna más es gratis; un trigger solo añadiría
-- un segundo sitio donde mantener el mismo invariante, que es exactamente como
-- se desincronizan las cosas.
--
-- INVARIANTE (la garantiza el endpoint, no la base): si `tarea_id` no es null,
-- `materia_id` debe ser la materia de esa tarea.
--
-- Se evaluó y descartó una FK compuesta (tareas(id, materia_id) con on update
-- cascade), que haría la desincronización imposible: verificado contra la base
-- que `tareas.materia_id` ES NULLABLE, y con semántica MATCH SIMPLE una FK
-- compuesta ni siquiera se evalúa cuando una columna es null — la garantía
-- sería parcial. Además `on delete set null` sobre una FK compuesta pondría a
-- null AMBAS columnas, desvinculando el archivo también de su materia.
create table if not exists public.archivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- `set null` y no `cascade`: borrar una tarea no debe borrar el registro de
  -- un archivo que sigue existiendo en el Drive del usuario.
  tarea_id uuid references public.tareas(id) on delete set null,
  materia_id uuid references public.materias(id) on delete set null,

  nombre text not null,
  mime_type text,
  tamano_bytes bigint check (tamano_bytes is null or tamano_bytes >= 0),

  -- Identidad del lado de Drive. `drive_file_id` es nullable porque la fila
  -- puede registrarse antes de que la subida termine (o quedar registrada si
  -- falla, para poder reintentarla). Por eso el índice único es parcial.
  drive_file_id text,
  drive_web_view_link text,

  categoria text,
  origen text not null default 'usuario' check (origen in ('usuario', 'ia')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists archivos_user_drive_uniq
  on public.archivos (user_id, drive_file_id) where drive_file_id is not null;
create index if not exists archivos_user_tarea_idx
  on public.archivos (user_id, tarea_id) where tarea_id is not null;
create index if not exists archivos_user_materia_idx
  on public.archivos (user_id, materia_id) where materia_id is not null;
create index if not exists archivos_user_fecha_idx on public.archivos (user_id, created_at desc);

alter table public.archivos enable row level security;
drop policy if exists "propietario_archivos" on public.archivos;
create policy "propietario_archivos" on public.archivos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- notas
-- ═══════════════════════════════════════════════════════════════════════════
-- DECISIÓN: "COMO MUCHO UNA" ancla (`<= 1`), no "exactamente una".
--
--   · "Exactamente una" prohibiría la nota suelta ("preguntar al profe el
--     lunes", "ideas para el proyecto final"), que es la mitad de para qué
--     sirve una app de notas. El usuario acabaría anclando notas a una tarea
--     cualquiera solo para poder guardarlas — datos peor estructurados.
--   · "Ambas libres" haría que una nota anclada a una tarea Y a un bloque
--     apareciera DUPLICADA, porque los dos endpoints futuros (`?tarea_id=` y
--     `?bloque_horario_id=`) la devolverían. Y al borrar la tarea quedaría
--     medio-anclada, en un estado que nadie diseñó.
--
-- `<= 1` cierra esa combinación en la base, no en la revisión de código.
--
-- ⚠️ OBLIGACIÓN PARA EL TRAMO DE UI, escrita acá para que no se pierda:
-- `on delete set null` (y no cascade) significa que borrar una tarea convierte
-- sus notas en "sueltas" en vez de destruirlas — borrar una tarea NUNCA debe
-- destruir prosa que el usuario escribió. Pero eso exige que `GET /api/notas`
-- tenga un modo "sueltas" (tarea_id is null and bloque_horario_id is null) y
-- que la pantalla las muestre. Sin eso, borrar una tarea convierte sus notas en
-- datos invisibles — peor que borrarlas, porque el usuario cree que las perdió
-- y nadie puede confirmárselo. Consulta de vigilancia:
--     select count(*) from public.notas where tarea_id is null and bloque_horario_id is null;
create table if not exists public.notas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  tarea_id uuid references public.tareas(id) on delete set null,
  bloque_horario_id uuid references public.horario(id) on delete set null,

  titulo text,
  -- `not null default ''`: la UI de notas guardará automáticamente y creará la
  -- fila en cuanto se abra el editor, antes de que haya nada escrito. Un
  -- `check (length > 0)` obligaría al cliente a inventar contenido de relleno.
  contenido text not null default '',

  -- Sincronización con Drive (tramo posterior). Nullable: una nota existe en la
  -- base aunque todavía no se haya volcado a Drive.
  drive_file_id text,
  creado_por text not null default 'usuario' check (creado_por in ('usuario', 'ia')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- num_nonnulls() es una función interna de Postgres (>= 9.4), más legible que
  -- la maraña equivalente de OR/AND.
  constraint notas_ancla_chk check (num_nonnulls(tarea_id, bloque_horario_id) <= 1)
);

create index if not exists notas_user_tarea_idx
  on public.notas (user_id, tarea_id) where tarea_id is not null;
create index if not exists notas_user_bloque_idx
  on public.notas (user_id, bloque_horario_id) where bloque_horario_id is not null;
-- Cubre a la vez la lista general por recencia y el filtro de "sueltas".
create index if not exists notas_user_fecha_idx on public.notas (user_id, updated_at desc);

alter table public.notas enable row level security;
drop policy if exists "propietario_notas" on public.notas;
create policy "propietario_notas" on public.notas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- conversaciones_ia
-- ═══════════════════════════════════════════════════════════════════════════
-- `mensajes` es jsonb y no una tabla `mensajes_ia` aparte: una conversación se
-- lee y se escribe SIEMPRE entera (el overlay de /ai carga todo el historial de
-- turnos de una vez). Precedente en el repo: `memoria.content jsonb`.
--
-- ⚠️ Sin límite de tamaño en la base — a propósito, porque el tope correcto es
-- una decisión de producto, no de esquema. El endpoint que escriba (tramo
-- posterior) DEBE recortar a los últimos ~50 turnos: una conversación sin tope
-- acabaría siendo una fila de megabytes que se lee entera en cada apertura. Si
-- eso llega a apretar, la salida es una tabla `mensajes_ia` con FK acá — por eso
-- `mensajes` es UNA columna y no un montón de columnas sueltas.
create table if not exists public.conversaciones_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Forma esperada: [{ rol: 'usuario'|'ia', texto: string, en: ISO }]
  mensajes jsonb not null default '[]'::jsonb,

  -- RESUMEN: nullable, y NUNCA se genera en el camino crítico.
  --
  -- Generarlo al enviar cada mensaje metería la latencia de una llamada al
  -- modelo dentro de cada turno de conversación — exactamente lo que el
  -- proyecto ya evita en resolverIcono y resolverCamposExamen. Se genera cuando
  -- la conversación se "asienta" (al cerrar el overlay, o de forma perezosa al
  -- abrir el historial), solo para las que cumplan:
  --     resumen is null and resumen_intentos < 3 and jsonb_array_length(mensajes) >= 4
  -- El mínimo de 4 turnos evita gastar una llamada en resumir un "hola".
  --
  -- Si el modelo falla, la conversación se guarda IGUAL, sin resumen: `null`
  -- significa literalmente "todavía no hay resumen" y la UI cae a las primeras
  -- palabras del primer mensaje. Un resumen ausente nunca degrada nada — es
  -- adorno, no dato.
  resumen text,
  resumen_generado_en timestamptz,
  -- Corta el reintento infinito: una conversación cuyo resumen falla siempre
  -- (contenido que el modelo rechaza, tamaño excesivo) no puede quedar gastando
  -- tokens en cada apertura del historial.
  resumen_intentos smallint not null default 0 check (resumen_intentos >= 0),

  drive_file_id text,
  archivada boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint conversaciones_ia_mensajes_chk check (jsonb_typeof(mensajes) = 'array')
);

-- Ruta caliente: "tus conversaciones", recientes primero, sin las archivadas.
create index if not exists conversaciones_ia_user_fecha_idx
  on public.conversaciones_ia (user_id, updated_at desc) where not archivada;

alter table public.conversaciones_ia enable row level security;
drop policy if exists "propietario_conversaciones_ia" on public.conversaciones_ia;
create policy "propietario_conversaciones_ia" on public.conversaciones_ia
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Nota sobre grants: las tres heredan el `alter default privileges` de
-- 20260801000000 (sin INSERT/UPDATE/DELETE para anon/authenticated, con SELECT).
-- No se revoca SELECT como en integraciones_externas: estas tablas contienen
-- datos del propio usuario protegidos por RLS, no credenciales.
