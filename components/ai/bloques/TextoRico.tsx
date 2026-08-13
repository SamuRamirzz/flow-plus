'use client'
import { lineasDeTexto } from '@/lib/ai/markdownSimple'

// Sprint Rediseño /ai — Parte A.5. Pinta un texto de la IA respetando el
// markdown mínimo que se le pueda escapar (negrita/cursiva/código/viñetas),
// en vez de mostrar los asteriscos literales como hacía el <p> plano.
//
// La solución de fondo son los bloques estructurados; esto es la red de
// seguridad para el bloque 'texto' y para `mensaje`.

type Props = { texto: string; className?: string }

export default function TextoRico({ texto, className = '' }: Props) {
  const lineas = lineasDeTexto(texto)
  if (lineas.length === 0) return null

  const hayVinietas = lineas.some((l) => l.vinieta)

  // Si hay viñetas se arma una lista real (<ul>/<li>), no guiones sueltos
  // dentro de un párrafo — que es justo la diferencia que pedía el encargo.
  if (hayVinietas) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        {lineas.map((linea, i) =>
          linea.vinieta ? (
            <div key={i} className="flex gap-2">
              <span className="text-coral shrink-0 mt-[3px] text-[10px]" aria-hidden="true">
                ●
              </span>
              <span className="flex-1">
                <Fragmentos linea={linea} />
              </span>
            </div>
          ) : (
            <p key={i}>
              <Fragmentos linea={linea} />
            </p>
          )
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {lineas.map((linea, i) => (
        <p key={i}>
          <Fragmentos linea={linea} />
        </p>
      ))}
    </div>
  )
}

function Fragmentos({ linea }: { linea: ReturnType<typeof lineasDeTexto>[number] }) {
  return (
    <>
      {linea.fragmentos.map((f, i) => {
        if (f.negrita) return <strong key={i} className="font-semibold text-paper">{f.texto}</strong>
        if (f.cursiva) return <em key={i} className="italic">{f.texto}</em>
        if (f.codigo) return <code key={i} className="font-mono text-[0.92em] text-coral">{f.texto}</code>
        return <span key={i}>{f.texto}</span>
      })}
    </>
  )
}
