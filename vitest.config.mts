import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Entorno 'node' (no 'jsdom'): lib/ai todavía no tiene ningún componente
// React que probar, solo módulos TypeScript puros.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
})
