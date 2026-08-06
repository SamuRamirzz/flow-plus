# Comprobaciones previas — antes de aplicar `20260809000400_analisis_ia_archivos.sql`

Riesgo **bajo**: agrega 7 columnas nullables a `archivos` (una con default 0),
3 constraints, 2 índices parciales, y una columna nullable con FK a
`conversaciones_ia`. Ninguna columna existente se modifica, ningún dato se
reescribe.

---

## Vía rápida — ¿ya está aplicada?

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='archivos'
   and column_name in ('resumen_ia','tipo_documento','tareas_detectadas','analizado_en','analisis_error','analisis_intentos','ultima_apertura_en');
```

- **0 filas** → no aplicada, seguir.
- **7 filas** → ya aplicada; avisar antes de reaplicar.

---

## Estado de partida

```sql
-- La FK nueva apunta a archivos(id): la tabla tiene que existir.
select to_regclass('public.archivos') as archivos,
       to_regclass('public.conversaciones_ia') as conversaciones_ia;

-- Cuántas filas se verán afectadas (todas quedan con las columnas nuevas en
-- null / 0, que es el estado correcto de "nunca analizado").
select count(*)::int as archivos_existentes from public.archivos;
```

---

## Después de aplicar

```sql
-- 1) Las 7 columnas nuevas en archivos
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema='public' and table_name='archivos'
   and column_name in ('resumen_ia','tipo_documento','tareas_detectadas','analizado_en','analisis_error','analisis_intentos','ultima_apertura_en')
 order by column_name;
-- esperado: 7 filas; todas is_nullable='YES' salvo analisis_intentos ('NO', default 0)

-- 2) Los 3 constraints
select conname from pg_constraint
 where conname in ('archivos_analisis_intentos_chk','archivos_tipo_documento_chk','archivos_tareas_detectadas_chk');
-- esperado: los 3

-- 3) archivo_id en conversaciones_ia, con su FK
select column_name, is_nullable from information_schema.columns
 where table_schema='public' and table_name='conversaciones_ia' and column_name='archivo_id';
-- esperado: 1 fila, is_nullable='YES'

select confdeltype from pg_constraint
 where conrelid='public.conversaciones_ia'::regclass and confrelid='public.archivos'::regclass;
-- esperado: 'c' (CASCADE) — ver la migración para por qué cascade y no set null

-- 4) Los 2 índices parciales
select indexname from pg_indexes
 where schemaname='public' and indexname in ('archivos_user_analizado_idx','conversaciones_ia_archivo_idx');
-- esperado: los 2
```

## Prueba funcional del constraint que más criterio encierra

```sql
-- Debe FALLAR (tipo_documento fuera del enum cerrado):
update public.archivos set tipo_documento = 'inventado' where id = (select id from public.archivos limit 1);
-- esperado: ERROR ... viola la restricción «archivos_tipo_documento_chk»

-- Debe FUNCIONAR (null = "todavía no analizado", estado normal):
update public.archivos set tipo_documento = null where id = (select id from public.archivos limit 1);
```

---

## Cómo revertir

```sql
drop index if exists public.conversaciones_ia_archivo_idx;
alter table public.conversaciones_ia drop column if exists archivo_id;

drop index if exists public.archivos_user_analizado_idx;
alter table public.archivos
  drop constraint if exists archivos_tareas_detectadas_chk,
  drop constraint if exists archivos_tipo_documento_chk,
  drop constraint if exists archivos_analisis_intentos_chk;
alter table public.archivos
  drop column if exists resumen_ia,
  drop column if exists tipo_documento,
  drop column if exists tareas_detectadas,
  drop column if exists analizado_en,
  drop column if exists analisis_error,
  drop column if exists analisis_intentos,
  drop column if exists ultima_apertura_en;
```

Pérdida al revertir: los análisis de IA ya generados (resúmenes, tareas
detectadas) y las conversaciones atadas a un archivo. Los archivos en sí
(Drive + fila) quedan intactos — el análisis es derivado, se puede volver a
generar llamando de nuevo a `POST /api/archivos/[id]/analizar`.
