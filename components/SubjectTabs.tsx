type Materia = { id: string; nombre: string; color: string }
type Props = { materias: Materia[]; activa: string | null; onSelect: (id: string | null) => void; conteos: Record<string, number> }

export default function SubjectTabs({ materias, activa, onSelect, conteos }: Props) {
  return (
    <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`text-xs font-medium px-3.5 py-1.5 rounded-full flex-shrink-0 transition border backdrop-blur-sm ${
          activa === null ? 'bg-paper text-ink border-paper' : 'bg-panel-glass text-muted border-line hover:text-paper'
        }`}
      >
        Todas
      </button>
      {materias.map((m) => {
        const isActive = activa === m.id
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="text-xs font-medium pl-2.5 pr-3 py-1.5 rounded-full flex-shrink-0 transition flex items-center gap-1.5 border backdrop-blur-sm"
            style={{
              backgroundColor: isActive ? `${m.color}22` : 'var(--color-panel-glass)',
              borderColor: isActive ? m.color : 'var(--color-line)',
              color: isActive ? m.color : 'var(--color-muted)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />
            {m.nombre}
            <span className="opacity-60">{conteos[m.id] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}