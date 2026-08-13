import path from 'node:path'
import { Font } from '@react-pdf/renderer'

// Sprint 18a — Identidad visual del PDF.
//
// ═══════════════════════════════════════════════════════════════════════════
// DECISIÓN: paleta CLARA siempre, sin importar el tema de la app.
// ═══════════════════════════════════════════════════════════════════════════
// Un PDF se imprime. El tema oscuro de Flow+ (ink #0B0D11 de fondo) gastaría
// tinta a mansalva y se vería mal en papel. Estos valores son los del tema
// claro de app/globals.css, copiados como literales: no hay CSS ni variables
// de tema en el servidor, así que no hay de dónde "leerlos" — y una copia
// silenciosamente desincronizada sería peor que una copia explícita.
export const PALETA = {
  fondo: '#FFFFFF', // panel (claro)
  fondoSuave: '#F1EEF9', // panel-2 (claro)
  texto: '#1C1B22', // paper (claro) — el texto, no el fondo
  textoSuave: '#726E82', // muted (claro)
  linea: '#E4E0F0', // line (claro)
  coral: '#FF6B4D', // acento — constante en ambos temas
  exito: '#16A34A', // success (claro)
  peligro: '#E5484D', // danger (claro)
} as const

export const ESPACIADO = {
  paginaX: 40,
  paginaY: 36,
  seccion: 18,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// FUENTES — por qué archivos locales y por qué ESTÁTICOS
// ═══════════════════════════════════════════════════════════════════════════
// @react-pdf/renderer NO hereda el CSS de la app: las fuentes hay que
// registrarlas explícitamente. Se descartaron dos alternativas:
//
//  - Fuentes estándar de PDF (Helvetica): cero archivos, pero el informe
//    perdería la identidad tipográfica de Flow+.
//  - Font.register() con una URL de Google Fonts: mete una descarga de red
//    de terceros en la ruta crítica de cada generación — más lento y capaz
//    de fallar en producción.
//
// 🔴 HALLAZGO IMPORTANTE, verificado antes de elegir los archivos: los TTF
// del repo de Google Fonts (ofl/spacegrotesk, ofl/inter) son FUENTES
// VARIABLES (`SpaceGrotesk[wght].ttf`), y @react-pdf/renderer NO las soporta
// (issue #1745, abierto desde 2022). Los archivos de public/fonts/ NO vienen
// de ahí: son las instancias ESTÁTICAS por peso que sirve fonts.gstatic.com
// (las mismas URLs que devuelve fonts.googleapis.com/css2), verificadas sin
// tabla `fvar`. Si algún día alguien los reemplaza por los del repo de
// Google, el PDF dejará de renderizar el texto correctamente.
//
// Licencia: ambas familias son SIL Open Font License (carpeta `ofl/` en el
// repo de Google Fonts), que permite empaquetar y redistribuir. El OFL.txt
// va junto a los archivos, como exige la licencia.
const DIR_FUENTES = path.join(process.cwd(), 'public', 'fonts')

let fuentesRegistradas = false

/**
 * Registra las fuentes UNA SOLA VEZ por proceso. `Font.register` es global y
 * acumulativo: llamarlo por request desperdiciaría trabajo y, con recargas
 * en caliente, puede duplicar familias.
 */
export function registrarFuentes(): void {
  if (fuentesRegistradas) return
  fuentesRegistradas = true

  Font.register({
    family: 'Inter',
    fonts: [
      { src: path.join(DIR_FUENTES, 'Inter-Regular.ttf'), fontWeight: 400 },
      { src: path.join(DIR_FUENTES, 'Inter-SemiBold.ttf'), fontWeight: 600 },
    ],
  })

  Font.register({
    family: 'SpaceGrotesk',
    fonts: [
      { src: path.join(DIR_FUENTES, 'SpaceGrotesk-Medium.ttf'), fontWeight: 500 },
      { src: path.join(DIR_FUENTES, 'SpaceGrotesk-Bold.ttf'), fontWeight: 700 },
    ],
  })

  // Desactiva el corte de palabras con guion ("Matemáti-cas"), que @react-pdf
  // aplica por defecto y se nota mucho en las celdas angostas de la tabla.
  //
  // 🐛 OJO con la firma: el callback recibe la palabra y debe devolver el
  // ARRAY DE SUS SÍLABAS. Devolver `[palabra]` es lo correcto ("una sola
  // sílaba, no la cortes"); devolver la palabra suelta (sin array) hace que
  // @react-pdf la trate como iterable de caracteres y se COMA el primer
  // carácter de cada palabra — bug real observado en la primera versión de
  // este informe ("Nada entregado aún" salió como "ada entregado aún").
  Font.registerHyphenationCallback((palabra) => [palabra])
}

export const TIPOGRAFIA = {
  display: 'SpaceGrotesk',
  cuerpo: 'Inter',
} as const
