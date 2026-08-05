'use client'
import { useRef } from 'react'
import { Paperclip } from 'lucide-react'

type Props = {
  onSeleccionar: (archivos: File[]) => void
  deshabilitado?: boolean
}

// Sub-sprint 7.3.1 — ahora es SOLO el disparador (clip + input de archivo,
// admite varios a la vez): la lista de adjuntos ya elegidos vive en
// useAdjuntosPendientes() y se muestra con AdjuntosPendientesChips, no acá.
// Reusado tal cual en el composer principal de /ai y en el input de
// seguimiento dentro de la conversación (AIImmersiveOverlay).
export default function AdjuntoBoton({ onSeleccionar, deshabilitado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function elegirArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    // OJO: hay que copiar los File a un array ANTES de limpiar el input.
    // `e.target.files` es un FileList VIVO — poner `e.target.value = ''`
    // lo vacía en el sitio, así que guardar la referencia al FileList (sin
    // copiarla) y limpiar después deja `archivos.length` en 0 antes de
    // llegar a onSeleccionar. Los `File` individuales sí sobreviven a la
    // limpieza; el FileList que los contiene no.
    const archivos = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    if (archivos.length > 0) onSeleccionar(archivos)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/markdown,.txt,.md"
        onChange={elegirArchivos}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={deshabilitado}
        title="Adjuntar fotos, PDF o texto de una tarea"
        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-muted hover:text-paper hover:bg-panel-2/70 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Paperclip size={15} />
      </button>
    </>
  )
}
