// Foto de perfil — PURA, sin I/O, mismo criterio que saludo.ts.
//
// El avatar EFECTIVO viene de dos fuentes con una prioridad clara:
//   1. `avatar_url` de `perfil_academico` — la foto que el usuario SUBIÓ.
//      Es un override deliberado: si está puesta, gana siempre.
//   2. `user_metadata.avatar_url`/`picture` de los claims de Google — se lee
//      en vivo del JWT, igual que ya hace `nombreActual` con el nombre. Sin
//      guardar copia: así nunca queda desactualizada si el usuario cambia
//      su foto de Google, y no hace falta ningún trigger que la sincronice.
//
// Sin ninguna de las dos, `null` — quien lo consume cae al círculo con la
// inicial del nombre, que ya existe.

type MetadataAvatar = { avatar_url?: unknown; picture?: unknown } | null | undefined

export function avatarDeClaims(claims: unknown): string | null {
  if (!claims || typeof claims !== 'object') return null
  const meta = (claims as { user_metadata?: unknown }).user_metadata as MetadataAvatar
  if (!meta || typeof meta !== 'object') return null
  if (typeof meta.avatar_url === 'string' && meta.avatar_url.length > 0) return meta.avatar_url
  if (typeof meta.picture === 'string' && meta.picture.length > 0) return meta.picture
  return null
}

export function avatarEfectivo(avatarSubido: string | null | undefined, claims: unknown): string | null {
  if (avatarSubido) return avatarSubido
  return avatarDeClaims(claims)
}
