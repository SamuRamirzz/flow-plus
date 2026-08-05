# Configuración del login — estado real

> ✅ **Google ya está configurado por el usuario.** El teléfono se retiró del
> alcance de este sprint (costo de SMS — ver
> [SPRINT-AUTH-telefono-pospuesto.md](SPRINT-AUTH-telefono-pospuesto.md)). Los
> dos métodos de este sprint son **Google** y **email (magic link)** — el
> segundo no requiere ninguna cuenta externa, Supabase lo maneja con su propio
> envío de correo por defecto.

Este documento queda como referencia de los pasos ya completados, por si hay
que repetirlos en otro entorno (staging, otro proyecto de Supabase, etc.).

---

## 1. Google Cloud Console — cliente OAuth

1. [console.cloud.google.com](https://console.cloud.google.com) → proyecto.
2. **Pantalla de consentimiento OAuth**: tipo Externo, scope
   `.../auth/drive.file` (⚠️ no el scope `drive` completo — `drive.file` es
   no-sensible y evita la revisión larga de Google), publicada como
   **"In production"** (no "Testing", que limita a 100 usuarios y expira
   tokens cada 7 días).
3. **Credenciales → ID de cliente OAuth**, tipo Aplicación web.
   **URI de redireccionamiento autorizado** — la de **Supabase**, no la de la
   app:
   ```
   https://zrvfvugsmvbfcjwkukom.supabase.co/auth/v1/callback
   ```

## 2. Dashboard de Supabase

1. **Authentication → Providers → Google** → activado con el Client ID/Secret
   del paso 1.
2. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` en desarrollo.
   - Redirect URLs: `http://localhost:3000/auth/callback` (+ el dominio real
     al desplegar).

## 3. Email (magic link) — nada que configurar

Supabase envía el correo con su propio servicio por defecto (límite bajo,
suficiente para desarrollo y para un proyecto personal de pocos usuarios). Si
el volumen crece, `Authentication → Providers → Email` permite conectar un
proveedor SMTP propio — no hace falta para este sprint.

## 4. Después de que el login funcione: limpieza y corte

Decisión del usuario: los datos actuales (33 materias, 8 tareas, todo bajo
`USUARIO_SIN_AUTH`) son mayormente de prueba y no vale la pena migrarlos —
se **limpian por completo** en vez de reasignarlos, para que la cuenta real
empiece desde cero.

👉 **[`supabase/PROCEDIMIENTO-migracion-usuario.md`](../supabase/PROCEDIMIENTO-migracion-usuario.md)**
(reescrito para reflejar la limpieza total, ya no la reasignación cuidadosa).

## Resumen del orden

```
1. Google Cloud Console  →  cliente OAuth con drive.file        [hecho]
2. Supabase dashboard    →  habilitar Google + Redirect URLs    [hecho]
3. Limpiar datos viejos + aplicar migraciones                   [este sprint]
4. Iniciar sesión de verdad con la cuenta real
5. Confirmar que el trigger creó el perfil y la app carga vacía y lista
```
