import React from 'react'
import { Document, Page, Text, View, Svg, Rect, Line, Polyline, Circle } from '@react-pdf/renderer'
import { fechaCorta, fechaLegible, fraccion, textoPorcentaje } from '../formato'
import { simboloDelta, simboloTendencia, textoDelta } from '../comparar'
import type { DatosInforme, FilaMateriaInforme, MetricasPeriodo, PuntoTendencia, SerieTendencia } from '../tipos'
import { colorTendencia, estilos } from './estilos'
import { PALETA, TIPOGRAFIA } from './tema'

// Sprint 18a — El documento. Recibe datos YA calculados (lib/informes/
// calcular.ts) y el texto de puntos clave YA resuelto (IA validada o
// fallback determinístico): este archivo no calcula nada ni sabe si hubo IA.

const NOMBRE_PERIODO: Record<DatosInforme['periodo'], string> = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  anual: 'Anual',
}

type Props = { datos: DatosInforme; puntosClave: string[] }

export function InformeDocumento({ datos, puntosClave }: Props) {
  return (
    <Document
      title={`Flow+ · Informe ${NOMBRE_PERIODO[datos.periodo]} · ${datos.etiquetaPeriodo}`}
      author="Flow+"
      creator="Flow+ (flowplus.space)"
    >
      <Page size="A4" style={estilos.pagina}>
        <Cabecera datos={datos} />
        <ResumenEjecutivo datos={datos} />
        <PuntosClave frases={puntosClave} />
        <DesglosePorMateria materias={datos.materias} />
        <Tendencia serie={datos.tendencia} />
        <Actividad datos={datos} />
        <Comparacion datos={datos} />
        {datos.superlativos && <Superlativos datos={datos} />}
        {datos.proximos.length > 0 && <LoQueViene datos={datos} />}
        <Pie />
      </Page>
    </Document>
  )
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * `partible` decide qué pasa cuando la sección no cabe en lo que queda de
 * página:
 *  - `false` (default): la sección salta ENTERA a la siguiente. Es lo correcto
 *    para las secciones cortas — sin esto el título se queda huérfano al pie
 *    de una página y su contenido aparece solo en la siguiente (bug real
 *    observado: "Lo que viene" con su única fila en una página 2 casi vacía).
 *  - `true`: solo para la tabla de materias, que con muchas filas SÍ debe
 *    poder partirse en vez de forzar un salto y desperdiciar media página.
 */
function Seccion({ titulo, children, partible = false }: { titulo: string; children: React.ReactNode; partible?: boolean }) {
  return (
    <View style={estilos.seccion} wrap={partible}>
      <Text style={estilos.tituloSeccion}>{titulo}</Text>
      {children}
    </View>
  )
}

function Cabecera({ datos }: { datos: DatosInforme }) {
  return (
    <View>
      <View style={estilos.cabecera}>
        <View>
          <Text style={estilos.marca}>
            Flow<Text style={estilos.marcaAcento}>+</Text>
            <Text> · Informe {NOMBRE_PERIODO[datos.periodo]}</Text>
          </Text>
          {datos.usuario.nombre && <Text style={estilos.metaTexto}>{datos.usuario.nombre}</Text>}
        </View>
        <View style={estilos.cabeceraDerecha}>
          <Text style={estilos.periodoTexto}>{datos.etiquetaPeriodo}</Text>
          <Text style={estilos.metaTexto}>Generado el {fechaLegible(datos.generadoEn)}</Text>
        </View>
      </View>
      <View style={estilos.reglaCabecera} />
    </View>
  )
}

/**
 * `simbolo` va en un `<Text>` APARTE del valor, no concatenado.
 *
 * 🐛 Bug real observado: al meter '▲ 5 pts' en un solo Text de 20pt con
 * fontFamily Space Grotesk, la flecha (que NO existe en esa fuente) resuelve
 * por fallback con métricas distintas y se SOLAPA con el número — se veía
 * "▲5" pisados. Separarlos y dar al símbolo su propia fuente de cuerpo, más
 * pequeña, lo resuelve sin depender de qué glifos traiga cada familia.
 */
function Tarjeta({
  etiqueta,
  valor,
  detalle,
  colorValor,
  simbolo,
}: {
  etiqueta: string
  valor: string
  detalle?: string
  colorValor?: string
  simbolo?: string
}) {
  return (
    <View style={estilos.tarjeta}>
      <Text style={estilos.tarjetaEtiqueta}>{etiqueta}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
        {simbolo ? <Text style={[estilos.tarjetaSimbolo, colorValor ? { color: colorValor } : {}]}>{simbolo}</Text> : null}
        <Text style={[estilos.tarjetaValor, { marginTop: 0 }, colorValor ? { color: colorValor } : {}]}>{valor}</Text>
      </View>
      {detalle ? <Text style={estilos.tarjetaDetalle}>{detalle}</Text> : null}
    </View>
  )
}

function ResumenEjecutivo({ datos }: { datos: DatosInforme }) {
  const { actual, comparacion } = datos
  const deltaComp = comparacion.completadas

  return (
    <Seccion titulo="Resumen ejecutivo">
      <View style={estilos.filaTarjetas}>
        <Tarjeta
          etiqueta="Tareas completadas"
          valor={textoPorcentaje(actual.porcentaje)}
          detalle={actual.total > 0 ? fraccion(actual.completadas, actual.total) : 'Sin tareas en el periodo'}
        />
        <Tarjeta
          etiqueta="Puntualidad"
          valor={textoPorcentaje(actual.porcentajePuntualidad)}
          // 🐛 Los textos de `detalle` deben ser CORTOS. Con 4 tarjetas en
          // fila cada caja queda en ~110pt, y @react-pdf recorta la primera
          // palabra en vez de envolver cuando el texto no cabe (bug real
          // observado: "Nada entregado aún" se renderizó como "ada entregado
          // aún"). Verificado en aislado que con más ancho el mismo texto sale
          // entero — es el ancho, no la fuente ni el hyphenation callback.
          detalle={
            actual.puntualidad.aTiempo + actual.puntualidad.tarde > 0
              ? `${actual.puntualidad.aTiempo} a tiempo · ${actual.puntualidad.tarde} tarde`
              : 'Sin entregas'
          }
        />
        <Tarjeta
          etiqueta="Racha"
          valor={`${actual.racha}`}
          detalle={actual.racha === 1 ? 'día sin vencidas' : 'días sin vencidas'}
        />
        <Tarjeta
          etiqueta="vs. periodo anterior"
          valor={textoDelta(deltaComp)}
          simbolo={simboloDelta(deltaComp)}
          detalle={deltaComp.comparable ? datos.etiquetaPeriodoPrevio : 'Sin datos previos'}
          colorValor={deltaComp.comparable ? colorTendencia(deltaComp.direccion) : PALETA.textoSuave}
        />
      </View>
    </Seccion>
  )
}

function PuntosClave({ frases }: { frases: string[] }) {
  return (
    <Seccion titulo="Puntos clave">
      {frases.map((f, i) => (
        <Text key={i} style={estilos.parrafo}>
          {f}
        </Text>
      ))}
    </Seccion>
  )
}

/** Tope de filas: con 19 materias la tabla desbordaría la página. */
const MAX_FILAS_MATERIA = 10

function DesglosePorMateria({ materias }: { materias: FilaMateriaInforme[] }) {
  if (materias.length === 0) {
    return (
      <Seccion titulo="Desglose por materia">
        <Text style={estilos.vacio}>No hubo tareas asignadas a ninguna materia en este periodo.</Text>
      </Seccion>
    )
  }

  const visibles = materias.slice(0, MAX_FILAS_MATERIA)
  const ocultas = materias.length - visibles.length

  return (
    <Seccion titulo="Desglose por materia" partible>
      <View style={estilos.filaEncabezadoTabla}>
        <Text style={[estilos.celdaEncabezado, { flex: 3 }]}>Materia</Text>
        <Text style={[estilos.celdaEncabezado, { flex: 1, textAlign: 'right' }]}>Compl.</Text>
        <Text style={[estilos.celdaEncabezado, { flex: 1, textAlign: 'right' }]}>Pend.</Text>
        <Text style={[estilos.celdaEncabezado, { flex: 1.2, textAlign: 'right' }]}>Puntual.</Text>
        <Text style={[estilos.celdaEncabezado, { flex: 0.8, textAlign: 'right' }]}>Tend.</Text>
      </View>

      {visibles.map((m, i) => (
        <View key={m.materiaId} style={[estilos.filaTabla, i % 2 === 1 ? estilos.filaTablaAlterna : {}]}>
          <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center' }}>
            <View style={[estilos.puntoColor, { backgroundColor: m.color }]} />
            <Text style={estilos.celda}>{m.nombre}</Text>
          </View>
          <Text style={[estilos.celdaNumero, { flex: 1 }]}>{m.completadas}</Text>
          <Text style={[estilos.celdaNumero, { flex: 1 }]}>{m.pendientes}</Text>
          <Text style={[estilos.celdaNumero, { flex: 1.2 }]}>{textoPorcentaje(m.porcentajePuntualidad)}</Text>
          {/* Fuente de cuerpo explícita: ▲/▼ no existen en Space Grotesk. */}
          <Text style={[estilos.celdaNumero, { flex: 0.8, color: colorTendencia(m.tendencia), fontFamily: TIPOGRAFIA.cuerpo }]}>
            {simboloTendencia(m.tendencia)}
          </Text>
        </View>
      ))}

      {ocultas > 0 && (
        <Text style={estilos.nota}>
          y {ocultas} materia{ocultas === 1 ? '' : 's'} más con menos actividad en este periodo.
        </Text>
      )}
    </Seccion>
  )
}

// ── Gráfico ────────────────────────────────────────────────────────────────
// Dibujado con los primitivos SVG de @react-pdf (Svg/Rect/Line/Polyline), sin
// ninguna librería de charting: recharts es client-side y no funciona acá.

// A4 son 595pt; con los 40pt de margen a cada lado quedan 515pt útiles. El
// gráfico se queda en 500: la etiqueta del último punto va centrada sobre él,
// así que media etiqueta sobresale hacia la derecha y necesita holgura.
const ANCHO_GRAFICO = 500
// El SVG ya solo contiene el trazado: las etiquetas del eje X viven fuera
// (ver el comentario en Tendencia), así que no hace falta reservar banda
// inferior para ellas.
const ALTO_GRAFICO = 110
const MARGEN_IZQ = 22
const MARGEN_INF = 4

function Tendencia({ serie }: { serie: SerieTendencia }) {
  const puntos = serie.puntos
  const maximo = Math.max(1, ...puntos.map((p) => p.total))
  const anchoUtil = ANCHO_GRAFICO - MARGEN_IZQ
  const altoUtil = ALTO_GRAFICO - MARGEN_INF

  const hayDatos = puntos.some((p) => p.total > 0)

  return (
    <Seccion titulo="Tendencia">
      {!hayDatos ? (
        <Text style={estilos.vacio}>Sin tareas con fecha de entrega en este periodo — todavía no hay una tendencia que dibujar.</Text>
      ) : (
        <View>
          <Svg width={ANCHO_GRAFICO} height={ALTO_GRAFICO}>
            {/* Eje Y: la escala real, para que las alturas sean legibles */}
            <Line x1={MARGEN_IZQ} y1={0} x2={MARGEN_IZQ} y2={altoUtil} strokeWidth={1} stroke={PALETA.linea} />
            <Line x1={MARGEN_IZQ} y1={altoUtil} x2={ANCHO_GRAFICO} y2={altoUtil} strokeWidth={1} stroke={PALETA.linea} />
            <SvgTexto x={MARGEN_IZQ - 4} y={8} texto={String(maximo)} ancla="end" />
            <SvgTexto x={MARGEN_IZQ - 4} y={altoUtil} texto="0" ancla="end" />

            {serie.granularidad === 'dia' ? (
              <Barras puntos={puntos} anchoUtil={anchoUtil} altoUtil={altoUtil} maximo={maximo} />
            ) : (
              <Lineas puntos={puntos} anchoUtil={anchoUtil} altoUtil={altoUtil} maximo={maximo} />
            )}

          </Svg>
          {/* Las etiquetas del eje X van FUERA del <Svg>, como Text normales
              en una fila flex. Dentro del SVG, @react-pdf recortaba el primer
              glifo de alguna etiqueta según su posición y el ancho del
              viewport (bug real: "Nov" salía como "ov" en el informe anual,
              reproducible solo con el gráfico completo, no con el eje
              aislado). Fuera del SVG no hay viewport que las recorte, y de
              paso el reparto por flex es exactamente el mismo que usa el
              cálculo de las coordenadas. */}
          {/* ⚠️ LÍMITE CONOCIDO, no resuelto: en el informe ANUAL, la etiqueta
              de noviembre se renderiza como "ov" (pierde la N). Solo esa, solo
              en anual — el resto de meses y las etiquetas de los informes
              semanal/mensual salen enteras.

              Descartados por reproducción AISLADA (cada uno replicado con la
              misma fórmula de posición y el mismo layout, y en todos los casos
              "Nov" salió completo): el hyphenation callback, el viewport y el
              textAnchor del <Svg>, el ancho del gráfico, la superposición del
              <Circle> del último punto, el layout flex de esta fila, y un
              U+200B de guarda. La combinación completa del documento sí lo
              reproduce, pero ninguna pieza por separado — apunta a un bug de
              @react-pdf en el subsetting de la fuente, no a estas coordenadas.

              Se deja documentado en vez de seguir parcheando a ciegas: es
              cosmético (una etiqueta de eje de 3 letras), los DATOS del gráfico
              son correctos, y el resto del informe no se ve afectado. */}
          <View style={{ flexDirection: 'row', marginLeft: MARGEN_IZQ, width: anchoUtil }}>
            {puntos.map((p) => (
              <Text key={p.clave} style={{ flex: 1, textAlign: 'center', fontSize: 6.5, color: PALETA.textoSuave }}>
                {p.etiqueta}
              </Text>
            ))}
          </View>
          <Leyenda />
        </View>
      )}
    </Seccion>
  )
}

/**
 * `<Text>` dentro de `<Svg>` necesita fontSize/fill explícitos (no hereda del
 * StyleSheet de la página).
 *
 * 🐛 `textAnchor` en vez de restar píxeles a mano para centrar: la primera
 * versión usaba `x - 8` como centrado aproximado, y con etiquetas de 3
 * caracteres el texto se salía del viewport del SVG y se RECORTABA — "Nov"
 * se renderizaba como "ov". El ancla es la forma correcta y no depende del
 * ancho del texto.
 */
function SvgTexto({ x, y, texto, ancla = 'start' }: { x: number; y: number; texto: string; ancla?: 'start' | 'middle' | 'end' }) {
  return (
    <Text x={x} y={y} textAnchor={ancla} style={{ fontSize: 6.5, fill: PALETA.textoSuave, fontFamily: TIPOGRAFIA.cuerpo }}>
      {texto}
    </Text>
  )
}

function Barras({ puntos, anchoUtil, altoUtil, maximo }: { puntos: PuntoTendencia[]; anchoUtil: number; altoUtil: number; maximo: number }) {
  const paso = anchoUtil / puntos.length
  const ancho = Math.max(6, paso * 0.5)
  return (
    <>
      {puntos.map((p, i) => {
        const x = MARGEN_IZQ + paso * i + (paso - ancho) / 2
        const hTotal = (p.total / maximo) * altoUtil
        const hHechas = (p.completadas / maximo) * altoUtil
        return (
          <React.Fragment key={p.clave}>
            {p.total > 0 && <Rect x={x} y={altoUtil - hTotal} width={ancho} height={hTotal} fill={PALETA.fondoSuave} />}
            {p.completadas > 0 && <Rect x={x} y={altoUtil - hHechas} width={ancho} height={hHechas} fill={PALETA.coral} />}
          </React.Fragment>
        )
      })}
    </>
  )
}

function Lineas({ puntos, anchoUtil, altoUtil, maximo }: { puntos: PuntoTendencia[]; anchoUtil: number; altoUtil: number; maximo: number }) {
  const paso = anchoUtil / puntos.length
  const coordenada = (valor: number, i: number) => {
    const x = MARGEN_IZQ + paso * (i + 0.5)
    const y = altoUtil - (valor / maximo) * altoUtil
    return { x, y }
  }
  const serieA = puntos.map((p, i) => coordenada(p.total, i))
  const serieB = puntos.map((p, i) => coordenada(p.completadas, i))

  return (
    <>
      <Polyline points={serieA.map((c) => `${c.x},${c.y}`).join(' ')} fill="none" stroke={PALETA.linea} strokeWidth={1.5} />
      <Polyline points={serieB.map((c) => `${c.x},${c.y}`).join(' ')} fill="none" stroke={PALETA.coral} strokeWidth={1.8} />
      {serieB.map((c, i) => (
        <Circle key={puntos[i].clave} cx={c.x} cy={c.y} r={2} fill={PALETA.coral} />
      ))}
    </>
  )
}

function Leyenda() {
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[estilos.puntoColor, { backgroundColor: PALETA.coral }]} />
        <Text style={{ fontSize: 7.5, color: PALETA.textoSuave }}>Completadas</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[estilos.puntoColor, { backgroundColor: PALETA.fondoSuave }]} />
        <Text style={{ fontSize: 7.5, color: PALETA.textoSuave }}>Total asignadas</Text>
      </View>
    </View>
  )
}

