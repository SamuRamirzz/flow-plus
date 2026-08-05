# Comprobaciones previas — `20260808000100_realtime_tareas_horario_materias.sql`

Riesgo **bajo**: agrega tablas a una publicación lógica existente. No cambia
columnas, políticas ni permisos. El único efecto observable es que los
cambios en estas 3 tablas empiezan a transmitirse por el stream de
Realtime — nadie puede leerlos sin una sesión válida que pase el `filter`
de `useRealtimeSync` (`user_id=eq.<uid>`), y RLS (ya aplicada) es la
segunda capa.

Todo lo de esta sección es de solo lectura.

## Vía rápida

```sql
select schemaname, tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename in ('tareas', 'horario', 'materias');
```

Esperado: 0 filas (ninguna de las 3 está habilitada todavía).

## Después de aplicar

```sql
select schemaname, tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename in ('tareas', 'horario', 'materias')
order by tablename;
```

Esperado: 3 filas (`horario`, `materias`, `tareas`).

## Cómo revertir

```sql
alter publication supabase_realtime drop table public.tareas, public.horario, public.materias;
```

Sin pérdida de datos — solo deja de transmitirse el stream de cambios,
las tablas y sus filas no se tocan.
