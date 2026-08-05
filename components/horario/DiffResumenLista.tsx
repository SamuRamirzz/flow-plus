import type { DiffHorario } from '@/lib/horario/diff'
import { formatearHora, type FormatoReloj } from '@/lib/hora'

export const NOMBRE_DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

// `formato` sin default a propósito (mismo criterio que ProximasTareas/
// AccesosRapidos en components/home/): el llamador siempre es un client
// component que ya tiene `usePreferencias()` a mano, así que forzar el
// prop evita que un caller nuevo se olvide de pasarlo y quede pegado a 24h
// en silencio.
export function rango(inicio: string | null, fin: string | null, formato: FormatoReloj): string {
  if (!inicio && !fin) return 'sin hora'
  const fmt = (h: string) => formatearHora(h, formato)
  return `${inicio ? fmt(inicio) : '—'}${fin ? `–${fmt(fin)}` : ''}`
}

type Props = { diff: DiffHorario; formato: FormatoReloj }

// Extraído de PropuestaFoto (Sprint 8) en el Sub-sprint 8.2 para que
// ResolverImportacion pueda mostrar la misma lista de cambios sin duplicar
// el JSX — ambos componentes muestran "qué detectó la foto", solo cambia
// qué se ofrece hacer con eso.
export default function DiffResumenLista({ diff, formato }: Props) {
  const total = diff.agregados.length + diff.movidos.length + diff.eliminados.length
  if (total === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {diff.agregados.map((b, i) => (
        <p key={`a-${i}`} className="text-xs font-mono text-paper">
          <span className="text-success">+ nuevo</span> · {b.materia} · {NOMBRE_DIA[b.diaSemana]} {rango(b.horaInicio, b.horaFin, formato)}
        </p>
      ))}
      {diff.movidos.map((m, i) => (
        <p key={`m-${i}`} className="text-xs font-mono text-paper">
          <span className="text-coral">~ cambia</span> · {m.despues.materia} · {NOMBRE_DIA[m.despues.diaSemana]}{' '}
          <span className="text-muted line-through">{rango(m.antes.horaInicio, m.antes.horaFin, formato)}</span> → {rango(m.despues.horaInicio, m.despues.horaFin, formato)}
        </p>
      ))}
      {diff.eliminados.map((b) => (
        <p key={`e-${b.id}`} className="text-xs font-mono text-muted">
          <span className="text-danger">− sobra</span> · {NOMBRE_DIA[b.diaSemana]} {rango(b.horaInicio, b.horaFin, formato)}
          <span className="text-muted/70"> · no aparece en la foto, se queda salvo que lo borres a mano</span>
        </p>
      ))}
    </div>
  )
}
