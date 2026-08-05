# Comprobaciones previas — antes de aplicar `20260804000000_rls_propietario.sql`

⚠️ **La migración de mayor riesgo del sprint.** Cambia quién puede leer qué.

Con el procedimiento simplificado (limpieza total en vez de reasignación), el
riesgo cambió de forma: ya no hay datos que "desaparecer" — se limpiaron a
propósito en el paso 1. Lo que esta migración exige es que ya exista un
usuario real registrado (paso 4) antes de cerrar el acceso; aplicarla sin eso
dejaría la app sin nadie que pueda leer nada, ni siquiera el dueño.

**No aplicar sin haber completado los pasos 0-4 de
[`PROCEDIMIENTO-migracion-usuario.md`](PROCEDIMIENTO-migracion-usuario.md).**

---

## Bloqueo previo — las 3 condiciones que TIENEN que cumplirse

```sql
-- 1. Existe al menos un usuario real registrado.
select count(*)::int as usuarios from auth.users;
--    Esperado: >= 1.  Si es 0, PARAR: nadie podría leer nada después.

-- 2. NO queda ninguna fila bajo USUARIO_SIN_AUTH.
select 'materias' t, count(*) from public.materias where user_id='00000000-0000-0000-0000-000000000001'
union all select 'tareas', count(*) from public.tareas where user_id='00000000-0000-0000-0000-000000000001'
union all select 'horario', count(*) from public.horario where user_id='00000000-0000-0000-0000-000000000001'
union all select 'memoria', count(*) from public.memoria where user_id='00000000-0000-0000-0000-000000000001'
union all select 'perfil', count(*) from public.perfil_academico where user_id='00000000-0000-0000-0000-000000000001'
union all select 'notif', count(*) from public.notificaciones_enviadas where user_id='00000000-0000-0000-0000-000000000001';
--    Esperado: TODOS en 0.  Si alguno no lo está, el paso 1 (limpieza) del
--    procedimiento no se completó — PARAR y volver ahí.

-- 3. La FK de la Fase 1 ya está validada (prueba de que el paso 3 terminó bien).
select convalidated from pg_constraint
where conrelid='public.perfil_academico'::regclass and conname='perfil_academico_user_id_fkey';
--    Esperado: true.  Si es false, el paso 3 no llegó al final.
```

Si cualquiera de las 3 falla, **no aplicar**.

---

## Estado de partida

```sql
select schemaname, tablename, policyname, qual
from pg_policies where schemaname in ('public','storage')
order by tablename, policyname;
```

Esperado antes de aplicar: 7 políticas `temporal_sin_auth_*` en `public` (todas
con `qual = true`) y 6 en `storage.objects` (que solo comprueban `bucket_id`).

---

## Después de aplicar

```sql
-- Ninguna política permisiva debe sobrevivir.
select count(*)::int as permisivas from pg_policies
where schemaname in ('public','storage')
  and (policyname like 'temporal_sin_auth%' or qual = 'true');
```

Esperado: **0**.

```sql
-- Las 7 nuevas de public, todas con el predicado real.
select tablename, policyname, qual from pg_policies
where schemaname='public' and policyname like 'propietario%' order by tablename;
```

Esperado: 7 filas, todas con `(auth.uid() = user_id)`.

```sql
-- Las 6 de storage, ahora sí comprobando la carpeta del usuario.
select policyname, cmd, coalesce(qual, with_check) as predicado
from pg_policies where schemaname='storage' order by policyname;
```

Esperado: 6 filas, todas con `storage.foldername(name))[1] = (auth.uid())::text`
además del `bucket_id`.

## Prueba funcional (la que de verdad importa)

Con sesión iniciada en el navegador:

| Pantalla | Qué comprobar |
|---|---|
| `/` | Las materias y tareas cargan (no vacío) |
| `/horario` | La grilla carga |
| `/ai` | El panel de tareas carga |
| Crear una tarea | Se guarda (esto va por service_role, debería ser inmune) |
| Subir una foto en `/horario` | Sube y la IA la lee (política de storage nueva) |

Y la prueba negativa, que es la razón de ser de todo esto:

```sql
-- Simular otro usuario: con RLS activa, no debería ver nada del primero.
-- (Correr desde el navegador con una segunda cuenta, no desde DATABASE_URL,
--  que salta RLS por ser superusuario.)
```

Concretamente: registrar una segunda cuenta y confirmar que `/` aparece
**vacía** para ella. Si ve las tareas de Samuel, la migración no funcionó y hay
que revertir de inmediato.

---

## Cómo revertir

```sql
-- Vuelve al estado permisivo anterior (solo si algo salió mal).
drop policy if exists "propietario_materias" on public.materias;
create policy "temporal_sin_auth_materias" on public.materias for all using (true) with check (true);
-- ... ídem para tareas, horario, memoria, notificaciones_enviadas,
--     perfil_academico, ai_events.

drop policy if exists "propietario_horarios_select" on storage.objects;
drop policy if exists "propietario_horarios_insert" on storage.objects;
drop policy if exists "propietario_horarios_delete" on storage.objects;
create policy "temporal_sin_auth_horarios_select" on storage.objects for select using (bucket_id='horarios');
create policy "temporal_sin_auth_horarios_insert" on storage.objects for insert with check (bucket_id='horarios');
create policy "temporal_sin_auth_horarios_delete" on storage.objects for delete using (bucket_id='horarios');
-- ... ídem para el bucket `tareas`.
```

Revertir las políticas **no** revierte la migración de datos del paso 3 — para
eso está el respaldo del paso 0.
