# Auditoría de seguridad — Flow+

**Fecha:** 2026-08-22 · **Alcance:** todo el repositorio + la base de datos
de producción real.

## Advertencia de alcance, antes de nada

Esto **no es un pentest**. Es una revisión sistemática de patrones de
vulnerabilidad conocidos (alineados con OWASP Top 10) contra el código y el
esquema reales, con verificación en vivo donde fue posible. No incluye
fuzzing automatizado, análisis de la infraestructura de red, ni revisión de
la seguridad interna de Supabase/Vercel/Google/Whapi como proveedores.

**Ningún sistema real es "100 % seguro" y este reporte no lo afirma en
ningún punto.** Lo que sí puede afirmarse es qué se revisó exactamente, con
qué evidencia, y qué quedó sin cerrar.

---

## Resumen

| Severidad | Encontrados | Corregidos | Documentados sin corregir |
|---|---|---|---|
| Crítica | 0 | — | — |
| Alta | 1 | 1 | 0 |
| Media | 3 | 2 | 1 |
| Baja | 4 | 2 | 2 |

**Cobertura:** 16 tablas, 36 archivos de ruta (46 métodos HTTP), 4 buckets
de Storage, 561 paquetes npm, 33 commits de historial.

---

## A.1 — Row Level Security (16/16 tablas)

**RLS activa en las 16.** Verificado contra `pg_class.relrowsecurity` en la
base real, no contra las migraciones.

13 tablas usan la misma política `propietario_*` de tipo `ALL` con
`auth.uid() = user_id` en `USING` y `WITH CHECK`. Las otras 3
(`whatsapp_codigos_verificacion`, `eliminaciones_cuenta_log`,
`limites_uso`) tienen **RLS activa y cero políticas** — deny-all
deliberado: solo el servidor (`service_role`, que salta RLS) las toca.

Ninguna política usa `USING (true)` ni una condición permisiva por
accidente. Las `temporal_sin_auth_*` que existieron antes del Sprint Auth ya
no están.

### La capa que de verdad bloquea la escritura: los GRANT

La pregunta del encargo A.1.4 —si un usuario puede crearse notificaciones
falsas, dado que la política es `ALL`— se resuelve una capa antes. Verificado
con `has_table_privilege` sobre las 16 tablas × 2 roles × 4 operaciones:

> **Ni `anon` ni `authenticated` tienen INSERT, UPDATE o DELETE en ninguna
> tabla.** Cero excepciones.

Además, `integraciones_externas` (tokens de Google) y
`whatsapp_codigos_verificacion` (credenciales de un solo uso) tienen también
**SELECT revocado** (`acl = xtm`, sin `r`).

### Storage (4 buckets)

`horarios`, `tareas` y `archivos-staging` son privados con políticas por
dueño (`(storage.foldername(name))[1] = auth.uid()::text`). `avatares` es
**público a propósito** (una foto de perfil debe servirse por URL estable),
pero escribir y borrar sigue restringido al dueño por la misma comprobación
de carpeta. Ya está declarado en `/legal/privacidad` §08.

---

## A.2 — Autorización endpoint por endpoint (36/36)

Se listaron los 36 archivos de ruta con el sistema de archivos, no de
memoria. **35 exigen sesión** vía `requerirUsuario()`. Las excepciones son
por diseño y están cubiertas por un secreto compartido:

| Endpoint | Por qué no usa `requerirUsuario()` |
|---|---|
| `cron/recordatorios`, `cron/eliminar-cuentas` | Los invoca Vercel Cron, no un usuario. Guard: `Bearer $CRON_SECRET` |
| `whatsapp/webhook` | Lo invoca Whapi. Guard: secreto en la URL (`?s=`) + `channel_id` |
| `ai/health` | Único endpoint sin ningún guard — ver hallazgo **M-2** |

### IDOR — probado, no razonado

Los 13 endpoints que reciben un id del cliente se probaron **de verdad**:
se creó un segundo usuario desechable con datos reales (materia, tarea,
bloque, nota, notificación, archivo, conversación) y se intentó leer,
modificar y borrar cada recurso **desde la sesión del usuario real**.

```
  ok   GET    /api/archivos/[id]               -> 404
  ok   DELETE /api/archivos/[id]               -> 404
  ok   POST   /api/archivos/[id]/analizar      -> 404
  ok   POST   /api/archivos/[id]/preguntar     -> 404
  ok   PATCH  /api/tareas/[id]                 -> 404
  ok   DELETE /api/tareas/[id]                 -> 404
  ok   PATCH  /api/horario/[id]                -> 404
  !!   DELETE /api/horario/[id]                -> 200   <-- ver B-1
  ok   PATCH  /api/notas/[id]                  -> 404
  ok   DELETE /api/notas/[id]                  -> 404
  ok   PATCH  /api/notificaciones/[id]         -> 404
  ok   DELETE /api/notificaciones/[id]         -> 404
  ok   GET    /api/conversaciones/[id]         -> 404
```

