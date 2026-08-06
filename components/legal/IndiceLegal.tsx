'use client'

export type ItemIndice = { id: string; numero: string; titulo: string }

// Sticky en desktop (lg:sticky), parte del flujo normal en móvil — ahí
// aparece arriba del contenido, como una tabla de contenidos clásica, sin
// necesidad de un toggle propio: con 12-15 secciones cortas como enlace no
// abruma como sí lo haría con el texto completo.
//
// El scroll suave lo da `scroll-smooth` en el contenedor (ver
// app/legal/layout.tsx) + `scroll-mt-24` en cada <h2> (TituloSeccion) para
// que el título no quede tapado bajo el encabezado — son anclas nativas
// (`href="#id"`), sin JS de por medio.
export default function IndiceLegal({ items }: { items: ItemIndice[] }) {
  return (
    <nav aria-label="Índice de contenidos" className="lg:sticky lg:top-8 lg:self-start rounded-2xl bg-panel-glass backdrop-blur-xl p-5 lg:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-coral mb-4">Índice</p>
      <ol className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-panel-2 hover:text-paper"
            >
              <span className="font-mono text-coral/70 shrink-0">{item.numero}</span>
              <span className="text-balance">{item.titulo}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
