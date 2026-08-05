'use client'
import { TabGroup, TabList, Tab } from '@headlessui/react'

const TABS = ['Hoy', 'Esta semana', 'Próxima semana']

type Props = { selectedIndex: number; onChange: (i: number) => void }

export default function AgendaTabs({ selectedIndex, onChange }: Props) {
  return (
    <TabGroup selectedIndex={selectedIndex} onChange={onChange}>
      <TabList className="flex gap-1 bg-panel-glass backdrop-blur-xl border border-line rounded-full p-1 w-fit">
        {TABS.map((label) => (
          <Tab
            key={label}
            className="text-xs font-medium px-4 py-1.5 rounded-full outline-none transition text-muted data-selected:bg-coral data-selected:text-ink data-hover:text-paper"
          >
            {label}
          </Tab>
        ))}
      </TabList>
    </TabGroup>
  )
}
