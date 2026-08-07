'use client'

export type ItemIndice = { id: string; numero: string; titulo: string }

// Sticky en desktop (lg:sticky), parte del flujo normal en móvil — ahí
// aparece arriba del contenido, como una tabla de contenidos clásica, sin
// necesidad de un toggle propio: con 12-15 secciones cortas como enlace no
// abruma como sí lo haría con el texto completo.
//
// En desktop, además, es su PROPIA región de scroll: si la lista de
// secciones no entra completa en el alto disponible, se desplaza SOLA (como
// una cápsula independiente) sin mover la página de fondo — y viceversa,
// hacer scroll del artículo no arrastra al índice, que sigue "sticky" en su
// sitio. `.scrollbar-oculta` (globals.css) le quita la barra nativa a esa
// región nada más: es un detalle de esta cápsula, no algo que deba
// aplicarse al scroll del resto de la página.
//
// Dos elementos, no uno — `sticky` y `overflow-y-auto` NO van juntos en el
// mismo nodo a propósito: verificado con Playwright (wheel real sobre el
// nodo con ambas propiedades a la vez) que Chromium enruta el scroll a la
// PÁGINA en vez de al propio elemento cuando un `position: sticky` también
// es el contenedor con overflow — el `<nav>` de afuera solo se posiciona
// (sticky + su propio límite de alto), el `<div>` de adentro es quien
// scrollea de verdad. Mismo patrón que cualquier "sidebar sticky con scroll
// interno" — separar responsabilidad de posición de responsabilidad de
// scroll evita el problema.
//
// El scroll suave lo da `scroll-smooth` en el contenedor (ver
// app/legal/layout.tsx) + `scroll-mt-24` en cada <h2> (TituloSeccion) para
// que el título no quede tapado bajo el encabezado — son anclas nativas
// (`href="#id"`), sin JS de por medio.
export default function IndiceLegal({ items }: { items: ItemIndice[] }) {
  return (
    <nav aria-label="Índice de contenidos" className="lg:sticky lg:top-8 lg:self-start rounded-2xl bg-panel-glass backdrop-blur-xl overflow-hidden">
      <div className="lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto scrollbar-oculta p-5 lg:p-6">
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
      </div>
    </nav>
  )
}
