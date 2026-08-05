'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BotonConfirmacion from '@/components/ui/BotonConfirmacion'

// Cerrar sesión pasa a ser su propia categoría del modal de Ajustes.
// Antes vivía en DOS lugares a la vez (el pie de CategoriaPerfil y
// SesionSidebar dentro de la navbar), con el mismo handler copiado en los
// dos. Al mudar la identidad completa acá adentro, este archivo queda como
// el único punto de salida de la app — así que el handler ya no necesita
// ser un helper compartido, simplemente vive donde se usa.
//
// Usa BotonConfirmacion (el mismo de "Limpiar horario") en vez de un
// confirm() o un modal anidado: cerrar sesión es destructivo pero de un
// solo paso, sin nada que llenar — exactamente el caso para el que ese
// componente se construyó, y así el usuario aprende un solo patrón de
// confirmación en toda la app.
export default function CategoriaCerrarSesion() {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    await supabase.auth.signOut()
    // `refresh()` antes de navegar: obliga al proxy a re-evaluar la sesión
    // ya cerrada. Sin esto, la ruta destino podría renderizarse con el
    // estado autenticado todavía en caché.
    router.refresh()
    router.replace('/login')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-paper flex items-center gap-2">
          <LogOut size={16} className="text-coral" />
          Cerrar sesión
        </h2>
        <p className="text-muted text-xs mt-1">Saldrás de tu cuenta en este dispositivo.</p>
      </div>

      <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-5 flex flex-col gap-4">
        <p className="text-sm text-paper">
          Tus tareas, materias y horario quedan guardados — vuelven a aparecer apenas inicies sesión otra vez.
        </p>
        <BotonConfirmacion
          onConfirmar={salir}
          disabled={saliendo}
          etiqueta={saliendo ? 'Saliendo…' : 'Cerrar sesión'}
          etiquetaConfirmar="Toca otra vez para confirmar"
          icono={<LogOut size={14} />}
          className="w-full justify-center py-3.5 text-danger"
        />
      </div>
    </div>
  )
}
