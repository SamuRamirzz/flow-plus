'use client'
import { useEffect, useState, useRef } from 'react'
import { User, Check, Loader2, Camera, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { subirArchivo } from '@/lib/storage'
import { apiPatch } from '@/lib/api/cliente'
import { useToast } from '@/lib/toast'
import { avatarEfectivo } from '@/lib/onboarding/avatar'
import AvatarUsuario from '@/components/ui/AvatarUsuario'
import BloqueGoogleDrive from './BloqueGoogleDrive'

type Claims = { email?: string; phone?: string; app_metadata?: { provider?: string }; user_metadata?: { full_name?: string; name?: string } }

function metodoLogin(provider: string | undefined): string {
  if (provider === 'google') return 'Google'
  if (provider === 'phone') return 'Teléfono'
  return 'Email'
}

// El hallazgo central de este plan: guardar el nombre NO puede ser solo un
// PATCH a perfil_academico.nombre — lib/onboarding/saludo.ts y
// SesionSidebar.tsx leen el nombre de los CLAIMS del JWT
// (user_metadata.full_name/name), nunca de esa columna. Si solo se
// escribiera la tabla, el cambio "se guardaría" pero no se vería en
// ningún lado. `supabase.auth.updateUser()` es lo que de verdad actualiza
// la metadata real y dispara `onAuthStateChange` — que SesionSidebar ya
// escucha, así que se refresca solo, sin recargar la página. El PATCH a
// perfil_academico.nombre queda como espejo secundario (coherente con lo
// que ya anticipaba el comentario de saludo.ts), nunca la única escritura.
export default function CategoriaPerfil() {
  const { notify } = useToast()
  const [claims, setClaims] = useState<Claims | null>(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const inputFoto = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let activo = true
    async function leer() {
      const [{ data: claimsData }, resPerfil] = await Promise.all([supabase.auth.getClaims(), fetch('/api/perfil')])
      if (!activo) return
      const c = claimsData?.claims as Claims | undefined
      setClaims(c ?? null)
      setNombre(c?.user_metadata?.full_name ?? c?.user_metadata?.name ?? '')
      if (resPerfil.ok) {
        const perfil = await resPerfil.json()
        if (activo) setAvatarUrl(perfil.avatarUrl ?? null)
      }
    }
    leer()
    const { data: sub } = supabase.auth.onAuthStateChange(() => void leer())
    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const nombreActual = claims?.user_metadata?.full_name ?? claims?.user_metadata?.name ?? ''
  const huboCambio = nombre.trim().length > 0 && nombre.trim() !== nombreActual
  const fotoMostrada = avatarEfectivo(avatarUrl, claims)

  async function guardarNombre() {
    const limpio = nombre.trim()
    if (!limpio || guardando) return
    setGuardando(true)

    const { error } = await supabase.auth.updateUser({ data: { full_name: limpio } })
    if (error) {
      setGuardando(false)
      notify('No se pudo actualizar el nombre', false)
      return
    }

    // `updateUser()` actualiza auth.users pero NO por sí solo el JWT ya
    // emitido de la sesión actual — verificado en vivo: sin este refresh,
    // `getClaims()` (que decodifica el JWT tal cual está, no vuelve a
    // pedirlo) seguía devolviendo el nombre viejo más de 6s después,
    // aunque el update ya hubiera confirmado éxito. `refreshSession()`
    // fuerza un JWT nuevo con la metadata ya actualizada, y ESE es el que
    // dispara `onAuthStateChange` con datos frescos — lo que hace que
    // SesionSidebar/el saludo se actualicen solos, sin recargar la página.
    await supabase.auth.refreshSession()

    // Espejo secundario — un fallo acá no debe deshacer lo de arriba (ya
    // se ve reflejado en toda la app vía los claims), solo se registra.
    await apiPatch('/api/perfil', { nombre: limpio }).catch(() => {})

    setGuardando(false)
    notify('Nombre actualizado')
  }

  async function subirFoto(archivo: File) {
    if (!archivo.type.startsWith('image/')) {
      notify('Elige una imagen (PNG, JPG o WebP)', false)
      return
    }
    // El bucket admite hasta 3 MB (ver la migración) — se avisa acá para no
    // gastar la subida completa solo para que Storage la rechace al final.
    if (archivo.size > 3 * 1024 * 1024) {
      notify('La imagen no puede pesar más de 3 MB', false)
      return
    }

    setSubiendoFoto(true)
    const extension = archivo.name.split('.').pop()?.toLowerCase() || 'jpg'
    const resultado = await subirArchivo('avatares', archivo, extension, archivo.type)
    if (!resultado.ok) {
      setSubiendoFoto(false)
      notify(resultado.error, false)
      return
    }

    // El bucket es público (ver la migración): la URL pública se puede
    // construir sin pedirle nada más a Storage.
    const { data } = supabase.storage.from('avatares').getPublicUrl(resultado.ruta)
    const url = data.publicUrl

    const guardado = await apiPatch('/api/perfil', { avatarUrl: url })
    setSubiendoFoto(false)
    if (!guardado.ok) {
      notify('La foto se subió pero no se pudo guardar', false)
      return
    }
    setAvatarUrl(url)
    notify('Foto actualizada')
  }

  async function quitarFoto() {
    const anterior = avatarUrl
    setAvatarUrl(null)
    const resultado = await apiPatch('/api/perfil', { avatarUrl: null })
    if (!resultado.ok) {
      setAvatarUrl(anterior)
      notify('No se pudo quitar la foto', false)
    }
  }

  if (!claims) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-paper flex items-center gap-2">
          <User size={16} className="text-coral" />
          Perfil
        </h2>
        <p className="text-muted text-xs mt-1">Tu información y tu sesión.</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-8">
        <div className="relative group">
          <AvatarUsuario url={fotoMostrada} nombreParaInicial={nombreActual || claims.email || '?'} size={80} />
          <button
            onClick={() => inputFoto.current?.click()}
            disabled={subiendoFoto}
            aria-label="Cambiar foto de perfil"
            className="absolute inset-0 rounded-full bg-ink/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
          >
            {subiendoFoto ? <Loader2 size={18} className="animate-spin text-paper" /> : <Camera size={18} className="text-paper" />}
          </button>
          <input
            ref={inputFoto}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              if (archivo) subirFoto(archivo)
              e.target.value = ''
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => inputFoto.current?.click()} disabled={subiendoFoto} className="text-coral text-xs hover:text-paper transition">
            {avatarUrl ? 'Cambiar foto' : 'Añadir foto'}
          </button>
          {avatarUrl && (
            <>
              <span className="text-muted text-xs">·</span>
              <button onClick={quitarFoto} className="flex items-center gap-1 text-muted text-xs hover:text-danger transition">
                <X size={11} />
                Quitar
              </button>
            </>
          )}
        </div>
        <div className="text-center">
          <p className="text-paper text-sm font-medium">{nombreActual || 'Sin nombre'}</p>
          {claims.email && <p className="text-muted text-xs">{claims.email}</p>}
        </div>
      </div>

      <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
        <p className="text-sm text-paper font-medium mb-2.5">Nombre para mostrar</p>
        <div className="flex items-center gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
            placeholder="Tu nombre"
            className="flex-1 min-w-0 bg-panel-2/60 rounded-full px-4 py-2.5 text-sm text-paper outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
          />
          {huboCambio && (
            <button
              onClick={guardarNombre}
              disabled={guardando}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-full bg-coral text-ink hover:opacity-90 transition disabled:opacity-70"
            >
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Guardar
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5">
        <div>
          <p className="text-sm text-paper font-medium">Método de acceso</p>
          <p className="text-muted text-xs mt-0.5">Cómo iniciaste sesión — informativo.</p>
        </div>
        <span className="text-xs font-mono text-muted bg-panel-2/60 rounded-full px-3 py-1.5">{metodoLogin(claims.app_metadata?.provider)}</span>
      </div>

      {/* La cuenta de Google vinculada es parte de la identidad del usuario
          —es la misma con la que inicia sesión—, así que vive acá y no en una
          categoría aparte. */}
      <BloqueGoogleDrive />
    </div>
  )
}
