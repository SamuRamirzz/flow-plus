# Inventario de datos personales — Flow+

Levantado el **2026-08-22** consultando el esquema real de producción y el
código, no la documentación previa. Es el insumo directo de
`/legal/privacidad` y `/legal/terminos`: cada afirmación de esas páginas
debe poder señalarse a una fila de este documento.

Método: consulta directa a Postgres (`information_schema`, `pg_policies`,
`pg_tables`) sobre la base real, más lectura del código de cada integración.
Los conteos de filas son del momento del levantamiento y solo sirven para
dar escala.

---

## 1. Tablas de la base de datos (15 + 1 creada en esta auditoría)

Las 16 tienen **RLS activa**. Ni `anon` ni `authenticated` pueden escribir
en ninguna (los GRANT de escritura están revocados desde
`20260801000000`); el servidor escribe con `service_role`.

| Tabla | Qué guarda | ¿Dato personal? | Retención |
|---|---|---|---|
| `perfil_academico` | Nombre, apellido, país, zona horaria, formato de reloj, institución, avatar propio, número y chat de WhatsApp, preferencias de notificación, estado de eliminación de cuenta | **Sí, directo** | Mientras exista la cuenta |
| `materias` | Nombre, color, ícono, carpeta de Drive asociada | Sí (revela qué estudia) | Mientras exista la cuenta |
| `tareas` | Título, materia, fecha de entrega, prioridad, tipo, si está completada y cuándo, y para exámenes: temario, formato y peso en la nota | Sí (rendimiento académico) | Hasta que el usuario la borre |
| `horario` | Día, hora de inicio/fin, aula, profesor, tipo de bloque | **Sí, sensible por inferencia** — reconstruye la rutina semanal y la ubicación física habitual del usuario | Mientras exista la cuenta |
| `notas` | Texto libre del usuario, anclado a tarea/bloque/archivo/materia o suelto | Sí (contenido libre, puede contener cualquier cosa) | Hasta que el usuario la borre |
| `archivos` | Nombre, MIME, tamaño, id de Drive, resumen generado por IA, tipo de documento, tareas detectadas, última apertura | Sí | Hasta que el usuario lo borre |
| `conversaciones_ia` | Mensajes íntegros con el asistente + resumen generado | **Sí, potencialmente sensible** — es texto libre en lenguaje natural | Últimos 50 mensajes por conversación |
| `notificaciones` | Tipo, título, cuerpo, entidad referida, leída/no leída | Sí (deriva de tareas) | Mientras exista la cuenta |
| `notificaciones_enviadas` | Ledger de deduplicación del cron: tarea, tipo, urgencia, fecha | Indirecto | Indefinida |
| `whatsapp_codigos_verificacion` | Código de 6 dígitos, número, vencimiento, si se usó | **Sí — es una credencial** | Vence a los 10 min; **se borra a las 24 h** (añadido en esta auditoría) |
| `whatsapp_comandos_log` | Número de origen, mensaje, comando detectado, resultado | Sí, con un matiz importante — ver §4 | Indefinida |
| `integraciones_externas` | Tokens de Google **cifrados (AES-256-GCM)**, correo de la cuenta, scope, carpeta raíz | **Sí — credenciales** | Hasta desvincular Drive |
| `memoria` | Memoria interna de la IA por scope | Indirecto | Con `expires_at` opcional |
| `ai_events` | Metadata de ejecución de agentes (qué corrió, cuándo, si falló) | **No incluye contenido** de mensajes ni tareas | Indefinida |
| `eliminaciones_cuenta_log` | Correo, fecha de ejecución, si se borró el Drive, conteo por tabla | Sí — **sobrevive al borrado a propósito**, como constancia | Indefinida |
| `limites_uso` *(nueva)* | user_id + acción + momento. **Solo la cuenta, nunca el contenido** | Indirecto | Se purga a diario |

**Sobre `horario`:** es la tabla que más conviene tratar con cuidado y la
que menos lo parece. Un horario semanal con aulas revela dónde está una
persona a qué hora, cada semana. No se comparte con nadie fuera de los
proveedores de §3, pero merece nombrarse como lo que es.

## 2. Identidad (gestionada por Supabase Auth, fuera de `public`)

- **4 usuarios** registrados; proveedores en uso: `email` (4) y `google` (1).
- `auth.users.raw_user_meta_data` recibe de Google: `avatar_url`, `picture`,
  `full_name`, `name`, `email`, `email_verified`, `sub`, `iss`,
  `provider_id`.
