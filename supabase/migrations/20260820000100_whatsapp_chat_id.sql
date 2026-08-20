-- Sprint 2/3 (corrección) — identificar al remitente por su CHAT ID, no solo
-- por su número de teléfono.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUÉ: WhatsApp ya no siempre revela el número del remitente
-- ─────────────────────────────────────────────────────────────────────────
-- Verificado contra el canal real, no asumido: los mensajes entrantes llegan
-- con `from`/`chat_id` en UNO de dos formatos:
--
--     573170180062@s.whatsapp.net   ← número real
--     156126641426469@lid           ← identificador de privacidad (LID)
--
-- Un `@lid` NO contiene un número de teléfono: sus dígitos son un id opaco.
-- Se comprobó contra la API de Whapi que tampoco se puede resolver —
-- `GET /contacts/156126641426469@lid` responde 200 pero solo devuelve
-- `{pushname, phonebook:false, saved:false, id}`, sin teléfono alguno.
--
-- Consecuencia: emparejar al remitente contra `whatsapp_numero` (un teléfono
-- en E.164) es imposible para cualquiera que llegue como LID, por muy bien
-- que haya completado la vinculación en la app. Por eso hace falta guardar
-- el identificador REAL con el que esa persona escribe.
--
-- `whatsapp_numero` NO se elimina ni se sustituye: sigue siendo lo que se
-- muestra en Ajustes y el destino de las notificaciones salientes (Parte F),
-- que sí se envían a un teléfono. Son dos cosas distintas y ahora se guardan
-- por separado:
--     · whatsapp_numero   → a quién le ESCRIBIMOS nosotros
--     · whatsapp_chat_id  → con qué identidad nos ESCRIBE esa persona
alter table public.perfil_academico
  add column if not exists whatsapp_chat_id text;

-- Mismo criterio que el índice único de `whatsapp_numero`: un chat no puede
-- estar vinculado a dos cuentas, porque el webhook identifica al usuario POR
-- este valor y un duplicado ejecutaría comandos contra la cuenta equivocada.
-- Parcial, para no bloquear a quienes lo tienen en null.
create unique index if not exists perfil_academico_whatsapp_chat_id_uniq
  on public.perfil_academico (whatsapp_chat_id)
  where whatsapp_chat_id is not null;
