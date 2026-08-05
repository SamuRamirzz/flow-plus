# Comprobaciones previas — antes de aplicar `20260809000000_integraciones_externas.sql`

Riesgo **bajo**: crea una tabla nueva y no toca ninguna existente. Nada de lo
que hace puede fallar por datos previos — la tabla nace vacía, así que la FK a
`auth.users` se valida sin filas que revisar. Lo único no idempotente sería
`create policy`, y por eso lleva `drop policy if exists` delante.

**Estado: verificado contra la base en vivo el 2026-08-05, antes de escribir la
migración** (no solo contra los archivos locales).

---

## Bloqueo previo — 3 variables de entorno, NO-SQL

La migración se puede aplicar sin ellas, pero la feature no funciona: cada login
registraría un `console.error` y no guardaría token (el usuario entra igual, por
diseño). Conviene tenerlas antes para poder verificar de una.

| Variable | De dónde sale |
|---|---|
| `INTEGRACIONES_CIFRADO_CLAVE` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `GOOGLE_CLIENT_ID` | El cliente OAuth **ya existente** en Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Idem — no crear uno nuevo: un refresh token solo es canjeable por el cliente que lo emitió |

Las tres, server-only (sin `NEXT_PUBLIC_`), **en `.env.local` Y en Vercel con el
mismo valor**. Si difieren, los tokens guardados con una clave no se podrán
descifrar con la otra — el error será `CLAVE_DESCONOCIDA` con ambos kids en el
mensaje, no un fallo silencioso.

También: confirmar en Google Cloud que la pantalla de consentimiento está **"In
production"**, no "Testing". En Testing los refresh tokens de Google caducan a
los 7 días, lo que se vería como "todos los usuarios revocaron el acceso" cada
semana y parecería un bug propio.

---

## Vía rápida — ¿ya está aplicada?

```sql
select to_regclass('public.integraciones_externas') as tabla;
```

- **`null`** → no aplicada, seguir.
- **Un nombre** → ya está; avisar antes de reaplicar.

*Verificado 2026-08-05: `null`.*

---

## Estado de partida

```sql
-- La FK a auth.users necesita que la tabla exista y tenga usuarios reales.
select count(*)::int as usuarios from auth.users;

-- Confirma que el revoke por defecto de 20260801000000 sigue vigente, y por
-- tanto que esta tabla NACERÍA con SELECT abierto si no se revocara aparte.
select defaclacl::text from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
 where n.nspname = 'public' and d.defaclobjtype = 'r';
```

*Verificado 2026-08-05: 4 usuarios. Privilegios por defecto `anon=rxtm`,
`authenticated=rxtm` — `r` (SELECT) presente, sin `a`/`w`/`d`. Confirma que el
`revoke select` explícito de la migración es necesario, no decorativo.*

---

## Después de aplicar

```sql
-- 1) Columnas: esperado 17
select count(*)::int as columnas from information_schema.columns
 where table_schema='public' and table_name='integraciones_externas';

-- 2) RLS activa y una sola política ALL
select rowsecurity from pg_tables
 where schemaname='public' and tablename='integraciones_externas';           -- esperado: true
select policyname, cmd from pg_policies
 where schemaname='public' and tablename='integraciones_externas';           -- esperado: propietario_integraciones_externas | ALL

-- 3) LA COMPROBACIÓN QUE MÁS IMPORTA: el navegador no puede leerla
select has_table_privilege('authenticated','public.integraciones_externas','select') as auth_select,
       has_table_privilege('anon','public.integraciones_externas','select')          as anon_select,
       has_table_privilege('authenticated','public.integraciones_externas','insert') as auth_insert;
-- esperado: false | false | false

-- 4) Los dos check constraints y el índice único
select conname from pg_constraint
 where conname in ('integraciones_externas_estado_chk','integraciones_externas_kid_chk');
select indexname from pg_indexes
 where schemaname='public' and indexname='integraciones_externas_user_proveedor_uniq';
```

---

## Prueba funcional (la que de verdad importa)

| Paso | Qué comprobar |
|---|---|
| Login real con Google en local | El usuario entra normal, y aparece 1 fila en `integraciones_externas` |
| `select refresh_token_cifrado from integraciones_externas` | Empieza por `v1.` y **no** se parece a un token (`1//0…`). Si se ve texto plano, PARAR. |
| `select refresh_token_kid …` | Coincide con el kid que `[cifrado]` logueó al arrancar |
| **Borrar `INTEGRACIONES_CIFRADO_CLAVE` y volver a entrar** | El login **sigue funcionando** (solo un `console.error`). Ésta es la prueba de la degradación limpia — el archivo tocado es `app/auth/callback/route.ts`, que acaba de tener un bug de ruteo en producción. |
| Login con **magic link** | NO crea fila, y eso es correcto: solo Google trae tokens de Drive |

---

## Cómo revertir

```sql
drop table if exists public.integraciones_externas;
```

Arrastra el índice, las políticas y los constraints. Pérdida: las vinculaciones
de Drive existentes. **Recuperable sin intervención**: como `app/login/page.tsx`
manda `prompt: 'consent'` en cada login, el siguiente inicio de sesión de cada
usuario vuelve a traer un `provider_refresh_token` nuevo y la fila se recrea
sola. No queda estado corrupto que limpiar.

El código puede quedarse desplegado tras revertir: `guardarVinculacionGoogle()`
atrapa cualquier error y solo registra `console.error`, así que un upsert contra
una tabla inexistente no rompe el login.
