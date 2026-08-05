'use client'
import { useEffect } from 'react'
import { crearMateria, crearTarea, actualizarTarea } from '@/lib/tasks'
import { crearBloqueHorario } from '@/lib/horario/mutar'
import { leerDatosInvitado, limpiarDatosInvitado } from '@/lib/invitado/almacen'
import { limpiarModoInvitado, getGuestId } from '@/lib/invitado/estado'
import { sincronizarInvitado } from '@/lib/invitado/sincronizar'
import { useToast } from '@/lib/toast'

// Se monta en app/layout.tsx SOLO cuando hay sesión (`{haySesion &&
// <SincronizadorInvitado/>}`), junto a AppSidebar/NavDock/AjustesModal —
// es el único punto que cubre CUALQUIER pantalla autenticada, no solo
// /bienvenida (que un usuario que vuelve a loguearse tras completar
// onboarding nunca vuelve a visitar).
//
// Si hay datos de invitado en localStorage cuando esto se monta, significa
// que la persona activó modo invitado, cargó tareas/horario locales, y
// ACABA de conseguir una sesión real (recién registrado, o inició sesión
// en un dispositivo donde antes había probado sin cuenta). Se sincronizan
// una sola vez y se limpia el storage local solo si el resultado fue éxito
// completo — un fallo deja los datos intactos para poder reintentar.
export default function SincronizadorInvitado() {
  const { notify } = useToast()

  useEffect(() => {
    let activo = true

    async function sincronizar() {
      if (!getGuestId()) return
      const datos = leerDatosInvitado()
      if (datos.materias.length === 0 && datos.tareas.length === 0 && datos.horario.length === 0) {
        // Marca de invitado sin datos reales (probó el botón, no llegó a
        // crear nada) — se limpia igual, no hay nada que sincronizar.
        limpiarModoInvitado()
        limpiarDatosInvitado()
        return
      }

      const resultado = await sincronizarInvitado(datos, { crearMateria, crearTarea, actualizarTarea, crearBloqueHorario })
      if (!activo) return

      if (resultado.ok) {
        limpiarModoInvitado()
        limpiarDatosInvitado()
        const { materias, tareas } = resultado.resumen
        if (tareas > 0 || materias > 0) {
          notify(`Tus datos de invitado se guardaron en tu cuenta — ${tareas} tarea${tareas === 1 ? '' : 's'}, ${materias} materia${materias === 1 ? '' : 's'}`)
        }
      } else {
        notify('No se pudieron guardar todos tus datos de invitado — vuelve a intentarlo recargando la página', false)
      }
    }

    sincronizar()
    return () => {
      activo = false
    }
  }, [notify])

  return null
}
