'use client'
import { useSyncExternalStore } from 'react'

// `false` durante el render del servidor Y durante el render de hidratación;
// `true` a partir del siguiente. Sirve para posponer al cliente cualquier
// cosa que el servidor no puede renderizar — en este proyecto, los cinco
// `createPortal` (toast, NotificationBell, PremiumSelect, PremiumDatePicker,
// PremiumTimePicker).
//
// Reemplaza el patrón `typeof document !== 'undefined' && createPortal(...)`
// que esos cinco componentes repetían. Ese patrón es exactamente la primera
// causa que React nombra en su propio mensaje de error de hidratación ("A
// server/client branch `if (typeof window !== 'undefined')`") y provocaba un
// desajuste real, verificado en navegador: el servidor no renderiza nada
// (deja un marcador `<script id="_R_">`), el render de hidratación del cliente
// SÍ renderiza el portal, los dos árboles no coinciden y React descarta y
// vuelve a renderizar ese subárbol en cada carga de página.
//
// Por qué useSyncExternalStore y no el `useState(false)` + `useEffect(() =>
// setMontado(true))` habitual: ese par es precisamente un setState dentro de
// un efecto, es decir, reintroduciría el error de lint
// react-hooks/set-state-in-effect que se acaba de dejar en cero en todo el
// proyecto. Con este hook, React usa `leerServidor` para el render que hidrata
// (coincide con el servidor) y recién después compara con `leerCliente` — que
// es el mecanismo para el que este hook existe. Mismo criterio que
// lib/ai/useDictado.ts y lib/theme.tsx.
function suscribirNoOp() {
  return () => {}
}
function leerCliente() {
  return true
}
function leerServidor() {
  return false
}

export function useMontado(): boolean {
  return useSyncExternalStore(suscribirNoOp, leerCliente, leerServidor)
}
