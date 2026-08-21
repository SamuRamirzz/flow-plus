-- Tope de uso por acción costosa (rate limiting).
--
-- Origen: auditoría de seguridad del 2026-08-22. Hallazgo: 7 endpoints que
-- cuestan dinero real (cada llamada a Gemini se factura) o que consumen un
-- recurso COMPARTIDO entre todos los usuarios (el número de WhatsApp del
-- canal) no tenían ningún tope. Una sesión autenticada podía llamarlos en
-- bucle: en el peor caso de coste, una factura de IA arbitraria; en el peor
-- caso de disponibilidad, que WhatsApp marque como spam el único número del
-- canal y lo rompa para TODOS los usuarios, no solo para quien abusó.
--
-- ─────────────────────────────────────────────────────────────────────────
-- Por qué una tabla y no Redis / un contador en memoria
-- ─────────────────────────────────────────────────────────────────────────
-- En serverless (Vercel) no hay proceso persistente: un contador en memoria
-- se reinicia con cada invocación en frío y vive por instancia, así que no
-- limita nada real. Redis resolvería esto, pero es infraestructura nueva que
-- mantener para un volumen que hoy no lo justifica. Contar filas en una
-- ventana es exactamente el patrón que este proyecto YA usa dos veces y que
-- ya se verificó en producción (webhook de WhatsApp sobre
-- whatsapp_comandos_log, y /vincular sobre whatsapp_codigos_verificacion).
-- Esta tabla generaliza ese patrón en vez de inventar un tercero.
--
-- Los dos topes que ya existían NO se migran ni se tocan: siguen contando
-- sobre sus propias tablas, que además guardan datos con valor propio
-- (el log de comandos, los códigos). Esta tabla es solo un contador.
create table if not exists public.limites_uso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  accion text not null,
  creado_en timestamptz not null default now()
);

-- El índice cubre exactamente la consulta del limitador
-- (where user_id = ? and accion = ? and creado_en >= ?), en ese orden.
create index if not exists limites_uso_ventana_idx
  on public.limites_uso (user_id, accion, creado_en desc);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS activa y CERO políticas — deny-all deliberado
-- ─────────────────────────────────────────────────────────────────────────
-- Mismo criterio que whatsapp_codigos_verificacion: solo el servidor
-- (service_role, que salta RLS) escribe y lee acá. Un usuario no tiene por
-- qué poder leer su propio contador —le diría exactamente cuánto le queda
-- para el siguiente tope— y mucho menos borrarlo, que sería anular el
-- límite entero. RLS ON sin ninguna política = nadie más pasa.
alter table public.limites_uso enable row level security;

-- El SELECT heredado por defecto (anon/authenticated reciben `rxtm` en toda
-- tabla nueva de public) se revoca explícitamente: la revocación de
-- 20260801000000 quitó las escrituras pero dejó la lectura, y acá tampoco
-- la queremos. Con RLS sin políticas ya no leerían filas, pero revocar el
-- GRANT lo cierra una capa antes, igual que en las otras dos tablas
-- sensibles del proyecto.
revoke all on public.limites_uso from anon, authenticated;