- **El avatar de Google NO se copia a la base**: se lee en vivo de esos
  claims en cada carga. `perfil_academico.avatar_url` solo se usa si el
  usuario sube una foto propia.
- Flow+ **no usa contraseñas** (Google o enlace mágico por correo).

## 3. Terceros que procesan datos del usuario

| Proveedor | Qué recibe | Base |
|---|---|---|
| **Supabase** | Toda la base de datos, la autenticación y los archivos en tránsito | Necesario para operar |
| **Google — OAuth** | Identidad al iniciar sesión (nombre, correo, foto) | Consentimiento |
| **Google — Drive** | Los archivos y notas que el usuario decide subir. Permiso `drive.file`: **solo los archivos que la propia app crea**, nunca el resto del Drive | Consentimiento, revocable |
| **Google — Gemini (IA)** | Texto que el usuario le escribe, fotos de horario, contenido de archivos al analizarlos, notas al preguntar por ellas, mensajes de WhatsApp | Consentimiento; proyecto con facturación activa ⇒ **no se usa para entrenar** |
| **Whapi.Cloud** | Los mensajes de WhatsApp, si el usuario vincula el canal | Consentimiento, opcional |
| **Vercel** | Hosting; logs de request de su plataforma | Necesario para operar |
| **Namecheap** | DNS del dominio | Necesario para operar |

**Correo transaccional:** hoy lo envía Supabase (enlaces mágicos). Si el
Grupo 3 introduce un proveedor propio, hay que añadirlo a esta tabla y a
`/legal/privacidad` §06.

## 4. WhatsApp — la particularidad que más importa declarar

El canal es una **cuenta personal de WhatsApp vinculada por sesión de
dispositivo** (el mecanismo de WhatsApp Web, vía Whapi.Cloud), **no** la API
oficial de negocios de Meta. Consecuencia real: por el webhook pasa toda la
mensajería de ese número, incluidos mensajes de personas que no son usuarias
de Flow+.

Cómo se resuelve, y son dos decisiones distintas tomadas por separado:

- **A quién se responde:** a cualquiera. Quien no está vinculado recibe un
  reto de autenticación explicándole cómo vincularse.
- **Qué se guarda:** el texto literal de un remitente **no vinculado no se
  escribe en la base**. Se guarda la fila con el marcador
  `(mensaje no vinculado)` en lugar del contenido, salvo que el mensaje sea
  un comando dirigido a Flow+.

**Verificado en esta auditoría contra las 22 filas reales de
`whatsapp_comandos_log`: 0 mensajes literales de terceros almacenados.** El
marcador funciona. (Una versión anterior sí llegó a archivar 3 mensajes
privados reales; esas filas se purgaron y el marcador existe para que no
vuelva a ocurrir.)

## 5. Lo que Flow+ NO recolecta

Verificado por búsqueda exhaustiva en el código, no por suposición:

- **Ni IP ni user-agent.** Cero referencias a `x-forwarded-for`,
  `request.ip`, `user-agent` en todo el repositorio. Vercel y Supabase
  registran requests en su propia infraestructura, fuera del control de la
  app.
- **Sin analítica ni publicidad.** No hay Google Analytics, Meta Pixel ni
  ningún rastreador integrado.
- **Sin audio.** El dictado usa el reconocimiento del navegador; a los
  servidores de Flow+ solo llega texto ya transcrito.
- **Sin datos de pago.** Flow+ no cobra ni procesa pagos.

## 6. Datos en el navegador

- **Cookies de sesión** (estrictamente necesarias) — mantienen la sesión.
- **`localStorage`** — preferencia de tema, estado colapsado del panel de
  `/ai`, y en **modo invitado**, materias/tareas/horario completos, que
  nunca llegan al servidor hasta que el usuario crea una cuenta.

## 7. Borrado de cuenta

Autoservicio desde Ajustes → Soporte, con **14 días de gracia** cancelables
con un clic. Al ejecutarse borra las 9 tablas de dominio explícitamente por
`user_id` (no depende de cascadas: se verificó que solo 5 tablas tienen FK
real a `auth.users`), revoca el token de Google y, si el usuario lo eligió,
borra la carpeta de Drive. Sobrevive únicamente la fila de
`eliminaciones_cuenta_log`: correo, fecha y resultado de Drive, como
constancia de que la solicitud se cumplió — nunca contenido.
