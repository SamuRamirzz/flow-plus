# Procedimiento de corte — limpieza total y cuenta real desde cero

> ✅ **Simplificado por decisión del usuario.** El diseño original de este
> sprint reasignaba cada fila al `auth.uid()` real (preservando materias,
> tareas, etc.). El usuario decidió que los datos actuales son mayormente de
> prueba y no vale la pena conservarlos: **se limpia todo** y la cuenta real
> empieza en blanco. Esto es más simple Y más seguro que la reasignación —
> no hay ningún UPDATE que pueda dejar una fila a medio mover, porque no hay
> ningún UPDATE.
>
> **Estado (2026-07-30): Pasos 0-3 ejecutados contra la base real.**
> Respaldo JSON tomado (`pg_dump` no disponible en este Windows, se usó `pg`
> directo — funcionalmente equivalente para este propósito), limpieza
> confirmada (`materias:33→0 tareas:8→0 horario:0 memoria:0 perfil:1→0
> notificaciones:6→0`, coincide exacto con el respaldo), Storage limpiado
> (21 objetos borrados: 11 en `horarios` + 10 en `tareas`), Fase 1 aplicada
> **y validada en el mismo paso** (tabla vacía, sin fila huérfana que
> perdonar — mejor que el `NOT VALID` que preveía el diseño original).
> Pasos 4-6 quedan pendientes: el 4 requiere que el usuario inicie sesión de
> verdad con Google (no simulable), el 5 depende del 4.

---

## Por qué el orden igual importa (aunque ya no hay reasignación)

```
respaldo  →  limpiar datos viejos  →  aplicar Fase 1  →  activar RLS  →  login real
```

Con la reasignación cuidadosa, el riesgo era "RLS antes de migrar los datos =
app vacía para el usuario real". Con la limpieza total ese riesgo desaparece
(no hay datos que reasignar), pero el orden se mantiene por prudencia: aplicar
la RLS sobre una base ya limpia es más simple de verificar que aplicarla a
mitad de una limpieza.

## Paso 0 — Respaldo (igual de obligatorio que antes)

Aunque el usuario dijo que no le importa conservar los datos, un respaldo de
30 segundos es gratis y es la red de seguridad si algo sale distinto a lo
esperado a mitad del proceso.

```bash
pg_dump "$DATABASE_URL" \
  --data-only \
  --table=public.materias --table=public.tareas --table=public.horario \
  --table=public.memoria --table=public.ai_events \
  --table=public.perfil_academico --table=public.notificaciones_enviadas \
  > respaldo-pre-limpieza-$(date +%Y%m%d-%H%M).sql
```

## Paso 1 — Limpiar los datos

Ejecutar `supabase/limpieza-total-usuario-original.sql` completo. No requiere
editar ningún valor (a diferencia del diseño anterior) — borra todo lo que
hoy pertenece a `USUARIO_SIN_AUTH`, dentro de una transacción con
comprobación final: si algo queda sin borrar, aborta sola sin guardar nada.

## Paso 2 — Borrar los archivos de Storage

Mismo criterio que el diseño original: son 20 objetos de prueba, ninguna
columna de la base los referencia.

```js
// Correr una vez con SUPABASE_SERVICE_ROLE_KEY.
const { createClient } = require('@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const VIEJO = '00000000-0000-0000-0000-000000000001'

for (const bucket of ['horarios', 'tareas']) {
  const { data } = await s.storage.from(bucket).list(VIEJO)
  const rutas = (data ?? []).map((f) => `${VIEJO}/${f.name}`)
  if (rutas.length) {
    const { error } = await s.storage.from(bucket).remove(rutas)
    console.log(bucket, rutas.length, error ?? 'ok')
  }
}
```

## Paso 3 — Aplicar la Fase 1 (perfil + trigger)

`supabase/migrations/20260803000000_auth_perfil_y_trigger.sql` — ver su
propio `PREFLIGHT-auth-perfil.md`. Con la base ya limpia, `perfil_academico`
está vacía, así que la FK se puede crear directamente **validada** (no hace
falta `NOT VALID` — ya no hay ninguna fila huérfana que perdonar). Si se
prefiere no editar la migración ya escrita, aplicarla tal cual (con
`NOT VALID`) y correr después:

```sql
alter table public.perfil_academico validate constraint perfil_academico_user_id_fkey;
```

Con la tabla vacía, esto valida al instante.

## Paso 4 — Iniciar sesión de verdad

Entrar con Google. El trigger crea el perfil automáticamente. Verificar:

```sql
select id, email, created_at from auth.users order by created_at;
select user_id, nombre, zona_horaria from public.perfil_academico;
```

Debe haber exactamente 1 usuario y 1 perfil, con el nombre que vino de
Google.

## Paso 5 — Activar la RLS real

`supabase/migrations/20260804000000_rls_propietario.sql` — ver
`PREFLIGHT-rls-propietario.md`. La app debe cargar **vacía pero funcional**:
sin materias ni tareas (se limpiaron), pero `/`, `/ai`, `/horario` cargan sin
error y se puede empezar a agregar datos reales de inmediato.

## Paso 6 — Confirmar que no queda rastro de la constante

```bash
grep -rn "USUARIO_SIN_AUTH\|00000000-0000-0000-0000-000000000001" --include="*.ts" --include="*.tsx" .
```

Cero resultados fuera de `supabase/` y `docs/`.

---

## Si algo sale mal

1. Parar.
2. Restaurar desde el respaldo del paso 0.
3. Las migraciones de estructura se revierten con los `drop` documentados al
   final de cada PREFLIGHT.
