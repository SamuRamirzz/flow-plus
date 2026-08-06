// Primitivas tipográficas para el contenido de /legal — el proyecto no
// tiene instalado @tailwindcss/typography (verificado en package.json), así
// que en vez de depender de una clase `prose` no configurada, se definen acá
// un puñado de componentes chicos que reusan las mismas clases en las
// decenas de párrafos/listas que tienen estas dos páginas.

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-muted mb-4">{children}</p>
}

export function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2 mb-4 pl-0.5">{children}</ul>
}

export function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-[15px] leading-relaxed text-muted flex gap-2.5">
      <span className="text-coral mt-[2px] shrink-0" aria-hidden="true">
        ›
      </span>
      <span>{children}</span>
    </li>
  )
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-base font-semibold text-paper mt-6 mb-2">{children}</h3>
}

export function Fuerte({ children }: { children: React.ReactNode }) {
  return <strong className="text-paper font-medium">{children}</strong>
}
