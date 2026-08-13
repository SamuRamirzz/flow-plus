'use client'
import { motion } from 'motion/react'
import type { BloqueRespuesta } from '@/lib/ai/agents/taskManagement/types'
import TextoRico from './TextoRico'

// Sprint Rediseño /ai — Parte A.4. Renderizado de la presentación
// estructurada que devuelve la IA.
//
// Mismo lenguaje visual que ResultTaskRow (el patrón de tarjeta que ya
// funcionaba bien en el panel de TAREAS): `bg-panel-glass backdrop-blur-xl`
// + `rounded-2xl`, cero bordes (la directiva global de globals.css los anula
// igual). Tipografía `mono` solo donde son datos tabulados — en prosa se ve
// peor, no mejor.

const EASE = [0.16, 1, 0.3, 1] as const

type Props = { bloques: BloqueRespuesta[] }

export default function BloquesRespuesta({ bloques }: Props) {
  if (bloques.length === 0) return null

  return (
    <div className="space-y-2.5 mt-2.5">
      {bloques.map((bloque, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          // Escalonado suave: los bloques aparecen en orden de lectura, no
          // todos de golpe. Mismo ease que el resto del overlay.
          transition={{ duration: 0.32, delay: i * 0.06, ease: EASE }}
        >
          <Bloque bloque={bloque} />
        </motion.div>
      ))}
    </div>
  )
}

function Bloque({ bloque }: { bloque: BloqueRespuesta }) {
  if (bloque.tipo === 'texto') return <TextoRico texto={bloque.contenido} className="text-sm text-paper leading-relaxed" />
  if (bloque.tipo === 'lista') return <BloqueLista items={bloque.items} />
  if (bloque.tipo === 'lista_detallada') return <BloqueListaDetallada items={bloque.items} />
  if (bloque.tipo === 'tabla') return <BloqueTabla columnas={bloque.columnas} filas={bloque.filas} />
  return <BloqueRenglones pares={bloque.pares} />
}

// ── lista ──────────────────────────────────────────────────────────────────

function BloqueLista({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm text-paper leading-relaxed">
          <span className="text-coral shrink-0 mt-[3px] text-[10px]" aria-hidden="true">
            ●
          </span>
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ── lista_detallada ────────────────────────────────────────────────────────
// El caso que motivó el sprint: "materias duplicadas" debe verse como una
// entrada por materia con sus horarios debajo, no como una oración larga.

function BloqueListaDetallada({ items }: { items: { titulo: string; detalle: string[] }[] }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="px-4 py-3 rounded-2xl bg-panel-glass backdrop-blur-xl">
          <p className="text-sm font-semibold text-paper">{item.titulo}</p>
          {item.detalle.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {item.detalle.map((d, j) => (
                <p key={j} className="text-xs text-muted font-mono leading-relaxed">
                  {d}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── tabla ──────────────────────────────────────────────────────────────────
// Sin <table>: un grid con `gridTemplateColumns` se adapta mejor al ancho
// angosto del panel y evita el scroll horizontal que una tabla real produce
// en móvil. Los separadores son fondos, no bordes (directiva global).

function BloqueTabla({ columnas, filas }: { columnas: string[]; filas: string[][] }) {
  const plantilla = `repeat(${columnas.length}, minmax(0, 1fr))`

  return (
    <div className="rounded-2xl bg-panel-glass backdrop-blur-xl overflow-hidden">
      <div className="grid gap-x-3 px-4 py-2.5" style={{ gridTemplateColumns: plantilla }}>
        {columnas.map((c, i) => (
          <p key={i} className="text-[10px] font-mono uppercase tracking-wide text-muted truncate">
            {c}
          </p>
        ))}
      </div>
      {filas.map((fila, i) => (
        <div
          key={i}
          className={`grid gap-x-3 px-4 py-2.5 ${i % 2 === 0 ? 'bg-panel-2/40' : ''}`}
          style={{ gridTemplateColumns: plantilla }}
        >
          {fila.map((celda, j) => (
            <p key={j} className={`text-xs leading-relaxed ${j === 0 ? 'text-paper' : 'text-muted font-mono'}`}>
              {celda}
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── renglones ──────────────────────────────────────────────────────────────
// Ficha de pares etiqueta-valor. El separador es una línea de fondo de 1px
// (no `border`, que la directiva global anularía).

function BloqueRenglones({ pares }: { pares: { etiqueta: string; valor: string }[] }) {
  return (
    <div className="rounded-2xl bg-panel-glass backdrop-blur-xl px-4 py-1">
      {pares.map((par, i) => (
        <div key={i}>
          {i > 0 && <div className="h-px bg-line/60" aria-hidden="true" />}
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="text-xs text-muted shrink-0">{par.etiqueta}</span>
            <span className="text-sm text-paper text-right">{par.valor}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
