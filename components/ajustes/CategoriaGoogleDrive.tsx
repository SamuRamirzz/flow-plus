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
// Google Drive sale del array genérico `lib/ajustes/proximamente.ts` y pasa a
// tener su propia categoría con estado REAL, consumiendo los dos endpoints
// que ya existen desde Tramo 2a. Ese array documenta explícitamente que es un
// mecanismo temporal: "cuando una de estas se construye de verdad, ese sprint
// la saca de este array".
export default function CategoriaGoogleDrive() {
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
        // la llamada fallaría y el error no aportaría nada que el estado no
        // diga ya.
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
    <div>
      <h2 className="font-display text-xl font-semibold text-paper mb-1.5">Google Drive</h2>
      <p className="text-sm text-muted mb-6 leading-relaxed">Tus archivos y notas de Flow+ se guardan en tu propio Google Drive, dentro de una carpeta llamada “Flow+”.</p>

      {cargando ? (
        <div className="rounded-2xl bg-panel-2/60 p-4 flex items-center gap-2.5 text-sm text-muted">
          <Loader2 size={15} className="animate-spin" />
          Comprobando el estado de la vinculación…
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-panel-2/60 p-4">
            <div className="flex items-start gap-3">
              <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${vinculada ? 'bg-success/12' : 'bg-muted/10'}`}>
                <HardDrive size={16} className={vinculada ? 'text-success' : 'text-muted'} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-paper flex items-center gap-1.5">
                  {vinculada ? (
                    <>
                      <CheckCircle2 size={14} className="text-success" />
                      Cuenta vinculada
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} className="text-muted" />
                      Sin vincular
                    </>
                  )}
                </p>
                <p className="text-[12px] text-muted mt-1 leading-relaxed break-words">
                  {vinculada
                    ? (estado?.cuentaEmail ?? 'Cuenta de Google conectada')
                    : 'Vuelve a iniciar sesión con Google para conectar tu Drive y poder subir archivos.'}
                </p>
              </div>
            </div>

            {vinculada && espacio && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-muted mb-1.5">
                  <span>Almacenamiento de tu cuenta</span>
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
            <div className="mt-5">
              {/* Doble toque: desvincular es destructivo (borra el refresh
                  token cifrado y obliga a volver a pasar por Google). Mismo
                  componente que "Limpiar horario" y "Cerrar sesión", para que
                  el usuario aprenda un solo patrón de confirmación. */}
              <BotonConfirmacion
                onConfirmar={() => void alDesvincular()}
                etiqueta="Desvincular Google Drive"
                etiquetaConfirmar="Toca de nuevo para desvincular"
                icono={<Unlink size={14} />}
                disabled={desvinculando}
              />
              <p className="mt-3 text-[11px] text-muted leading-relaxed max-w-md">
                Tus archivos <span className="text-paper">no se borran</span>: se quedan en tu Drive. Flow+ solo pierde el acceso a ellos y dejarás de poder subir archivos
                nuevos hasta que vuelvas a conectarlo.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
