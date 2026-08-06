import type { Metadata } from 'next'
import ArchivosSection from '@/components/archivos/ArchivosSection'

export const metadata: Metadata = {
  title: 'Archivos — Flow+',
}

// Sección Archivos. Mismo criterio que /agenda: no comprueba la sesión acá —
// `proxy.ts` ya manda al login a quien no la tenga, y los 6 endpoints que
// esta pantalla consume exigen sesión por su cuenta (`requerirUsuario()`).
export default function PaginaArchivos() {
  return <ArchivosSection />
}
