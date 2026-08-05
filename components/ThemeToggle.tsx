'use client'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      aria-label="Cambiar tema"
      className="fixed top-5 right-5 z-50 w-10 h-10 rounded-full bg-panel-glass backdrop-blur-xl border border-line flex items-center justify-center text-paper hover:border-coral transition"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}