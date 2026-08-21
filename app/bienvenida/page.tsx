import { redirect } from 'next/navigation'
import { getUserIdOpcional } from '@/lib/server/usuario'
import { clienteDeSesion } from '@/lib/server/sesion'
import { supabaseServer } from '@/lib/server/supabaseServer'
import { metadataDeClaims, nombreParaSaludo, nombreCompletoDeClaims, destinoSeguro } from '@/lib/onboarding/saludo'
import { avatarEfectivo } from '@/lib/onboarding/avatar'
import Bienvenida from '@/components/onboarding/Bienvenida'

// Sprint Onboarding — la pantalla que ve el usuario justo después de que su
// sesión queda confirmada. Ver el comentario largo en
// components/onboarding/Bienvenida.tsx para por qué es una ruta propia y no
// un estado de /login.
//
// Es un Server Component y eso importa: `esPrimeraVez` se decide ACÁ, contra
// la base, no con un parámetro en la URL. Si viajara como `?nuevo=1`,
// cualquiera podría forzar la rama que quisiera — inofensivo para la
// seguridad (solo cambia un texto), pero suficiente para que la decisión
// dejara de ser confiable. Leyéndolo en el servidor, la única fuente de
// verdad es la columna.

type Props = { searchParams: Promise<{ volverA?: string }> }

export default async function PaginaBienvenida({ searchParams }: Props) {
  // `proxy.ts` ya bloquea esta ruta sin sesión, pero se comprueba igual: los
  // propios docs de Next advierten que confiar solo en el proxy es frágil
  // ("a matcher change can silently remove Proxy coverage"), y acá el coste
  // de comprobarlo es una línea.
  const userId = await getUserIdOpcional()
  if (userId === null) redirect('/login?volverA=%2Fbienvenida')

  const { volverA } = await searchParams
  const destino = destinoSeguro(volverA)

  const [{ data: perfil }, supabase] = await Promise.all([
    supabaseServer.from('perfil_academico').select('onboarding_completado, apellido, pais, avatar_url').eq('user_id', userId).maybeSingle(),
    clienteDeSesion(),
  ])

  // Sin fila de perfil se asume primera vez. El trigger que lo crea se traga
  // sus propios errores a propósito (un registro nunca debe fallar por no
  // poder escribir el perfil — ver 20260803000000), así que "no hay perfil"
  // es un estado posible, y ante la duda es mejor mostrar la bienvenida de
  // más que escondérsela a alguien que nunca la vio.
  const esPrimeraVez = perfil?.onboarding_completado !== true

  // Paso "Completa tu perfil" — señal INDEPENDIENTE de esPrimeraVez: no
  // reusa onboarding_completado porque un usuario que YA completó el
  // onboarding antes de que estos campos existieran (el caso real de este
  // proyecto) nunca lo vería si dependiera de ese flag. Nullable como señal,
  // mismo criterio que ya usa `nombre` en esta tabla — la validación del
  // formulario garantiza que, una vez enviado, no queda a medias.
  const faltaPerfil = !perfil?.apellido || !perfil?.pais

  const { data: claims } = await supabase.auth.getClaims()
  // Dos nombres distintos, a propósito: `nombre` (primer nombre, "para el
  // saludo" — un saludo con el nombre completo suena a carta del banco) vs
  // `nombreCompleto` (para precargar el CAMPO del formulario de
  // CompletarPerfil.tsx — ahí sí hace falta el nombre entero, la misma
  // función que ya usa el autorelleno server-side de PATCH /api/perfil).
  const nombre = nombreParaSaludo(metadataDeClaims(claims?.claims))
  const nombreCompleto = nombreCompletoDeClaims(claims?.claims)
  const avatar = avatarEfectivo(perfil?.avatar_url ?? null, claims?.claims)

  return (
    <Bienvenida esPrimeraVez={esPrimeraVez} faltaPerfil={faltaPerfil} nombre={nombre} nombreCompleto={nombreCompleto} avatar={avatar} destino={destino} />
  )
}
