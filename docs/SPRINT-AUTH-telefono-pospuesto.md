# Login por teléfono — investigado, pospuesto sin fecha

Este documento conserva la investigación real ya hecha, para no repetirla si
el teléfono se retoma más adelante. **No hay código de este flujo en el
repositorio** — se eliminó a propósito (`app/login/telefono/`,
`lib/auth/config.ts`) en vez de dejarlo apagado como código muerto sin usar.

## Por qué se retiró

El único requisito no negociable era costo $0 de SMS. Se investigaron dos
rutas y **ninguna lo cumple**:

### Twilio (Fase 0 original)

SMS a Colombia: **$0.0592** por mensaje ([Twilio CO](https://www.twilio.com/en-us/sms/pricing/co)),
~7x la tarifa de EE.UU. con la que se solía estimar. Con Twilio Verify suma
$0.05 más por verificación exitosa (~$0.109 total); con Twilio simple
(Supabase genera y verifica el OTP) queda en ~$0.059. Sin capa gratuita.

### Firebase Phone Auth (segunda vuelta, evaluado específicamente porque el
### plan Spark es gratis para otras cosas)

**Tampoco es gratis.** La [documentación oficial de límites de Firebase Auth](https://firebase.google.com/docs/auth/limits)
dice textualmente:

> *"Verification code SMS messages: Pay as you go (Blaze) plan only."*

El plan Spark (gratuito) no puede enviar un solo SMS de verificación en
producción — hace falta el plan Blaze, que exige tarjeta vinculada. Solo el
[modo de prueba sin SIM](https://firebase.google.com/docs/phone-number-verification/pricing)
es gratis, y sirve únicamente para testing, no para usuarios reales. Tarifa
por SMS, variable por país (EE.UU./Canadá ~$0.01, hasta ~$0.46 en los países
más caros según agregadores de terceros — Colombia no aparece en las tablas
oficiales consultadas).

Además, el puente técnico "Firebase verifica → Supabase emite la sesión"
tiene fricción propia: `supabase.auth.admin.generateLink()` solo acepta
tipos basados en **email** (`signup`, `invite`, `magiclink`, `recovery`,
`email_change_*`) — no hay un tipo nativo para "usuario verificado por
teléfono". Conectar un verificador externo de teléfono con una sesión real
de Supabase exigiría un email sintético como workaround, no un camino
documentado y limpio.

**Conclusión: no existe una vía de SMS a costo $0 en ningún proveedor serio
investigado.** El costo no es una particularidad de Twilio — es inherente a
que alguien en la cadena (Google, Twilio, el operador móvil) cobra por
entregar el mensaje.

## Qué SÍ quedó construido y sigue vigente

- El flujo de Google vía Supabase nativo, con el scope `drive.file` ya listo
  para el sprint de Archivos.
- El patrón "método externo verifica → Supabase emite sesión real" (admin
  API + `generateLink`/`verifyOtp`) queda documentado como referencia si
  algún día se necesita para OTRO verificador (no necesariamente de
  teléfono) — el mecanismo en sí es real, solo con la fricción del tipo de
  `generateLink` anotada arriba.

## Si se retoma en el futuro

1. Decidir si el costo (~$0.06-0.11 por login en Colombia) es aceptable para
   el volumen esperado.
2. Elegir Twilio simple (más barato, Supabase gestiona el OTP) sobre Twilio
   Verify, salvo que se necesite algo que Verify ofrezca y Twilio simple no.
3. Activar CAPTCHA y rate limits en Supabase **antes** de abrir el registro —
   sin esto, el vector de abuso (alguien dispara OTPs a números ajenos) cae
   directo en la factura del proyecto.
4. El diseño de UI (pantalla de teléfono → pantalla de código, cooldown de
   reenvío de 60s coincidente con el rate limit real de Supabase) ya se
   construyó una vez en este sprint y se puede recuperar del historial de
   git si hace falta un punto de partida, aunque probablemente sea más
   rápido rehacerlo con el contexto de este documento que recuperarlo.
