'use client'
import { useCallback, useSyncExternalStore } from 'react'

// Sprint Rediseño /ai — Parte B.4. El estado del panel SÍ se recuerda entre
// sesiones: si alguien lo colapsó fue porque prefiere más espacio para la
// conversación, y obligarlo a repetir ese gesto en cada visita convierte una
// preferencia en una tarea. Mismo criterio que el tema oscuro/claro, que ya
// se guarda en localStorage con esta misma clave-prefijo.
//
// Se usa `useSyncExternalStore` en vez de `useState` + `useEffect` por dos
// razones concretas: (1) evita el `react-hooks/set-state-in-effect` que este
// proyecto mantiene en cero, y (2) da un `getServerSnapshot` explícito, así
// que el primer render del servidor y el de hidratación coinciden (el panel
// arranca visible) y no hay parpadeo ni desajuste de hidratación.

const CLAVE = 'flowplus-ai-panel-colapsado'

// Suscripción real al evento `storage`: si el usuario tiene /ai abierto en
// dos pestañas, colapsar en una se refleja en la otra sin recargar.
function suscribir(alCambiar: () => void): () => void {
  window.addEventListener('storage', alCambiar)
  window.addEventListener(CLAVE, alCambiar)
  return () => {
    window.removeEventListener('storage', alCambiar)
    window.removeEventListener(CLAVE, alCambiar)
  }
}

function leer(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === '1'
  } catch {
    // Modo privado / almacenamiento bloqueado: el panel simplemente no
    // recuerda su estado, nunca rompe la pantalla.
    return false
  }
}

/** En servidor e hidratación el panel siempre arranca visible. */
function leerEnServidor(): boolean {
  return false
}

export function usePanelColapsado(): [boolean, (colapsado: boolean) => void] {
  const colapsado = useSyncExternalStore(suscribir, leer, leerEnServidor)

  const establecer = useCallback((valor: boolean) => {
    try {
      window.localStorage.setItem(CLAVE, valor ? '1' : '0')
    } catch {
      // Sin persistencia, pero el evento de abajo igual actualiza la UI.
    }
    // `storage` solo se dispara en OTRAS pestañas; este evento propio es lo
    // que hace que la pestaña actual se entere de su propio cambio.
    window.dispatchEvent(new Event(CLAVE))
  }, [])

  return [colapsado, establecer]
}
