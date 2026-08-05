import AgendaHome from '@/components/AgendaHome'

// La app en sí. Vive en `/agenda` desde la reorganización — ver el comentario
// de lib/rutas.ts para el porqué (resumen: mientras `/` servía las dos cosas
// según la sesión, la landing quedaba inalcanzable para quien ya tenía
// cuenta).
//
// No comprueba la sesión: `proxy.ts` ya manda al login a quien no la tenga, y
// todo lo que esta pantalla lee pasa por Route Handlers que exigen sesión por
// su cuenta (`requerirUsuario()`). Sin sesión no habría datos que mostrar
// aunque alguien llegara hasta acá.
export default function PaginaAgenda() {
  return <AgendaHome />
}
