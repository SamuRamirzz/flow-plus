'use client'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { apiPost } from '@/lib/api/cliente'

export type EstadoCuentaEliminacion = {
  solicitada: boolean
  solicitadaEn: string | null
  eliminarDriveTambien: boolean | null
}

type Resultado = { ok: true } | { ok: false; error: string }

type CuentaEliminacionContextType = EstadoCuentaEliminacion & {
  solicitar: (eliminarDriveTambien: boolean) => Promise<Resultado>
  cancelar: () => Promise<Resultado>
}

const CuentaEliminacionContext = createContext<CuentaEliminacionContextType | undefined>(undefined)

const SIN_SOLICITUD: EstadoCuentaEliminacion = { solicitada: false, solicitadaEn: null, eliminarDriveTambien: null }

// Sprint Soporte + Eliminación de cuenta — mismo patrón que
// lib/preferencias.tsx: `inicial` se carga SERVER-SIDE en app/layout.tsx
// (misma consulta a `perfil_academico` que ya trae zona horaria/formato de
// reloj, dos columnas más no cuestan una consulta aparte), y las mutaciones
// viven en un contexto compartido en vez de en el propio componente que las
// dispara.
//
// Por qué un contexto y no que cada componente haga su propio fetch: la
// categoría Soporte de Ajustes (donde se solicita/cancela) y el banner
// persistente (montado en el layout raíz, fuera del árbol de Ajustes) son
// DOS árboles hermanos — sin un estado compartido, cancelar desde Ajustes no
// haría desaparecer el banner hasta recargar la página.
//
// A diferencia de `actualizar()` en PreferenciasProvider, NO es optimista:
// solicitar/cancelar son acciones deliberadas y poco frecuentes (no un
// toggle que el usuario arrastra), y la fecha exacta de ejecución la calcula
// el servidor a partir de su propio reloj — adelantarla en el cliente antes
// de tener la respuesta real arriesgaría mostrar una fecha ligeramente
// distinta a la que de verdad quedó guardada.
export function CuentaEliminacionProvider({ inicial, children }: { inicial: EstadoCuentaEliminacion | null; children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoCuentaEliminacion>(inicial ?? SIN_SOLICITUD)

  async function solicitar(eliminarDriveTambien: boolean): Promise<Resultado> {
    const r = await apiPost<{ eliminacionSolicitadaEn: string; eliminarDriveTambien: boolean }>('/api/cuenta/eliminar', { eliminarDriveTambien })
    if (!r.ok) return { ok: false, error: r.error }
    setEstado({ solicitada: true, solicitadaEn: r.data.eliminacionSolicitadaEn, eliminarDriveTambien: r.data.eliminarDriveTambien })
    return { ok: true }
  }

  async function cancelar(): Promise<Resultado> {
    const r = await apiPost<{ cancelado: boolean }>('/api/cuenta/cancelar-eliminacion', {})
    if (!r.ok) return { ok: false, error: r.error }
    setEstado(SIN_SOLICITUD)
    return { ok: true }
  }

  return <CuentaEliminacionContext.Provider value={{ ...estado, solicitar, cancelar }}>{children}</CuentaEliminacionContext.Provider>
}

export function useCuentaEliminacion() {
  const ctx = useContext(CuentaEliminacionContext)
  if (!ctx) throw new Error('useCuentaEliminacion debe usarse dentro de CuentaEliminacionProvider')
  return ctx
}
