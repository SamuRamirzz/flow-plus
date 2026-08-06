import type { CategoriaAjustesId } from '@/lib/ajustesModal'

// Mismo criterio que lib/horario/diff.ts::normalizarNombreMateria — no se
// importa de ahí porque ese módulo es de dominio de horario y arrastra sus
// propios tipos; acá solo hace falta la técnica, que son dos líneas.
// (No se usa \p{Diacritic}: tsconfig apunta a ES2017 y las property
// escapes son ES2018.)
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Buscar solo por el nombre de la categoría sería decorativo: con 6
// categorías visibles de un vistazo, escribir "Perfil" para filtrar a
// "Perfil" no le ahorra nada a nadie. Lo que sí sirve es buscar por lo que
// el usuario QUIERE hacer sin saber en qué categoría vive — "zona horaria",
// "modo oscuro", "salir". De ahí este mapa: son los términos por los que
// alguien buscaría cada ajuste, no sinónimos del título.
//
// Vive acá (y no dentro del componente) para que la búsqueda sea una
// función pura testeable, mismo criterio que el resto de lib/.
const PALABRAS_CLAVE: Record<CategoriaAjustesId, string[]> = {
  perfil: ['perfil', 'nombre', 'cuenta', 'usuario', 'correo', 'email', 'avatar', 'foto', 'google'],
  apariencia: ['apariencia', 'tema', 'oscuro', 'claro', 'modo', 'color', 'fondo', 'noche', 'dia'],
  'fecha-hora': ['fecha', 'hora', 'zona horaria', 'reloj', 'formato', '12h', '24h', 'huso', 'utc'],
  notificaciones: ['notificaciones', 'avisos', 'recordatorios', 'alertas', 'no molestar', 'silencio', 'limite', 'tope'],
  'google-drive': ['google drive', 'drive', 'archivos', 'almacenamiento', 'espacio', 'nube', 'vincular', 'desvincular', 'sincronizar'],
  // 'drive'/'archivos' salen de acá: ya no son "próximamente", tienen su
  // propia categoría con estado real — dejarlas duplicadas haría que buscar
  // "drive" devolviera dos resultados, uno de ellos falso.
  proximamente: ['proximamente', 'futuro', 'pronto', 'whatsapp', 'historial', 'estudio'],
  'cerrar-sesion': ['cerrar sesion', 'salir', 'logout', 'desconectar', 'sesion'],
}

type CategoriaBuscable = { id: CategoriaAjustesId; label: string }

/**
 * Filtra las categorías de Ajustes por texto libre. Una categoría entra si
 * la consulta aparece en su etiqueta visible o en alguna de sus palabras
 * clave. Consulta vacía o solo espacios devuelve la lista completa —
 * "sin filtro" nunca debe verse como "sin resultados".
 *
 * PURA: sin I/O, sin React. Se compara sin acentos y sin distinguir
 * mayúsculas, así que "sesion" encuentra "Cerrar sesión".
 */
export function buscarCategorias<T extends CategoriaBuscable>(consulta: string, categorias: T[]): T[] {
  const q = normalizar(consulta)
  if (q.length === 0) return categorias

  return categorias.filter((cat) => {
    if (normalizar(cat.label).includes(q)) return true
    return PALABRAS_CLAVE[cat.id].some((palabra) => normalizar(palabra).includes(q))
  })
}