Estado de los datos de la víctima tras los 13 intentos: **todo intacto**.
Ni un dato ajeno leído, modificado ni borrado. El usuario desechable y sus
filas se eliminaron al cerrar (verificado por conteo).

El guard de rutas de Storage (`esRutaDelUsuario`), que corrigió el IDOR
original, **sigue aplicado en los 3 endpoints** que tocan Storage con
`service_role` (`ai/horario`, `ai/tareas`, `archivos`) y tiene 6 tests. Se
confirmó en vivo: un adjunto con prefijo ajeno responde 403.

---

## A.3 — Secretos y cifrado

- **Cero secretos hardcodeados.** Búsqueda por patrones (`sk-`, `AIza`,
  `eyJhbGciOi`, `ghp_`, `xox*-`, `-----BEGIN`) en todo el repo: solo falsos
  positivos (`queue-microtask`, un id de agente, nombres de fuentes TTF).
- **Historial de git limpio.** 33 commits revisados: ningún `.env` fue
  commiteado nunca, `.gitignore` cubre `.env*`, y `.env.local` no está
  trackeado. Búsqueda de claves de API en todos los blobs del historial: sin
  coincidencias. **No hace falta rotar ninguna credencial.**
- **Twilio: limpio.** No existe el SDK en `package.json` ni una sola línea
  de código. Las 3 menciones restantes son comentarios históricos, docs y un
  comentario por defecto de `supabase/config.toml`. No hay variables
  `TWILIO_*` que limpiar porque nunca llegaron a existir.
- **Tokens de Drive cifrados**, como se estableció: `integraciones_externas`
  guarda `refresh_token_cifrado` / `access_token_cifrado` con AES-256-GCM y
  un `kid` derivado, nunca en claro.
- **`SECURITY DEFINER` sin riesgo de escalada.** Solo existe una función
  (`crear_perfil_al_registrarse`) y tiene `SET search_path TO ''` con
  nombres totalmente calificados — el patrón correcto contra el secuestro de
  `search_path`.

---

## A.4 — Inyección y XSS

- **SQL:** todas las consultas pasan por el cliente de Supabase
  (parametrizado). Cero concatenación de SQL crudo en el proyecto.
- **XSS:** búsqueda exhaustiva de `dangerouslySetInnerHTML`, `innerHTML`,
  `eval(`, `new Function(`, `document.write` en todo el repositorio →
  **cero coincidencias**. React escapa por defecto y no hay ninguna vía de
  escape abierta.
- **Prompt injection desde WhatsApp:** el texto entrante del webhook llega
  al mismo pipeline (`procesarMensajeTareas`) que usa `/ai`, con las mismas
  salvaguardas — no hay una ruta paralela con menos protección. Además, el
  canal aplica una autonomía **más restrictiva** que la app: `crear` se
  aplica solo, pero `modificar` y `borrar` nunca se ejecutan sin
  confirmación desde la app, precisamente porque WhatsApp no tiene Deshacer.
- **SVG en avatares:** el bucket `avatares` restringe los MIME a
  `png/jpeg/webp` — `image/svg+xml` está excluido, que es lo que evita un
  SVG con script servido desde un bucket público.

---

## A.5 — Rate limiting → **el hallazgo principal (A-1)**

Estado antes de esta auditoría: **solo 2 de 9 superficies de abuso tenían
tope** (el webhook de WhatsApp y la generación de códigos). Sin tope
quedaban 7 endpoints, y se dividen en dos riesgos distintos:

1. **Coste real en dinero** — 6 endpoints que llaman a Gemini
   (`ai/tareas`, `ai/homework`, `ai/horario`, `archivos/[id]/analizar`,
   `archivos/[id]/preguntar`, `informes/[periodo]`). Una sesión autenticada
   podía llamarlos en bucle y generar una factura arbitraria.
2. **Recurso compartido** — `whatsapp/probar` envía un mensaje real de
   WhatsApp por llamada, sin ningún tope. Este es el peor de los dos: el
   número del canal es **uno solo para todos los usuarios**, así que si
   WhatsApp lo marca como spam, el canal se cae **para todo el mundo**, no
   solo para quien abusó.

