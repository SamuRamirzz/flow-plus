// Lista curada de zonas horarias — no las ~600 IANA completas, un select
// con esa cantidad de opciones es en sí mismo un mal diseño. Cubre
// Latinoamérica (el huso por defecto de la app, América/Bogotá, ya lo
// dice) más los husos globales más comunes.
//
// Compartida entre components/ajustes/CategoriaFechaHora.tsx (editar la
// preferencia ya guardada) y components/onboarding/CompletarPerfil.tsx
// (elegirla por primera vez) — un solo lugar si se agrega una zona nueva.
export const ZONAS = [
  { id: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { id: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { id: 'America/Lima', label: 'Lima (GMT-5)' },
  { id: 'America/Guayaquil', label: 'Quito / Guayaquil (GMT-5)' },
  { id: 'America/Caracas', label: 'Caracas (GMT-4)' },
  { id: 'America/La_Paz', label: 'La Paz (GMT-4)' },
  { id: 'America/Santiago', label: 'Santiago (GMT-4)' },
  { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { id: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { id: 'America/Montevideo', label: 'Montevideo (GMT-3)' },
  { id: 'America/New_York', label: 'Nueva York (GMT-5)' },
  { id: 'America/Chicago', label: 'Chicago (GMT-6)' },
  { id: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
  { id: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
  { id: 'UTC', label: 'UTC' },
]