function Actividad({ datos }: { datos: DatosInforme }) {
  const { actividad } = datos
  return (
    <Seccion titulo="Actividad en Archivos y Notas">
      <View style={estilos.filaTarjetas}>
        <Tarjeta etiqueta="Archivos subidos" valor={String(actividad.archivosSubidos)} detalle={`Antes: ${datos.actividadPrevia.archivosSubidos}`} />
        <Tarjeta etiqueta="Notas creadas" valor={String(actividad.notasCreadas)} detalle={`Antes: ${datos.actividadPrevia.notasCreadas}`} />
        <Tarjeta etiqueta="Resúmenes de IA" valor={String(actividad.resumenesIA)} detalle={`Antes: ${datos.actividadPrevia.resumenesIA}`} />
      </View>
    </Seccion>
  )
}

function FilaComparacion({ etiqueta, actual, previo }: { etiqueta: string; actual: string; previo: string }) {
  return (
    <View style={estilos.filaTabla}>
      <Text style={[estilos.celda, { flex: 2 }]}>{etiqueta}</Text>
      <Text style={[estilos.celdaNumero, { flex: 1 }]}>{actual}</Text>
      <Text style={[estilos.celdaNumero, { flex: 1, color: PALETA.textoSuave }]}>{previo}</Text>
    </View>
  )
}

