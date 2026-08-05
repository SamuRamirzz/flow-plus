-- Sección Ajustes — preferencia de formato de reloj (12h/24h), aplicada
-- consistentemente en toda la UI donde se muestra una hora de reloj
-- (lib/hora.ts::formatearHora). Mismo idiom que 20260802000000_campos_examen.sql
-- para agregar un constraint sobre una tabla EXISTENTE: Postgres no soporta
-- `ADD CONSTRAINT IF NOT EXISTS`, así que el check va en un bloque
-- idempotente aparte, no en la misma cláusula que el ADD COLUMN.

alter table public.perfil_academico
  add column if not exists formato_reloj text not null default '24h';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfil_academico_formato_reloj_chk') then
    alter table public.perfil_academico add constraint perfil_academico_formato_reloj_chk
      check (formato_reloj in ('12h', '24h'));
  end if;
end $$;

comment on column public.perfil_academico.formato_reloj is
  'Preferencia de formato de reloj para toda la UI. Default 24h (mismo criterio que zona_horaria: un valor razonable sin forzar al usuario a configurar nada al entrar).';
