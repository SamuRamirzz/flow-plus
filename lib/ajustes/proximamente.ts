// Sección Ajustes — mecanismo genérico y centralizado para listar
// funcionalidades en camino, sin construir un placeholder a mano por cada
// una. Agregar un ítem nuevo es agregar una entrada acá — nada de UI que
// tocar. Cuando una de estas se construye de verdad, ese sprint la saca de
// este array y la mueve a su categoría real (o a su propia sección), no se
// queda acá para siempre — es un mecanismo temporal por diseño.
//
// `icono` es el NOMBRE del ícono de lucide-react, no el componente — mismo
// criterio que lib/materias/asignarIcono.ts (la base/los datos no importan
// React); components/ajustes/CategoriaProximamente.tsx es quien resuelve el
// nombre al componente real, mismo patrón que components/ui/iconosMateria.tsx.
export type NombreIconoProximamente = 'HardDrive' | 'MessageCircle' | 'History' | 'CalendarRange' | 'Brain'

export type ItemProximamente = {
  id: string
  nombre: string
  icono: NombreIconoProximamente
  descripcion: string
}

export const PROXIMAMENTE: ItemProximamente[] = [
  {
    id: 'google-drive',
    nombre: 'Google Drive',
    icono: 'HardDrive',
    descripcion: 'Vincula tu cuenta para guardar y encontrar tus archivos de clase.',
  },
  {
    id: 'whatsapp',
    nombre: 'Recordatorios por WhatsApp',
    icono: 'MessageCircle',
    descripcion: 'Recibe tus avisos de tareas y exámenes directo en WhatsApp.',
  },
  {
    id: 'historial-ia',
    nombre: 'Historial de conversaciones',
    icono: 'History',
    descripcion: 'Vuelve a ver y retomar conversaciones anteriores con la IA.',
  },
  {
    id: 'vistas-dedicadas',
    nombre: 'Calendario y Pendientes',
    icono: 'CalendarRange',
    descripcion: 'Vistas dedicadas para tu calendario completo y tus tareas pendientes.',
  },
  {
    id: 'herramientas-estudio',
    nombre: 'Herramientas de estudio',
    icono: 'Brain',
    descripcion: 'Tarjetas de repaso y cuestionarios generados a partir de tus materias.',
  },
]
