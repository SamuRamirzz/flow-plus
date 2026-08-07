import { LifeBuoy, Mail, FileText, ShieldCheck, ExternalLink } from 'lucide-react'
import FlujoEliminarCuenta from './FlujoEliminarCuenta'

// Sprint Soporte + Eliminación de cuenta — Parte A.
//
// Contacto por `mailto:` directo y no un formulario propio: el proyecto no
// tiene sistema de tickets (es un desarrollador solo manteniendo todo, ver
// PROJECT_CONTEXT.md) y un formulario que solo escribiera una fila en una
// tabla sin ningún proceso de revisión detrás sería peor que el correo
// directo — daría la falsa sensación de que hay un sistema atendiéndolo.
// Mismo correo que ya usan las páginas legales (components/legal/PiePaginaLegal.tsx).
const EMAIL_SOPORTE = 'samuelramic1@hotmail.com'
const ASUNTO_PRERELLENADO = encodeURIComponent('Soporte — Flow+')

export default function CategoriaSoporte() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-paper flex items-center gap-2">
          <LifeBuoy size={16} className="text-coral" />
          Soporte
        </h2>
        <p className="text-muted text-xs mt-1">Contacto, tus documentos legales, y gestión de tu cuenta.</p>
      </div>

      <a
        href={`mailto:${EMAIL_SOPORTE}?subject=${ASUNTO_PRERELLENADO}`}
        className="flex items-center justify-between gap-3 rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-3.5 hover:bg-panel-2/40 transition"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-coral/12 flex items-center justify-center">
            <Mail size={15} className="text-coral" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm text-paper font-medium">Escribirnos</span>
            <span className="block text-xs text-muted truncate">{EMAIL_SOPORTE}</span>
          </span>
        </span>
      </a>

      <div className="rounded-2xl bg-panel-glass backdrop-blur-xl overflow-hidden">
        {[
          { href: '/legal/terminos', label: 'Términos de Servicio', Icono: FileText },
          { href: '/legal/privacidad', label: 'Política de Privacidad', Icono: ShieldCheck },
        ].map(({ href, label, Icono }, i) => (
          <div key={href}>
            {/* `bg-line` real y no `border-t`: la directiva global de
                globals.css anula border-width en todo el proyecto — los
                paneles se separan con líneas de 1px propias, nunca con
                bordes de Tailwind. */}
            {i > 0 && <div className="h-px bg-line mx-4" />}
            <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-panel-2/40 transition">
              <span className="flex items-center gap-3 min-w-0">
                <Icono size={15} className="text-muted shrink-0" />
                <span className="text-sm text-paper">{label}</span>
              </span>
              <ExternalLink size={13} className="text-muted shrink-0" />
            </a>
          </div>
        ))}
      </div>

      <FlujoEliminarCuenta />
    </div>
  )
}
