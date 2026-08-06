// Rutas de la app, en un solo sitio.
//
// ───────────────────────────────────────────────────────────────────────────
// REORGANIZACIÓN: `/` es la landing, la agenda vive en `/agenda`
// ───────────────────────────────────────────────────────────────────────────
// Antes `/` servía dos cosas según la sesión: landing para el visitante
// anónimo, agenda para el usuario con sesión. Se cambió porque tenía un
// defecto que solo se ve usándolo: **con la sesión iniciada la landing era
// inalcanzable**. Ni siquiera su autor podía volver a verla sin cerrar sesión,
// y cualquiera que llegara por el enlace de marca teniendo cuenta caía en la
// app sin ver nunca la página que se le compartió.
//
// Ahora cada URL sirve una sola cosa: `/` es siempre la landing pública y
// `/agenda` es siempre la app. La landing cambia su botón según la sesión
// ("Entrar" vs "Ir a mi agenda"), que es lo que la vuelve útil para las dos
// audiencias sin esconderle nada a ninguna.
//
// ───────────────────────────────────────────────────────────────────────────
// SPRINT HOME: RUTA_APP pasa de /agenda a /home
// ───────────────────────────────────────────────────────────────────────────
// El sprint anterior había fusionado el pulso del día + informes DENTRO de
// la vista de Agenda — un error de alcance, corregido separando ambas
// secciones (ver app/home/ y app/agenda/). Con las dos ya separadas, hacía
// falta decidir cuál es "la app" a efectos de destino post-login: Home
// (el nuevo dashboard, decisión explícita del usuario) o Agenda (donde
// quedaba antes). Se eligió Home — es el uso convencional del concepto
// "Home": lo primero que ves. `destinoSeguro()` (lib/onboarding/saludo.ts)
// y el CTA de la Landing leen esta constante, así que el cambio se propaga
// solo — no hizo falta tocar ninguno de los dos archivos.
//
// El copy de Landing.tsx ("Mi agenda"/"Ir a mi agenda") tampoco se tocó:
// usa "agenda" como sustantivo genérico (tu planificador), no como
// referencia literal a la ruta `/agenda` — sigue siendo cierto que el botón
// te lleva "a tu agenda" en ese sentido amplio, aunque aterrices primero en
// Home.
export const RUTA_APP = '/home'

// La vista de trabajo de Agenda (tabla de tareas, formulario, calendario) —
// antes vivía en RUTA_APP; desde la corrección de alcance de este sprint es
// una ruta con nombre propio, referenciada explícitamente desde
// `AppSidebar`, el tercer acceso rápido de Home (`AccesosRapidos.tsx`) y
// `ModeTransition`/`Sidebar` para el `transitionTypes: ['to-agenda']` — el
// mismo motivo por el que `RUTA_APP` existe como constante en vez de
// repetir el literal.
export const RUTA_AGENDA = '/agenda'

// Sprint Archivos / Frontend — sección propia, referenciada desde
// `AppSidebar` y `NavDock`. Mismo criterio que las dos de arriba: la
// constante existe para no repetir el literal en los sitios que navegan
// hacia ella.
export const RUTA_ARCHIVOS = '/archivos'

// Ajustes NO tiene constante de ruta porque ya no es una ruta: es un modal
// que se abre encima de la pantalla en la que estés (ver lib/ajustesModal.tsx
// y components/ajustes/AjustesModal.tsx). La ruta `/ajustes` que existía
// antes se eliminó junto con su página.

// Rutas donde NO se monta la navegación de la app (sidebar + dock).
//
// `/` está aquí porque es la landing: tiene su propia barra con su propio
// botón, y encimarle la navegación interna sería mezclar la página de marca
// con la app. Las otras son pantallas de paso a pantalla completa, donde la
// única acción que tiene sentido es la que la pantalla misma ofrece.
// `/legal` — Términos/Privacidad son páginas públicas de lectura, del mismo
// espíritu que la landing: un usuario con sesión que las visita no necesita
// la navegación de la app encima, y un visitante sin sesión (el caso real
// que Google Cloud Console exige poder servir) nunca la vería de todos modos.
const RUTAS_SIN_NAVEGACION = ['/login', '/bienvenida', '/legal']

export function esRutaDeEntrada(pathname: string): boolean {
  if (pathname === '/') return true
  return RUTAS_SIN_NAVEGACION.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))
}
