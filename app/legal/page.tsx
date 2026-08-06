import { redirect } from 'next/navigation'

// /legal por sí sola no tiene contenido propio — Privacidad y Términos ya
// se navegan entre sí vía el toggle de EncabezadoLegal. Sin esto, /legal
// (sin subruta) devolvía 404 pese a que RUTAS_PUBLICAS/RUTAS_SIN_NAVEGACION
// tratan todo el prefijo como una sola cosa.
export default function LegalIndexPage() {
  redirect('/legal/privacidad')
}
