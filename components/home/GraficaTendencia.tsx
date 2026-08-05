'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { SemanaCumplimiento } from '@/lib/estadisticas/agregacion'

type Props = { semanas: SemanaCumplimiento[] }

// Único componente del proyecto que importa recharts — todo lo demás en
// components/home/ es solo presentación sobre datos ya agregados.
//
// recharts dibuja sus ejes/grid con `stroke` de SVG, no con `border` de
// CSS — la directiva global `border-width: 0 !important` de globals.css NO
// lo alcanza, así que los bordes por defecto se apagan a mano acá
// (`axisLine={false}`, `tickLine={false}`) en vez de depender de esa regla.
function etiquetaSemana(inicioSemana: string): string {
  const [, mes, dia] = inicioSemana.split('-')
  return `${dia}/${mes}`
}

function TooltipPersonalizado({ active, payload }: { active?: boolean; payload?: Array<{ payload: SemanaCumplimiento }> }) {
  if (!active || !payload?.length) return null
  const semana = payload[0].payload
  return (
    <div className="bg-panel-glass backdrop-blur-xl rounded-xl px-3 py-2 shadow-2xl">
      <p className="text-[10px] font-mono uppercase tracking-wide text-muted mb-1">Semana del {etiquetaSemana(semana.inicioSemana)}</p>
      <p className="text-paper text-sm">
        <span className="text-coral font-semibold">{semana.completadas}</span> de {semana.total} completadas
      </p>
    </div>
  )
}

export default function GraficaTendencia({ semanas }: Props) {
  const datos = semanas.map((s) => ({ ...s, etiqueta: etiquetaSemana(s.inicioSemana) }))

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" strokeOpacity={0.4} />
          <XAxis dataKey="etiqueta" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }} width={24} />
          <Tooltip cursor={{ fill: 'var(--color-panel-2)', opacity: 0.5 }} content={<TooltipPersonalizado />} />
          <Bar dataKey="total" fill="var(--color-panel-2)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          <Bar dataKey="completadas" fill="var(--color-coral)" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
