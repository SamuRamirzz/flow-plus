import Link from 'next/link'

const EMAIL_CONTACTO = 'samuelramic1@hotmail.com'

export default function PiePaginaLegal({ actualizado }: { actualizado: string }) {
  return (
    <footer className="mt-16 pt-8 border-t-0 relative">
      {/* Separador propio en vez de un `border-t` real: la directiva global
          de globals.css anula cualquier borde, así que se usa una franja de
          1px de color en vez de depender de `border`. */}
      <div className="absolute top-0 left-0 right-0 h-px bg-line" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-muted">
        <p>Última actualización: {actualizado}</p>
        <p>
          ¿Preguntas? Escríbenos a{' '}
          <a href={`mailto:${EMAIL_CONTACTO}`} className="text-coral hover:underline">
            {EMAIL_CONTACTO}
          </a>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs">
        <Link href="/legal/privacidad" className="text-muted hover:text-paper transition">
          Política de Privacidad
        </Link>
        <Link href="/legal/terminos" className="text-muted hover:text-paper transition">
          Términos de Servicio
        </Link>
        <Link href="/" className="text-muted hover:text-paper transition">
          Volver a Flow+
        </Link>
      </div>
    </footer>
  )
}