### Corrección aplicada y verificada

Tabla `limites_uso` (migración `20260822000000`, PREFLIGHT de 4 checks
corrido y verificación posterior), política pura en `lib/limites/politica.ts`
(9 tests) y helper `lib/server/limites.ts`. Se generaliza el patrón de
conteo por ventana que el proyecto **ya usaba dos veces**, en vez de
inventar un tercero ni introducir Redis para un volumen que no lo justifica.

Verificación en vivo contra HTTP y Postgres reales:

| Comprobación | Resultado |
|---|---|
| Cupo agotado en `ai/tareas` | **429**, mensaje correcto |
| Un rechazo NO consume cupo | conteo se mantiene en 60 |
| Con cupo libre | **200** y exactamente **1** uso registrado |
| Cupo agotado en `whatsapp/probar` | **429 sin enviar ningún mensaje real** |
| Cupos independientes por acción | confirmado |
| Sin sesión | **401** |

**Prueba de que el tope ahorra de verdad** (lo que importa, no que devuelva
429): con la ruta ya caliente, una llamada que llega a Gemini tarda
**6187 ms**; bloqueada por el tope, **372 ms de media** (3 medidas). Corta
antes del modelo, no después.

Las filas se purgan a diario desde el cron ya existente (el plan Hobby de
Vercel solo admite un cron diario, límite ya documentado en el proyecto).

**Login:** no necesita tope propio — lo gestiona Supabase Auth, que aplica
los suyos.

---

## A.6 — Dependencias

`npm audit`: **6 vulnerabilidades altas, 0 críticas** — `brace-expansion`,
`js-yaml`, `nanoid`, `postcss`, `sharp`, y `next` (esta última **solo por
herencia** de postcss y sharp, no un fallo propio).

**Decisión: NO se aplicó el fix, y se documenta el porqué.** No es pereza —
se probó y se revirtió con evidencia:

1. `npm audit fix` sube Next **16.2.11 → 16.3.1** y deja 0 vulnerabilidades.
2. Aplicado, los 1868 tests pasaron, **pero `tsc` falló**: 16.3.1 elimina
   `experimental.viewTransition`, que `next.config.ts` usa. Confirmado que
   la clave no existe en ningún punto del `dist` de 16.3.1 — se promovió a
   estable o cambió de forma.
3. Ese flag habilita la transición **Agenda ⇄ IA**, una animación real de la
   app. Una animación no se verifica con una captura estática — es algo que
   este proyecto ya documentó al no poder medirlas fotograma a fotograma en
   un navegador automatizado.

**Por qué es razonable esperar:** el riesgo real para *esta* app es bajo, y
se comprobó en vez de suponerlo:

- `sharp` solo lo usa Next para optimizar imágenes vía `next/image`, y
  **este proyecto no usa `next/image` en ningún sitio** (las dos únicas
  coincidencias son comentarios explicando por qué se evita). Fuera de la
  ruta de ejecución.
- `postcss` procesa **nuestro propio CSS** en build; las CVE requieren CSS
  o un `sourceMappingURL` controlados por un atacante.
- `brace-expansion`, `js-yaml` y `nanoid` son herramientas de build.

**Recomendación:** subir a Next 16.3.x como su propio cambio acotado,
quitando `experimental.viewTransition` de `next.config.ts` y comprobando a
ojo la transición Agenda ⇄ IA en el navegador. Es trabajo de 20 minutos con
verificación humana, y mezclarlo con una auditoría de seguridad solo hace
más difícil atribuir una regresión.

---

## Hallazgos, uno por uno

### A-1 · ALTA · Sin rate limiting en 7 endpoints costosos — **CORREGIDO**
Detalle y verificación en A.5.

### M-1 · MEDIA · `DELETE /api/horario/[id]` reportaba éxito falso — **CORREGIDO**
Devolvía `200 {"eliminado": true}` para el id de otro usuario.

**No fue una fuga de datos y conviene ser preciso:** el filtro
`.eq('user_id', userId)` sí impedía tocar la fila ajena — se verificó que el
bloque de la víctima quedó intacto. El defecto era que la respuesta mentía:
`borrarBloque` devolvía `ok: true` pasara lo que pasara, porque nunca
comprobaba si el borrado casó con alguna fila. Además dejaba este endpoint
incoherente con el `PATCH` del mismo recurso, que ya devolvía 404.

Corregido con `count: 'exact'` y un 404 cuando no casa nada. Verificado en
las dos direcciones: 404 para un id ajeno/inexistente, y 200 con borrado
real para uno propio, con los 40 bloques reales del usuario intactos.

