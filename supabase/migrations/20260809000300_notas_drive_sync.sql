-- Sprint Archivos / Fase 4.1 — dos adiciones a `notas`, ninguna otra tabla
-- se toca.
--
-- `drive_sync_error`: mismo criterio de nombre que
-- `integraciones_externas.ultimo_error` — marca cuándo el reflejo de una
-- nota en Google Drive falló, para poder reconciliar después. Nullable:
-- `null` significa "sin error conocido" (puede ser que nunca se intentó
-- sincronizar, o que la última sincronización tuvo éxito).
--
-- Índice único parcial sobre (user_id, drive_file_id): `archivos` ya tiene
-- el equivalente (`archivos_user_drive_uniq`, Fase 1); `notas` se quedó sin
-- él por descuido de esa misma migración — hallazgo real de la revisión de
-- este tramo. Sin esto, un doble PATCH concurrente sobre la misma nota
-- (el flujo de edición sube un archivo nuevo y borra el viejo) podría dejar
-- dos filas apuntando al mismo `drive_file_id` sin que nada lo detecte.
alter table public.notas add column if not exists drive_sync_error text;

create unique index if not exists notas_user_drive_uniq
  on public.notas (user_id, drive_file_id) where drive_file_id is not null;
