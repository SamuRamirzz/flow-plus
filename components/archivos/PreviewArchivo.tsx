'use client'

import { useEffect, useState } from 'react'
import { FileX2, Loader2 } from 'lucide-react'
import type { Archivo } from '@/lib/archivos/tipos'
import { familiaDeArchivo } from '@/lib/archivos/formato'
import { urlContenido } from '@/lib/archivos/api'
import IconoArchivo from './IconoArchivo'

// Vista previa real del contenido, como pide la referencia.
//
// ─────────────────────────────────────────────────────────────────────────
// DECISIÓN: cero dependencias nuevas para el PDF.
// ─────────────────────────────────────────────────────────────────────────
// La opción "obvia" era pdfjs-dist para renderizar la primera página a un
// <canvas>. Se descartó: son ~1 MB de JS (más el worker) que cargarían en la
// sección Archivos entera, para conseguir lo mismo que el visor de PDF nativo
// del navegador ya hace gratis dentro de un <iframe>.
//
// Y no es una casualidad que funcione: `?inline=1` se construyó en el backend
// EXACTAMENTE para esto — su propio comentario dice "para que la UI de
// Archivos pueda mostrar la vista previa sin bajar el archivo". Con
// `Content-Disposition: attachment` (el default) el navegador descargaría en
// vez de renderizar.
//
// ⚠️ Consecuencia asumida: el contador "1 / 8" de la referencia NO se puede
// replicar. El número de páginas de un PDF solo se conoce parseándolo, que es
// justo la dependencia que se está evitando; el visor nativo muestra su
// propia paginación dentro del iframe. Se documenta como diferencia real con
// la referencia, no se finge con un "1 / 1" fijo.
//
// .docx/.xlsx tampoco se previsualizan: son ZIPs de XML: renderizarlos exige
// una librería pesada. Mismo criterio que `politicaDeAnalisis` en el backend,
// que los excluye del análisis de IA por la misma razón.

type Props = { archivo: Archivo }

export default function PreviewArchivo({ archivo }: Props) {
  const familia = familiaDeArchivo(archivo.mime_type, archivo.nombre)
  const url = urlContenido(archivo.id, 'inline')

  if (!archivo.drive_file_id) {
    return <SinPreview mensaje="Este archivo todavía no tiene contenido en Drive." archivo={archivo} />
  }

  if (familia === 'imagen') {
    // eslint-disable-next-line @next/next/no-img-element -- el contenido se sirve por un Route Handler autenticado, no por una URL pública que next/image pueda optimizar
    return <img src={url} alt={archivo.nombre} className="w-full max-h-64 object-contain rounded-2xl bg-panel-2" />
  }

  if (familia === 'pdf') {
    return (
      <div className="relative rounded-2xl overflow-hidden bg-panel-2 h-64">
        <iframe src={`${url}#toolbar=0&navpanes=0&view=FitH`} title={`Vista previa de ${archivo.nombre}`} className="w-full h-full" />
      </div>
    )
  }

  if (familia === 'texto') return <PreviewTexto url={url} nombre={archivo.nombre} />

  return <SinPreview mensaje={`Los archivos ${archivo.nombre.split('.').pop()?.toUpperCase() ?? 'de este tipo'} no se pueden previsualizar aquí.`} archivo={archivo} />
}

// Texto plano/markdown: se descarga y se muestra en monoespaciada. No se
// renderiza el markdown a HTML — haría falta un parser (otra dependencia) y
// para una vista previa de unos párrafos el texto crudo comunica lo mismo.
function PreviewTexto({ url, nombre }: { url: string; nombre: string }) {
  const [contenido, setContenido] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let activo = true
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => {
        if (activo) setContenido(t.slice(0, 4000))
      })
      .catch(() => {
        if (activo) setError(true)
      })
    return () => {
      activo = false
    }
  }, [url])

  if (error) return <div className="rounded-2xl bg-panel-2 p-4 text-xs text-muted">No se pudo cargar la vista previa de {nombre}.</div>
  if (contenido === null) {
    return (
      <div className="rounded-2xl bg-panel-2 h-40 flex items-center justify-center">
        <Loader2 size={18} className="animate-spin text-muted" />
      </div>
    )
  }

  return (
    <pre className="rounded-2xl bg-panel-2 p-4 text-[11px] leading-relaxed text-muted font-mono max-h-64 overflow-auto whitespace-pre-wrap break-words">{contenido}</pre>
  )
}

function SinPreview({ mensaje, archivo }: { mensaje: string; archivo: Archivo }) {
  return (
    <div className="rounded-2xl bg-panel-2 px-4 py-8 flex flex-col items-center text-center gap-3">
      <IconoArchivo mimeType={archivo.mime_type} nombre={archivo.nombre} tam={44} />
      <div>
        <p className="text-xs text-paper font-medium mb-1 flex items-center justify-center gap-1.5">
          <FileX2 size={13} className="text-muted" />
          Sin vista previa
        </p>
        <p className="text-[11px] text-muted leading-relaxed max-w-[18rem]">{mensaje}</p>
      </div>
    </div>
  )
}
