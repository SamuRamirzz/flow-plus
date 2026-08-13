import { StyleSheet } from '@react-pdf/renderer'
import { ESPACIADO, PALETA, TIPOGRAFIA } from './tema'

// Sprint 18a — Estilos compartidos del PDF. `StyleSheet.create` es la API
// propia de @react-pdf/renderer: NO es CSS y no entiende Tailwind. Soporta un
// subconjunto de flexbox (sin grid, sin position:sticky, sin unidades rem).
//
// Nota sobre la directiva de cero-bordes de globals.css: acá NO aplica (no hay
// CSS). Las separaciones visuales se dibujan explícitamente con un View de
// altura 1 y color `linea` — el equivalente honesto de lo que en la app hace
// el backdrop-blur.

export const estilos = StyleSheet.create({
  pagina: {
    backgroundColor: PALETA.fondo,
    paddingHorizontal: ESPACIADO.paginaX,
    paddingTop: ESPACIADO.paginaY,
    // Espacio reservado para el pie fijo — sin esto, el contenido de la
    // última página se le monta encima.
    paddingBottom: ESPACIADO.paginaY + 18,
    fontFamily: TIPOGRAFIA.cuerpo,
    fontSize: 9.5,
    color: PALETA.texto,
  },

  // ── Encabezado ──────────────────────────────────────────────────────────
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  marca: { fontFamily: TIPOGRAFIA.display, fontWeight: 700, fontSize: 17, color: PALETA.texto },
  marcaAcento: { color: PALETA.coral },
  cabeceraDerecha: { alignItems: 'flex-end' },
  periodoTexto: { fontFamily: TIPOGRAFIA.display, fontWeight: 500, fontSize: 10.5, color: PALETA.texto },
  metaTexto: { fontSize: 8, color: PALETA.textoSuave, marginTop: 2 },
  reglaCabecera: { height: 2, backgroundColor: PALETA.coral, marginTop: 10, marginBottom: 4, width: 44 },

  // ── Secciones ───────────────────────────────────────────────────────────
  seccion: { marginTop: ESPACIADO.seccion },
  tituloSeccion: {
    fontFamily: TIPOGRAFIA.display,
    fontWeight: 700,
    fontSize: 11,
    color: PALETA.texto,
    marginBottom: 8,
  },
  separador: { height: 1, backgroundColor: PALETA.linea, marginTop: 4 },

  // ── Resumen ejecutivo (4 tarjetas) ──────────────────────────────────────
  filaTarjetas: { flexDirection: 'row', gap: 8 },
  tarjeta: { flex: 1, backgroundColor: PALETA.fondoSuave, borderRadius: 6, padding: 10 },
  tarjetaEtiqueta: { fontSize: 7.5, color: PALETA.textoSuave, textTransform: 'uppercase', letterSpacing: 0.4 },
  tarjetaValor: { fontFamily: TIPOGRAFIA.display, fontWeight: 700, fontSize: 20, color: PALETA.texto, marginTop: 5 },
  // El símbolo ▲/▼ va en la fuente de CUERPO (Inter) y más pequeño: no existe
  // en Space Grotesk, y meterlo en el mismo Text que el número hace que el
  // fallback de glifo lo solape. Ver el comentario de Tarjeta().
  tarjetaSimbolo: { fontFamily: TIPOGRAFIA.cuerpo, fontWeight: 600, fontSize: 13, marginRight: 4 },
  tarjetaDetalle: { fontSize: 8, color: PALETA.textoSuave, marginTop: 3 },

  // ── Texto corrido (Puntos clave) ────────────────────────────────────────
  parrafo: { fontSize: 9.5, color: PALETA.texto, lineHeight: 1.5, marginBottom: 3 },
  nota: { fontSize: 7.5, color: PALETA.textoSuave, marginTop: 6, fontStyle: 'normal' },

  // ── Tablas ──────────────────────────────────────────────────────────────
  filaEncabezadoTabla: {
    flexDirection: 'row',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: PALETA.linea,
  },
  filaTabla: { flexDirection: 'row', paddingVertical: 5, alignItems: 'center' },
  filaTablaAlterna: { backgroundColor: PALETA.fondoSuave },
  celdaEncabezado: { fontSize: 7.5, color: PALETA.textoSuave, textTransform: 'uppercase', letterSpacing: 0.3 },
  celda: { fontSize: 9 },
  celdaNumero: { fontSize: 9, textAlign: 'right' },
  puntoColor: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },

  // ── Estados vacíos ──────────────────────────────────────────────────────
  vacio: {
    backgroundColor: PALETA.fondoSuave,
    borderRadius: 6,
    padding: 12,
    fontSize: 9,
    color: PALETA.textoSuave,
  },

  // ── Pie ─────────────────────────────────────────────────────────────────
  pie: {
    position: 'absolute',
    bottom: 22,
    left: ESPACIADO.paginaX,
    right: ESPACIADO.paginaX,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: PALETA.textoSuave,
  },
})

/** Color semántico para un indicador de tendencia. */
export function colorTendencia(direccion: 'sube' | 'baja' | 'igual' | 'sin_comparacion'): string {
  if (direccion === 'sube') return PALETA.exito
  if (direccion === 'baja') return PALETA.peligro
  return PALETA.textoSuave
}