function Comparacion({ datos }: { datos: DatosInforme }) {
  const { actual, previo } = datos

  if (previo === null) {
    return (
      <Seccion titulo="Comparación con el periodo anterior">
        <Text style={estilos.vacio}>
          Sin datos de {datos.etiquetaPeriodoPrevio}: este es tu primer periodo con actividad registrada, así que todavía no hay
          con qué compararlo.
        </Text>
      </Seccion>
    )
  }

  const fmt = (m: MetricasPeriodo) => ({
    completadas: m.total > 0 ? `${textoPorcentaje(m.porcentaje)} (${fraccion(m.completadas, m.total)})` : '—',
    puntualidad: textoPorcentaje(m.porcentajePuntualidad),
    total: String(m.total),
  })
  const a = fmt(actual)
  const p = fmt(previo)

  return (
    <Seccion titulo="Comparación con el periodo anterior">
      <View style={estilos.filaEncabezadoTabla}>
        <Text style={[estilos.celdaEncabezado, { flex: 2 }]}>Métrica</Text>
        <Text style={[estilos.celdaEncabezado, { flex: 1, textAlign: 'right' }]}>{datos.etiquetaPeriodo}</Text>
        <Text style={[estilos.celdaEncabezado, { flex: 1, textAlign: 'right' }]}>{datos.etiquetaPeriodoPrevio}</Text>
      </View>
      <FilaComparacion etiqueta="Tareas completadas" actual={a.completadas} previo={p.completadas} />
      <FilaComparacion etiqueta="Puntualidad" actual={a.puntualidad} previo={p.puntualidad} />
      <FilaComparacion etiqueta="Tareas asignadas" actual={a.total} previo={p.total} />
    </Seccion>
  )
}

