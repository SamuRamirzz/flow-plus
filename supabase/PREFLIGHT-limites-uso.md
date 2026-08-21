# PREFLIGHT — `20260822000000_limites_uso.sql`

Comprobaciones **de solo lectura** antes de aplicar la migración que crea
`limites_uso` (tope de uso por acción costosa: llamadas a IA y envíos de
WhatsApp).

Origen: auditoría de seguridad del 2026-08-22, hallazgo de rate limiting
ausente en 7 endpoints que cuestan dinero real o consumen un recurso
compartido (el número de WhatsApp del canal).

---

## 1. La tabla no existe todavía

```sql
select count(*) as tablas_limites_uso
from information_schema.tables
where table_schema = 'public' and table_name = 'limites_uso';
```

**Esperado: `0`.** Si devuelve `1`, la migración ya se aplicó — no volver a
correrla sin revisar qué contiene.

## 2. No hay ninguna tabla previa con este propósito (evitar duplicar)

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and (table_name ilike '%limit%' or table_name ilike '%rate%' or table_name ilike '%uso%');
```

**Esperado: 0 filas.** El único tope que existe hoy vive en código
(`app/api/whatsapp/webhook/route.ts` cuenta filas de
`whatsapp_comandos_log`, y `app/api/whatsapp/vincular/route.ts` cuenta
`whatsapp_codigos_verificacion`) — ninguno usa una tabla propia, así que no
hay nada que migrar ni reutilizar.

## 3. Los dos topes que YA existen siguen en pie (no se tocan en esta migración)

```sql
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='whatsapp_comandos_log') as log_comandos,
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='whatsapp_codigos_verificacion') as codigos;
```

**Esperado: `1` y `1`.** Esta migración es aditiva: no reemplaza ni migra
esos dos mecanismos, que siguen funcionando tal cual.

## 4. Estado de los default privileges (confirma que la tabla nueva NO nacerá escribible)

```sql
select pg_get_userbyid(defaclrole) as otorgante, defaclacl::text as acl
from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public' and defaclobjtype = 'r';
```

**Esperado:** incluye `anon=rxtm/postgres` y `authenticated=rxtm/postgres`
— es decir, una tabla nueva hereda `SELECT` pero **no** INSERT/UPDATE/DELETE
(la revocación de `20260801000000` sigue vigente). La migración revoca
además ese `SELECT` heredado, porque el conteo de uso de una cuenta no tiene
por qué ser legible desde el cliente.

---

## Después de aplicar

```sql
-- RLS activa y SIN políticas (deny-all deliberado: solo service_role escribe)
select relrowsecurity from pg_class where relname = 'limites_uso';           -- t
select count(*) from pg_policies
  where schemaname='public' and tablename='limites_uso';                      -- 0

-- Ni anon ni authenticated pueden leer ni escribir
select has_table_privilege('anon','public.limites_uso','select') as anon_select,
       has_table_privilege('authenticated','public.limites_uso','select') as auth_select,
       has_table_privilege('authenticated','public.limites_uso','insert') as auth_insert;
-- esperado: f, f, f

-- El índice de conteo por ventana existe
select indexname from pg_indexes
  where schemaname='public' and tablename='limites_uso';
```