### M-2 · MEDIA · `/api/ai/health` es público — **DOCUMENTADO, no corregido**
Único endpoint sin guard. Responde a cualquiera con: proveedor de IA en uso
(`gemini`), número de agentes (10), nombres de los scopes de contexto y si
la memoria está conectada. No expone datos de ningún usuario.

Dos motivos para no cerrarlo dentro de esta auditoría: es divulgación de
arquitectura, no de datos, y **un endpoint de salud existe justamente para
poder consultarse desde fuera** — cerrarlo con `CRON_SECRET` es defendible,
pero es una decisión de operación (¿lo usa algún monitor externo?) que no me
corresponde tomar unilateralmente. Efecto secundario menor: cada llamada
comprueba la conexión a la base, así que es un amplificador de carga
pequeño y sin autenticar.

**Recomendación:** reducir la respuesta a `{status:'ok'}` para el público, o
exigir `CRON_SECRET` para el detalle.

### M-3 · MEDIA · Default privileges de `supabase_admin` — **DOCUMENTADO**
Hay dos juegos de default privileges en `public`: el de `postgres` concede
`rxtm` (solo lectura) a `anon`/`authenticated`, pero el de `supabase_admin`
concede **`arwdDxtm` (escritura completa)**.

**Hoy no es explotable:** las 16 tablas son propiedad de `postgres`, así que
aplica el juego restrictivo (verificado tabla por tabla con `relacl`). Es un
riesgo **latente**: una tabla creada desde el editor SQL del panel de
Supabase (que puede correr como `supabase_admin`) nacería con escritura
abierta para cualquier usuario autenticado.

**Recomendación:** crear tablas siempre por migración con esta conexión
(como hace este proyecto), y añadir `revoke all ... from anon, authenticated`
a cada migración nueva por costumbre.

### B-1 · BAJA · Códigos de verificación vencidos sin purgar — **CORREGIDO**
Se encontraron 4 códigos vencidos aún almacenados en claro. No son
canjeables (`/vincular` comprueba `expira_en`), de ahí la severidad baja.
Corregido con `purgarCodigosVencidos()` en el cron diario, con 24 h de
margen. El dato más seguro es el que no está.

### B-2 · BAJA · `avatarUrl` acepta cualquier URL — **DOCUMENTADO**
`PATCH /api/perfil` valida `avatarUrl` solo como URL genérica, así que un
usuario puede apuntar su avatar a cualquier host externo.

**No es explotable como XSS:** se renderiza en un `<img src>`, y ni
`javascript:` ni un SVG remoto ejecutan script en ese contexto. El impacto
se limita a quien lo configura (solo esa persona ve su propio avatar).

**Recomendación:** restringir a URLs del propio bucket `avatares` o de
`googleusercontent.com` — defensa en profundidad barata, no urgente.

### B-3 · BAJA · `anon` conserva SELECT en 13 tablas — **DOCUMENTADO**
Un usuario sin sesión mantiene el GRANT de lectura. **RLS lo bloquea igual**:
con `auth.uid()` a `NULL`, la condición `NULL = user_id` nunca es cierta, así
que no devuelve filas. Es un GRANT innecesario, no un agujero. Revocarlo
sería defensa en profundidad; se deja documentado por no tocar permisos de
producción sin necesidad.

### B-4 · BAJA · `whatsapp_comandos_log` sin retención definida — **DOCUMENTADO**
Crece indefinidamente. Ya está declarado como tal en `/legal/privacidad` §09.
Conviene fijarle una política de expiración cuando el volumen lo justifique.

---

## Lo que esta auditoría NO cubre

Dicho explícitamente para que nadie lea de más en este documento:

- **No es un pentest.** Sin fuzzing, sin explotación activa más allá de las
  pruebas de IDOR y rate limiting descritas.
- **No cubre la seguridad interna de los proveedores** (Supabase, Vercel,
  Google, Whapi) más allá de cómo los usa este código.
- **No revisa la configuración de la consola de Vercel ni de Supabase**
  (variables de entorno reales, ajustes de autenticación, allowlist de
  redirect URLs) — no son accesibles desde el repositorio.
- **El webhook de Whapi sigue sin firma criptográfica**, porque el proveedor
  no la ofrece. Ya está documentado en el propio código con sus 3
  mitigaciones nombradas por lo que son. No es un hallazgo nuevo: es un
  límite conocido y aceptado del proveedor.
- **No se auditó el modo invitado** (`localStorage`) más allá de constatar
  que sus datos nunca salen del dispositivo hasta que se crea una cuenta.
