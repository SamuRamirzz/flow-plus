-- Sprint Archivos / Subcarpetas reales por materia — una sola columna nueva,
-- ninguna otra tabla se toca.
--
-- `materias.drive_folder_id`: el id de la subcarpeta REAL de Google Drive que
-- corresponde a esta materia, dentro de la carpeta raíz "Flow+".
--
-- Hasta ahora todo archivo se subía a la raíz "Flow+" y la agrupación por
-- materia del sidebar era puramente derivada de `archivos.materia_id` — una
-- organización que solo existía dentro de Flow+, invisible para quien abriera
-- su Drive. Esta columna es lo que convierte esa agrupación en carpetas de
-- verdad.
--
-- ── Por qué una columna de caché y no buscar por nombre cada vez ──────────
-- `asegurarSubcarpeta()` (Fase 4.1, usada para "Notas") busca por nombre en
-- Drive en cada llamada y documenta explícitamente que no cachea porque su
-- frecuencia es baja: una sola carpeta para todo el usuario. Acá el perfil de
-- uso es el opuesto — una carpeta POR MATERIA (17 en la cuenta real de
-- prueba), consultada en cada subida de archivo y en cada cambio de materia
-- de una tarea. Sin caché, cada subida pagaría una búsqueda extra contra la
-- API de Drive; con caché, es una lectura de Postgres que ya se está
-- haciendo de todos modos para validar la materia.
--
-- Nullable y sin default: `null` significa "esta materia todavía no tiene
-- carpeta en Drive", que es el estado correcto y esperado para las 17
-- materias que ya existen y para cualquier materia nueva. La carpeta se crea
-- perezosamente, la primera vez que se sube un archivo de esa materia — no
-- tiene sentido llenar el Drive del usuario con 17 carpetas vacías por si
-- acaso.
--
-- No lleva índice único sobre (user_id, drive_folder_id), a diferencia de
-- `archivos`/`notas`: ahí el id identifica un objeto que la app crea una vez
-- y no debe duplicarse. Acá, que dos materias apuntaran a la misma carpeta
-- sería raro pero no corrupto (un usuario puede fusionar materias, y
-- `POST /api/materias/fusionar` no toca Drive) — una restricción de unicidad
-- convertiría ese caso benigno en un error de escritura.
alter table public.materias add column if not exists drive_folder_id text;

comment on column public.materias.drive_folder_id is
  'Id de la subcarpeta de Google Drive de esta materia, dentro de la carpeta raíz Flow+. Null = todavía no se creó (se crea al subir el primer archivo de la materia).';
