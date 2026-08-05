-- Sprint Archivos / Fase 0 — persistencia del refresh_token de Google Drive.
--
-- ───────────────────────────────────────────────────────────────────────────
-- POR QUÉ UNA TABLA PROPIA
-- ───────────────────────────────────────────────────────────────────────────
-- La auditoría de Auth (2026-08-08) verificó contra information_schema que
-- `auth.identities` NO tiene ninguna columna donde Supabase guarde los tokens
-- del proveedor, y que Supabase no los persiste ni los refresca por ti. Los
-- tokens llegan UNA sola vez —en la respuesta de exchangeCodeForSession— y
-- hasta ahora app/auth/callback/route.ts descartaba ese `data`, así que se
-- perdían en cada login. Sin esto, Flow+ no puede tocar el Drive del usuario
-- después de que su sesión inicial caduque.
--
-- ───────────────────────────────────────────────────────────────────────────
-- EL TOKEN SE GUARDA CIFRADO POR LA APLICACIÓN, NO CON pgcrypto
-- ───────────────────────────────────────────────────────────────────────────
-- AES-256-GCM desde lib/integraciones/cifrado.ts. Con pgcrypto la clave
-- viajaría en el texto de cada consulta y acabaría en los logs de Postgres y
-- en el request HTTP a PostgREST. Cifrando en la app, el material de clave
-- nunca entra al proceso de la base: un dump de esta tabla sin
-- INTEGRACIONES_CIFRADO_CLAVE no sirve para nada.
--
-- El formato del sobre es `v1.<kid>.<iv>.<tag>.<ciphertext>` y el `kid`
-- (huella de 8 hex de la clave) se guarda además en su propia columna. Eso
-- permite responder "¿qué filas quedan ilegibles si este entorno tiene otra
-- clave?" con un `group by`, SIN descifrar nada:
--     select refresh_token_kid, count(*) from public.integraciones_externas group by 1;
--
-- ⚠️ REQUISITO NO-SQL, BLOQUEANTE: INTEGRACIONES_CIFRADO_CLAVE, GOOGLE_CLIENT_ID
-- y GOOGLE_CLIENT_SECRET deben existir con el MISMO valor en .env.local y en
-- Vercel antes de que esto sirva de algo. Ver PREFLIGHT-integraciones-externas.md.

create table if not exists public.integraciones_externas (
  id uuid primary key default gen_random_uuid(),

  -- FK VALIDADA desde el inicio (a diferencia de perfil_academico_user_id_fkey,
  -- que nació `not valid` porque ya tenía una fila huérfana): esta tabla nace
  -- vacía, así que no hay nada que pueda fallar la validación.
  -- `on delete cascade` no es opcional: si se borra la cuenta, sus credenciales
  -- de Google se van con ella.
  user_id uuid not null references auth.users(id) on delete cascade,

  proveedor text not null default 'google' check (proveedor in ('google')),

  -- ── Credenciales. SIEMPRE sobres de lib/integraciones/cifrado.ts, jamás texto plano.
  --
  -- NULLABLE por el estado "revocada": cuando Google responde invalid_grant se
  -- pone a null y se marca `revocada_en`, en vez de borrar la fila. Borrarla
  -- haría indistinguible "nunca conectó Drive" de "se le cayó la conexión", y
  -- la UI necesita distinguirlos para decir "vuelve a conectar" en vez de
  -- "conectar".
  refresh_token_cifrado text,
  refresh_token_kid text,

  -- Caché del access token (vive ~1h). Sin esto, cada operación de Drive
  -- gastaría un round-trip extra contra oauth2.googleapis.com.
  access_token_cifrado text,
  access_token_expira_en timestamptz,

  -- Los scopes REALMENTE concedidos, tal como los devuelve Google — no los que
  -- se pidieron. El usuario puede desmarcar permisos en la pantalla de
  -- consentimiento y aceptar igual; sin esta columna eso se descubriría con un
  -- 403 en mitad de una subida en vez de al vincular.
  scope text,
  cuenta_email text,

  -- ── Drive. Se llenan en un tramo posterior; se crean ahora (nullable, sin
  -- default problemático, coste cero) para no tener que alterar más adelante una
  -- tabla que ya tendrá datos vivos.
  --
  -- Ojo: la carpeta POR MATERIA no va acá — es un hecho por fila de `materias`,
  -- así que vivirá en su propia columna/tabla con FK. Meterla acá como un jsonb
  -- id→id sería un mapa desnormalizado sin integridad referencial.
  carpeta_raiz_id text,
  carpeta_raiz_nombre text not null default 'Flow+',

  -- ── Observabilidad
  vinculada_en timestamptz not null default now(),
  ultimo_refresco_en timestamptz,
  ultimo_error text,
  revocada_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Una integración ACTIVA siempre tiene con qué refrescar. Sin esta regla, una
  -- fila con refresh_token null y revocada_en null sería un estado imposible de
  -- interpretar (¿a medio escribir? ¿bug?) contra el que habría que defenderse
  -- en cada lectura.
  constraint integraciones_externas_estado_chk
    check (revocada_en is not null or refresh_token_cifrado is not null),

  -- Si hay sobre hay kid, y al revés. Evita filas que no se pueden diagnosticar.
  constraint integraciones_externas_kid_chk
    check ((refresh_token_cifrado is null) = (refresh_token_kid is null))
);

-- Una integración por usuario y proveedor. Además de la invariante, es lo que
-- permite que el callback haga un upsert idempotente con
-- `onConflict: 'user_id,proveedor'`: sin leer primero, y sin condición de
-- carrera si el usuario inicia sesión en dos pestañas a la vez.
create unique index if not exists integraciones_externas_user_proveedor_uniq
  on public.integraciones_externas (user_id, proveedor);

-- ── Row Level Security (patrón `propietario_*` vigente desde 20260804000000)
alter table public.integraciones_externas enable row level security;

drop policy if exists "propietario_integraciones_externas" on public.integraciones_externas;
create policy "propietario_integraciones_externas" on public.integraciones_externas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ⚠️ REVOCACIÓN EXTRA DE SELECT — imprescindible acá, y solo acá.
--
-- 20260801000000 revocó INSERT/UPDATE/DELETE por defecto a las tablas futuras
-- pero DEJÓ SELECT a propósito (hay 4 lecturas legítimas que salen del
-- navegador con la clave anónima). Verificado contra la base antes de escribir
-- esto: los default privileges de `public` son hoy `anon=rxtm` /
-- `authenticated=rxtm` — o sea que esta tabla NACERÍA con SELECT abierto.
--
-- Esta tabla no es como las demás: nada del navegador debe poder leerla, ni
-- siquiera cifrada. Los sobres no son secretos (sin la clave no se descifran),
-- pero regalar ciphertext + kid + el email de la cuenta de Google a cualquiera
-- con la clave anónima no tiene ninguna contrapartida. Solo el servidor
-- (service_role, que salta RLS) la toca.
revoke select on public.integraciones_externas from anon, authenticated;
