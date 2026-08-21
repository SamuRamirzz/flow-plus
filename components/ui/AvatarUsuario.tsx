// Círculo de avatar reutilizado en Perfil y Bienvenida: foto si hay una
// efectiva (subida o de Google), inicial del nombre si no. `next/image` no
// se usa a propósito — la foto de Google viene de un dominio externo
// (lh3.googleusercontent.com) que exigiría declararlo en next.config.ts, y
// la subida propia es igual de válida como <img> plano; no hay ningún LCP
// crítico acá que justifique la optimización.
type Props = { url: string | null; nombreParaInicial: string; size?: number; className?: string }

export default function AvatarUsuario({ url, nombreParaInicial, size = 80, className }: Props) {
  const estilo = { width: size, height: size }

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={estilo} className={`rounded-full object-cover flex-shrink-0 ${className ?? ''}`} />
  }

  return (
    <span
      style={{ ...estilo, fontSize: size * 0.35 }}
      className={`rounded-full bg-coral/15 text-coral flex items-center justify-center font-display font-semibold flex-shrink-0 ${className ?? ''}`}
    >
      {(nombreParaInicial || '?').charAt(0).toUpperCase()}
    </span>
  )
}
