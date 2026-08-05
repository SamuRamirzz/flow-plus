import { getUserIdOpcional } from '@/lib/server/usuario'
import Landing from '@/components/landing/Landing'

// `/` es SIEMPRE la landing pública. La app vive en `/agenda`.
//
// La versión anterior servía las dos cosas desde acá según la sesión, y eso
// tenía un defecto que solo se nota usándolo: con la sesión iniciada la
// landing dejaba de existir. No había forma de volver a verla sin cerrar
// sesión, y quien llegara por el enlace de marca teniendo cuenta caía en la
// app sin ver nunca la página que le compartieron.
//
// Sigue siendo un Server Component porque la landing sí necesita saber si hay
// sesión — no para decidir QUÉ mostrar, sino para que su botón principal
// lleve al sitio correcto: al login si no la hay, directo a la agenda si sí.
export default async function PaginaInicio() {
  const haySesion = (await getUserIdOpcional()) !== null
  return <Landing haySesion={haySesion} />
}
