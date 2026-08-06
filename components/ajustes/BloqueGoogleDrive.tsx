'use client'

import { useEffect, useState } from 'react'
import { HardDrive, CheckCircle2, AlertCircle, Loader2, Unlink } from 'lucide-react'
import BotonConfirmacion from '@/components/ui/BotonConfirmacion'
import { useToast } from '@/lib/toast'
import { estadoDrive, desvincularDrive, cargarEspacio } from '@/lib/archivos/api'
import { formatearTamano, porcentajeUsado } from '@/lib/archivos/formato'
import type { EstadoDrive, EspacioDrive } from '@/lib/archivos/tipos'

// Sprint Archivos / Frontend — Parte F.
//
// Vive DENTRO de la categoría Perfil (no como categoría propia): la cuenta de
// Google vinculada es parte de la identidad del usuario, la misma con la que
// inicia sesión — separarla en su propia sección la presentaba como un
// servicio aparte cuando en realidad es "de qué cuenta es esta app".
//
// Por eso este componente no lleva `<h2>` propio: se compone como un bloque
// más de Perfil, con el mismo `rounded-2xl bg-panel-glass` que los otros.
//
// Google Drive salió del array `lib/ajustes/proximamente.ts` al construirse
// esto: ese archivo documenta que es un mecanismo temporal y que cuando algo
// se construye de verdad, el sprint que lo construye lo saca de ahí.
export default function BloqueGoogleDrive() {
  const { notify } = useToast()
  const [estado, setEstado] = useState<EstadoDrive | null>(null)
  const [espacio, setEspacio] = useState<EspacioDrive | null>(null)
  const [cargando, setCargando] = useState(true)
  const [desvinculando, setDesvinculando] = useState(false)

  useEffect(() => {
    let activo = true
    ;(async () => {
      const r = await estadoDrive()
      if (!activo) return
      if (r.ok) {
        setEstado(r.datos)
        // El espacio solo tiene sentido pedirlo si hay vinculación — sin ella
        // la llamada fallaría y el error no diría nada que el estado no diga ya.
        if (r.datos.estado === 'vinculada') {
          const e = await cargarEspacio()
          if (activo && e.ok) setEspacio(e.datos)
        }
      }
      setCargando(false)
    })()
    return () => {
      activo = false
    }
  }, [])

  async function alDesvincular() {
    setDesvinculando(true)
    const r = await desvincularDrive()
    setDesvinculando(false)
    if (!r.ok) return notify(r.error, false)
    setEstado({ estado: 'sin_vinculacion' })
    setEspacio(null)
    notify('Se desvinculó tu cuenta de Google Drive', true)
  }

  const vinculada = estado?.estado === 'vinculada'

  return (
    <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1">
        <HardDrive size={14} className="text-coral shrink-0" />
        <p className="text-sm text-paper font-medium">Google Drive</p>
      </div>
      <p className="text-muted text-xs leading-relaxed mb-3">Tus archivos y notas se guardan en tu propio Drive, dentro de una carpeta “Flow+”.</p>

      {cargando ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 size={13} className="animate-spin" />
          Comprobando la vinculación…
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-panel-2/60 px-3 py-2.5">
            <p className="text-xs font-medium text-paper flex items-center gap-1.5">
              {vinculada ? (
                <>
                  <CheckCircle2 size={13} className="text-success" />
                  Cuenta vinculada
                </>
              ) : (
                <>
                  <AlertCircle size={13} className="text-muted" />
                  Sin vincular
                </>
              )}
            </p>
            <p className="text-[11px] text-muted mt-1 leading-relaxed break-words">
              {vinculada ? (estado?.cuentaEmail ?? 'Cuenta de Google conectada') : 'Vuelve a iniciar sesión con Google para conectar tu Drive y poder subir archivos.'}
            </p>

            {vinculada && espacio && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-muted mb-1.5">
                  <span>Almacenamiento</span>
                  <span className="font-mono tabular-nums">
                    {formatearTamano(espacio.usadoBytes)} / {formatearTamano(espacio.totalBytes)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-panel overflow-hidden">
                  <div className="h-full rounded-full bg-coral" style={{ width: `${porcentajeUsado(espacio.usadoBytes, espacio.totalBytes)}%` }} />
                </div>
              </div>
            )}
          </div>

          {vinculada && (
            <div className="mt-3">
              {/* Doble toque: desvincular borra el refresh token cifrado y
                  obliga a volver a pasar por Google. Mismo componente que
                  "Limpiar horario" y "Cerrar sesión". */}
              <BotonConfirmacion
                onConfirmar={() => void alDesvincular()}
                etiqueta="Desvincular Google Drive"
                etiquetaConfirmar="Toca de nuevo para desvincular"
                icono={<Unlink size={13} />}
                disabled={desvinculando}
              />
              <p className="mt-2.5 text-[11px] text-muted leading-relaxed">
                Tus archivos <span className="text-paper">no se borran</span>: se quedan en tu Drive. Flow+ solo pierde el acceso a ellos.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
