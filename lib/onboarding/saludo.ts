// Sprint Onboarding / Parte A — el texto que se muestra justo después de que
// la sesión se confirma, antes de soltar al usuario en la app.
//
// Puro y sin I/O a propósito, igual que lib/horario/inferirFecha.ts: corre en
// el entorno `node` de Vitest sin ningún mock, y la decisión de "qué dice el
// saludo" queda separada de "cómo se anima" (eso es del componente).
import { RUTA_APP } from '@/lib/rutas'

// ───────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE EL NOMBRE, y por qué NO de perfil_academico.nombre
// ───────────────────────────────────────────────────────────────────────────
// Lo obvio sería leer `perfil_academico.nombre`, que el trigger
// `crear_perfil_al_registrarse` (Sprint Auth) rellena desde la metadata del
// proveedor. Verificado contra la base real que eso NO alcanza:
//
//   · El usuario real tiene `perfil_academico.nombre = NULL`…
//   · …aunque `auth.users.raw_user_meta_data` SÍ contiene
//     `"full_name": "Samuel Ramírez"`.
//
// El motivo es una condición de carrera inherente al trigger, no un bug de
// datos: se registró por magic link a las 20:43 (un alta por email no trae
// nombre, así que el trigger guardó NULL, correctamente), y recién a las
// 20:59 vinculó Google, que fue quien añadió el nombre a la metadata. El
// trigger es `after insert`, no `after update` — nunca vuelve a correr.
//
// Ampliarlo a un trigger de UPDATE sería una migración con más superficie de
// riesgo (corre en cada refresco de sesión de cada usuario) para un dato que
// ya está disponible, verificado y fresco en los claims del JWT de la propia
// sesión. Así que el saludo lee los claims, y PATCH /api/perfil aprovecha
// para rellenar la columna de paso — sin trigger nuevo.

/** Metadata del proveedor tal como llega en los claims. Forma laxa a
 *  propósito: viene de un JWT, o sea de fuera. */
type MetadataUsuario = { full_name?: unknown; name?: unknown } | null | undefined

// Un nombre absurdamente largo rompería el layout del saludo, que es una
// sola línea grande. Se prefiere saludar sin nombre antes que desbordar.
const MAX_LARGO_NOMBRE = 24
const MAX_LARGO_COMPLETO = 80

/** Saca `user_metadata` de los claims verificados. Acepta `unknown` porque
 *  el tipo que devuelve `getClaims()` es deliberadamente abierto — son
 *  datos de un JWT, y tratarlos como una forma conocida sería confiar en
 *  que el proveedor nunca cambie lo que manda. */
export function metadataDeClaims(claims: unknown): MetadataUsuario {
  if (!claims || typeof claims !== 'object') return null
  const meta = (claims as { user_metadata?: unknown }).user_metadata
  if (!meta || typeof meta !== 'object') return null
  return meta as MetadataUsuario
}

function nombreCrudo(metadata: MetadataUsuario): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  if (typeof metadata.full_name === 'string') return metadata.full_name
  if (typeof metadata.name === 'string') return metadata.name
  return null
}

/** Primer nombre, para el saludo. "Samuel Ramírez" → "Samuel": un saludo con
 *  el nombre completo suena a carta del banco. */
export function nombreParaSaludo(metadata: MetadataUsuario): string | null {
  const crudo = nombreCrudo(metadata)
  if (crudo === null) return null

  const primero = crudo.trim().split(/\s+/)[0] ?? ''
  if (primero.length === 0 || primero.length > MAX_LARGO_NOMBRE) return null

  return primero
}

/** Nombre completo, para PERSISTIR en `perfil_academico.nombre` — ahí sí se
 *  guarda entero, porque es el dato real del usuario y otras pantallas
 *  futuras (Ajustes) van a quererlo completo. Recibe los claims enteros
 *  porque quien lo llama (PATCH /api/perfil) los tiene en esa forma. */
export function nombreCompletoDeClaims(claims: unknown): string | null {
  const crudo = nombreCrudo(metadataDeClaims(claims))
  if (crudo === null) return null

  const limpio = crudo.trim().replace(/\s+/g, ' ')
  if (limpio.length === 0 || limpio.length > MAX_LARGO_COMPLETO) return null

  return limpio
}

// ───────────────────────────────────────────────────────────────────────────
// EL TEXTO
// ───────────────────────────────────────────────────────────────────────────
// Nota de redacción: ninguna variante lleva género gramatical.
// "Bienvenido de nuevo" era lo que sugería el encargo, pero el registro es
// abierto y multiusuario desde el Sprint Auth — un saludo en masculino le
// erraría a parte de los usuarios desde el primer segundo de la app. "Qué
// bueno tenerte de vuelta" dice lo mismo, con el mismo tono cercano, y
// funciona para cualquiera. La variante de primera vez ya era neutra.
export function textoSaludo(esPrimeraVez: boolean, nombre: string | null): string {
  if (esPrimeraVez) return 'Así que es tu primera vez, ¿eh?'
  return nombre ? `Qué bueno tenerte de vuelta, ${nombre}` : 'Qué bueno tenerte de vuelta'
}

// Subtítulo bajo el saludo. En la primera vez anticipa que sigue algo
// (evita que el carrusel se sienta como una interrupción); en la vuelta
// confirma que ya se está entrando, para que el segundo y medio no se lea
// como que la app se colgó.
export function subtituloSaludo(esPrimeraVez: boolean): string {
  return esPrimeraVez ? 'Deja te muestro lo que puedes hacer con Flow+.' : 'Abriendo tu agenda…'
}

// Cuánto se queda el saludo en pantalla antes de continuar solo.
//
// Dos valores distintos porque el saludo cumple dos funciones distintas: en
// la primera vez es la apertura de una experiencia que sigue (puede
// respirar); en la vuelta es un peaje en el camino a la app, y el encargo es
// explícito en que no debe demorar a quien ya la conoce. Ambos se pueden
// saltar con un clic.
export const MS_SALUDO_PRIMERA_VEZ = 2200
export const MS_SALUDO_DE_VUELTA = 1600

export function msSaludo(esPrimeraVez: boolean): number {
  return esPrimeraVez ? MS_SALUDO_PRIMERA_VEZ : MS_SALUDO_DE_VUELTA
}

// ───────────────────────────────────────────────────────────────────────────
// A dónde va el usuario cuando el saludo (o el carrusel) termina
// ───────────────────────────────────────────────────────────────────────────
// Mismo criterio anti-open-redirect que ya usan app/auth/callback y
// app/auth/confirm: solo rutas internas. Se centraliza acá porque ahora son
// tres los sitios que lo necesitan y tres copias de una regla de seguridad
// es una copia de más.
export function destinoSeguro(volverA: string | null | undefined): string {
  if (!volverA) return RUTA_APP
  if (!volverA.startsWith('/')) return RUTA_APP
  if (volverA.startsWith('//')) return RUTA_APP
  // Nunca devolver al propio flujo de entrada: sería un bucle.
  if (volverA === '/bienvenida' || volverA.startsWith('/bienvenida/')) return RUTA_APP
  if (volverA === '/login' || volverA.startsWith('/login/')) return RUTA_APP
  // `/` es la landing pública, no la app. Alguien que acaba de iniciar sesión
  // quiere entrar a su agenda, no volver a la página de marca — así que un
  // `volverA=/` (que es lo que dejaba el proxy antes de la reorganización, y
  // lo que dejaría un enlace viejo) se trata como "llévame a la app".
  if (volverA === '/') return RUTA_APP
  return volverA
}
