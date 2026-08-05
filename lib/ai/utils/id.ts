// Mismo esquema que el generador de ids de lib/toast.tsx: timestamp base36 +
// sufijo aleatorio, prefijado por dominio para que sea legible en logs.
export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}${random}`
}
