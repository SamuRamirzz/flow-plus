-- Sprint 2/3 — WhatsApp vía Twilio: vinculación de número + log de comandos.
--
-- ⚠️ CORRECCIÓN AL ENCARGO (cuarta vez que aparece este error en este
-- proyecto): el encargo escribe `alter table public.perfiles`. Esa tabla
-- NO EXISTE — verificado contra el repo (cero referencias a `perfiles` en
-- todo el código) y contra el historial de migraciones. La tabla real es
-- `perfil_academico`, que es la que el Sprint Auth eligió extender en vez
-- de crear una tabla de perfiles aparte (ver 20260803000000). Aplicar el
-- DDL del encargo tal cual habría fallado con "relation does not exist".
--
-- Se mantiene la MISMA disciplina que el resto de columnas de preferencia
-- de este proyecto (formato_reloj, max_notif_por_dia, zona_horaria): viven
-- en perfil_academico, no en una tabla nueva.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Vinculación del número
-- ═══════════════════════════════════════════════════════════════════════
-- `whatsapp_numero` en E.164 (+573001234567). Nullable: la inmensa mayoría
-- de usuarios no vincula WhatsApp, y un default vacío no significaría nada
-- distinto de null.
--
-- `whatsapp_verificado` separado del número (y no un único "numero validado
-- o null") porque son dos estados distintos que la UI muestra distinto:
-- "escribiste un número pero todavía no confirmaste el código" no es lo
-- mismo que "no tienes número". Mismo criterio que `analizado_en` vs
-- `analisis_error` en `archivos`.
--
-- `whatsapp_notificaciones` es NUEVA respecto al encargo, pero la Parte F
-- la da por hecha ("cuando el usuario lo tenga habilitado en preferencias")
-- sin declararla en el esquema — sin esta columna, la Parte F no tendría
-- dónde leer esa preferencia. Default `false`: vincular un número no debe
-- activar por sí solo el envío de notificaciones, eso es una segunda
-- decisión explícita del usuario.
alter table public.perfil_academico
  add column if not exists whatsapp_numero text,
  add column if not exists whatsapp_verificado boolean not null default false,
  add column if not exists whatsapp_notificaciones boolean not null default false;

-- Un mismo número de WhatsApp no puede quedar vinculado a dos cuentas: el
-- webhook identifica al usuario POR el número entrante, así que un
-- duplicado haría ambiguo a quién pertenece un comando — y ejecutar la
-- acción contra la cuenta equivocada sería una fuga de datos entre
-- usuarios. Índice único PARCIAL (solo sobre verificados y no nulos): dos
-- usuarios pueden estar a mitad de verificar el mismo número sin bloquearse
-- entre sí; solo el que confirme primero se lo queda.
create unique index if not exists perfil_academico_whatsapp_numero_uniq
  on public.perfil_academico (whatsapp_numero)
  where whatsapp_numero is not null and whatsapp_verificado;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Códigos de verificación
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.whatsapp_codigos_verificacion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  numero text not null,
  codigo text not null,
  expira_en timestamptz not null,
  usado boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists whatsapp_codigos_user_idx
  on public.whatsapp_codigos_verificacion (user_id, creado_en desc);

alter table public.whatsapp_codigos_verificacion enable row level security;

-- Sin política de SELECT para el usuario, a propósito y a diferencia del
-- resto de tablas de este proyecto: el código de verificación es una
-- credencial de un solo uso. Solo el servidor (service_role, que salta RLS)
-- lo escribe y lo compara; el cliente nunca necesita leerlo — lo recibe por
-- WhatsApp, que es justamente lo que prueba que controla el número. Una
-- política de lectura permitiría a una sesión ya autenticada leer el código
-- sin tener acceso al teléfono, anulando la verificación entera.
-- Mismo criterio que `integraciones_externas`, que lleva un revoke extra
-- por guardar credenciales.
revoke select on public.whatsapp_codigos_verificacion from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Log de comandos
-- ═══════════════════════════════════════════════════════════════════════
-- `on delete set null` en user_id (no cascade): el log sirve para
-- diagnosticar, incluido el caso de un mensaje de un número que NO
-- corresponde a ningún usuario (user_id null desde el principio) — que es
-- justo uno de los casos que hay que poder investigar.
create table if not exists public.whatsapp_comandos_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  numero_origen text not null,
  mensaje_crudo text not null,
  comando_detectado text,
  resultado text not null check (resultado in ('ejecutado', 'error', 'no_reconocido')),
  detalle_error text,
  creado_en timestamptz not null default now()
);

create index if not exists whatsapp_comandos_log_user_idx
  on public.whatsapp_comandos_log (user_id, creado_en desc);

alter table public.whatsapp_comandos_log enable row level security;

drop policy if exists "propietario_whatsapp_comandos_log" on public.whatsapp_comandos_log;
create policy "propietario_whatsapp_comandos_log" on public.whatsapp_comandos_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
