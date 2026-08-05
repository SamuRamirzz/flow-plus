import InicioSection from '@/components/home/InicioSection'

// La sección Home real. Igual que `/agenda`, no comprueba la sesión: la
// cubre `proxy.ts` (redirige a /login sin sesión), y todo lo que
// `InicioSection` lee pasa por Route Handlers que ya exigen sesión por su
// cuenta.
export default function PaginaHome() {
  return <InicioSection />
}
