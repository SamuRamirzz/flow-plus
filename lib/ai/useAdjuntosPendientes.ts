'use client'
import { useState } from 'react'
import { useToast } from '@/lib/toast'
import { createId } from '@/lib/ai/utils'
import { validarAdjunto, LIMITE_ADJUNTOS_POR_MENSAJE } from './adjuntos'

export type AdjuntoPendiente = { id: string; archivo: File }

// Sub-sprint 7.3.1 — estado de "archivos elegidos, todavía no enviados",
// compartido entre el composer principal de /ai (app/ai/page.tsx) y el
// input de seguimiento dentro de la conversación (AIImmersiveOverlay), para
// no duplicar la validación + el tope de LIMITE_ADJUNTOS_POR_MENSAJE en los
// dos sitios. La subida/lectura real (procesarAdjunto) NO ocurre acá —
// mismo criterio que el sub-sprint 7.3: se sube recién al enviar el
// mensaje, no al elegir el archivo.
export function useAdjuntosPendientes() {
  const { notify } = useToast()
  const [adjuntos, setAdjuntos] = useState<AdjuntoPendiente[]>([])

  function agregar(archivos: FileList | File[]) {
    const disponibles = LIMITE_ADJUNTOS_POR_MENSAJE - adjuntos.length
    if (disponibles <= 0) {
      notify(`Máximo ${LIMITE_ADJUNTOS_POR_MENSAJE} adjuntos por mensaje`, false)
      return
    }

    const nuevos: AdjuntoPendiente[] = []
    for (const archivo of Array.from(archivos)) {
      if (nuevos.length >= disponibles) {
        notify(`Máximo ${LIMITE_ADJUNTOS_POR_MENSAJE} adjuntos por mensaje — se agregaron los primeros ${disponibles}`, false)
        break
      }
      const error = validarAdjunto(archivo)
      if (error) {
        notify(error, false)
        continue
      }
      nuevos.push({ id: createId('adj'), archivo })
    }
    if (nuevos.length > 0) setAdjuntos((actuales) => [...actuales, ...nuevos])
  }

  function quitar(id: string) {
    setAdjuntos((actuales) => actuales.filter((a) => a.id !== id))
  }

  function limpiar() {
    setAdjuntos([])
  }

  return { adjuntos, agregar, quitar, limpiar }
}
