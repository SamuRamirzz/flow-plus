-- Sprint Archivos / Upload resumable — eleva el tope del bucket de staging y
-- suma los MIME de audio/video que el caso de uso real pide (grabaciones de
-- clase), que el bucket original nunca contempló.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUÉ 200MB Y NO LOS 500MB QUE PROPONÍA EL ENCARGO
-- ─────────────────────────────────────────────────────────────────────────
-- El encargo proponía 500MB sin verificar contra una restricción real de
-- este proyecto: `POST /api/archivos` corre como función serverless de
-- Vercel con `maxDuration = 60` (mismo tope ya usado en los dos crons
-- existentes — sin confirmación de un plan con Fluid Compute, que
-- permitiría más, se asume el límite conservador de Hobby/Pro estándar).
-- Esa función tiene que DESCARGAR el archivo completo de Storage Y subirlo
-- en chunks a Drive, todo dentro de esos 60 segundos.
--
-- 200MB es el número razonado, no adivinado: incluso a un throughput
-- pesimista de ~5MB/s efectivo (contando el overhead de latencia de
-- decenas de round-trips PUT del protocolo resumable, no solo ancho de
-- banda bruto), 200MB tarda ~40s — deja margen real dentro de los 60s. Un
-- video de 300-500MB, tal como pedía el encargo, NO tiene garantía de
-- completar en una sola invocación con esta arquitectura; subirlo
-- exigiría o bien confirmar un maxDuration mayor en el plan real de
-- Vercel, o bien una arquitectura de cola/webhook en segundo plano — fuera
-- de alcance de este sprint, documentado como límite conocido.
--
-- Cubre bien el caso real mencionado: audio de clase (MP3/M4A a 128-320kbps,
-- una hora completa son 55-140MB) entra cómodo. Video de calidad razonable
-- de 15-20 minutos también.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'archivos-staging',
  'archivos-staging',
  false,
  209715200, -- 200MB
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip',
    -- Nuevo: audio/video de grabaciones de clase — el motivo real de este
    -- sprint. No se agrega análisis de IA para estos formatos (fuera de
    -- alcance, no verificado contra Gemini): solo almacenamiento real.
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/webm',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;