function Superlativos({ datos }: { datos: DatosInforme }) {
  const s = datos.superlativos
  if (!s) return null
  const hayAlguno = s.mejorMes || s.peorMes || s.materiaMasMejora
  return (
    <Seccion titulo="Lo más destacado del año">
      {!hayAlguno ? (
        <Text style={estilos.vacio}>Todavía no hay suficientes meses con actividad para destacar nada.</Text>
      ) : (
        <View>
          {s.mejorMes && (
            <Text style={estilos.parrafo}>
              Mejor mes: {s.mejorMes.etiqueta}, con {s.mejorMes.porcentaje} % de tareas completadas.
            </Text>
          )}
          {s.peorMes && (
            <Text style={estilos.parrafo}>
              Mes más flojo: {s.peorMes.etiqueta}, con {s.peorMes.porcentaje} %.
            </Text>
          )}
          {s.materiaMasMejora && (
            <Text style={estilos.parrafo}>
              Materia con más mejora: {s.materiaMasMejora.nombre}, {s.materiaMasMejora.deltaPuntos} puntos por encima del año anterior.
            </Text>
          )}
        </View>
      )}
    </Seccion>
  )
}

function LoQueViene({ datos }: { datos: DatosInforme }) {
  return (
    <Seccion titulo="Lo que viene">
      {datos.proximos.map((p, i) => (
        <View key={`${p.fecha}-${i}`} style={estilos.filaTabla}>
          <Text style={[estilos.celda, { flex: 0.9, color: PALETA.textoSuave }]}>{fechaCorta(p.fecha)}</Text>
          <Text style={[estilos.celda, { flex: 3 }]}>
            {p.esExamen ? 'Examen · ' : ''}
            {p.titulo}
            {p.materiaNombre ? ` · ${p.materiaNombre}` : ''}
          </Text>
          <Text style={[estilos.celdaNumero, { flex: 1, color: PALETA.textoSuave }]}>
            {p.diasRestantes === 1 ? 'en 1 día' : `en ${p.diasRestantes} días`}
          </Text>
        </View>
      ))}
    </Seccion>
  )
}

function Pie() {
  return (
    <View style={estilos.pie} fixed>
      <Text>flowplus.space</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}
