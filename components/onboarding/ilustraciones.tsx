'use client'

import { motion, type Variants } from 'motion/react'

// Sprint Onboarding — ilustraciones propias, una por paso.
//
// ───────────────────────────────────────────────────────────────────────────
// POR QUÉ SVG A MANO Y NO IMÁGENES GENERADAS
// ───────────────────────────────────────────────────────────────────────────
// El encargo dejaba abierto usar un generador de imágenes "SOLO si genera
// algo consistente con el resto de la identidad visual". No se usó, por tres
// razones concretas de este proyecto y no por preferencia:
//
//   1. Los colores tienen que ser los TOKENS, no valores parecidos. Estas
//      ilustraciones leen `var(--color-coral)`, `var(--color-paper)`, etc.,
//      así que responden solas al cambio de tema claro/oscuro (globals.css
//      redefine esos tokens en `[data-theme="light"]`). Un PNG/JPG quedaría
//      congelado en un tema y se vería mal en el otro.
//   2. `*, *::before, *::after { border-width: 0 !important }` (directiva de
//      diseño global) hace que la app entera no tenga una sola línea dura.
//      Un raster generado casi siempre trae contornos y sombras propias que
//      contradicen eso. Acá el `stroke` de SVG — que esa regla NO toca, va
//      por otra propiedad — se usa como trazo intencional, no como borde.
//   3. Peso y nitidez: 5 ilustraciones vectoriales pesan menos que una sola
//      imagen a 2x, y se ven iguales en cualquier densidad de pantalla.
//
// Lenguaje común de las cinco: viewBox 240×170, composición centrada, mucho
// aire, geometría mínima y abstracta (nunca literal), coral SOLO en el
// elemento que cuenta la idea del paso — el resto en paper/muted a baja
// opacidad para que el acento se lea.

// El trazo se dibuja solo (pathLength 0→1). `custom` = retraso, para
// escalonar los elementos dentro de una misma ilustración.
const trazo: Variants = {
  oculto: { pathLength: 0, opacity: 0 },
  visible: (retraso: number = 0) => ({
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { duration: 0.9, delay: retraso, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.3, delay: retraso } },
  }),
}

// Para lo que no es trazo (rellenos, puntos): entra escalando desde su
// propio centro. `transformBox: fill-box` es lo que hace que `scale` gire
// alrededor del elemento y no del origen del SVG — sin eso, cada forma
// entraría volando desde la esquina superior izquierda.
//
// ⚠️ Este variant termina en `opacity: 1`, así que PISA cualquier atributo
// `opacity` del elemento. Se descubrió en el navegador, no leyendo el
// código: la rejilla del paso 3 salía toda del mismo tono, sin distinguir
// celda ocupada de celda vacía, y los estilos calculados mostraban
// `opacity: 1` en las 15 celdas pese a tener `opacity={0.4}` en el JSX.
//
// Por eso las transparencias parciales de estas ilustraciones van SIEMPRE en
// `fillOpacity` / `strokeOpacity`, nunca en `opacity`: son propiedades
// distintas (`fill-opacity` y `stroke-opacity`), motion no las toca, y se
// multiplican con la `opacity` animada — o sea que la entrada sigue
// funcionando y la transparencia de diseño sobrevive.
const forma: Variants = {
  oculto: { opacity: 0, scale: 0.72 },
  visible: (retraso: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, delay: retraso, ease: [0.16, 1, 0.3, 1] },
  }),
}

const ORIGEN_PROPIO = { transformBox: 'fill-box', transformOrigin: 'center' } as const

type Props = { className?: string }

function Lienzo({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 240 170"
      fill="none"
      initial="oculto"
      animate="visible"
      className={className}
      // Decorativa: el texto del paso, al lado, ya dice lo mismo en palabras.
      // Anunciarla dos veces sería ruido para quien use lector de pantalla.
      aria-hidden="true"
    >
      {children}
    </motion.svg>
  )
}

/** Paso 1 — la marca. Tres corrientes que convergen en el "+" de Flow+. */
export function IlustracionBienvenida({ className }: Props) {
  return (
    <Lienzo className={className}>
      {/* Resplandor detrás del nodo — mismo recurso que el resto de la app
          usa para dar profundidad sin dibujar un borde. */}
      <motion.circle cx="176" cy="85" r="42" fill="var(--color-coral)" fillOpacity="0.12" variants={forma} custom={0.5} style={ORIGEN_PROPIO} />

      {[
        { d: 'M18 46C58 46 62 85 104 85C132 85 146 85 160 85', o: 0.55, r: 0 },
        { d: 'M18 85C58 85 70 85 104 85C132 85 146 85 160 85', o: 0.85, r: 0.12 },
        { d: 'M18 124C58 124 62 85 104 85C132 85 146 85 160 85', o: 0.55, r: 0.24 },
      ].map((c) => (
        <motion.path
          key={c.d}
          d={c.d}
          stroke="var(--color-paper)"
          strokeOpacity={c.o}
          strokeWidth="2.5"
          strokeLinecap="round"
          variants={trazo}
          custom={c.r}
        />
      ))}

      {/* Partículas viajando por las corrientes: lo que hace que la
          composición se lea como "flujo" y no como tres líneas quietas. */}
      {[
        { cy: 46, d: 0 },
        { cy: 85, d: 0.9 },
        { cy: 124, d: 1.8 },
      ].map((p) => (
        <motion.circle
          key={p.cy}
          r="3"
          fill="var(--color-coral)"
          initial={{ opacity: 0 }}
          animate={{ cx: [22, 100, 160], cy: [p.cy, 85, 85], opacity: [0, 1, 0] }}
          transition={{ duration: 2.6, delay: 1 + p.d, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
        />
      ))}

      <motion.g variants={forma} custom={0.75} style={ORIGEN_PROPIO}>
        <path d="M176 66V104" stroke="var(--color-coral)" strokeWidth="7" strokeLinecap="round" />
        <path d="M157 85H195" stroke="var(--color-coral)" strokeWidth="7" strokeLinecap="round" />
      </motion.g>
    </Lienzo>
  )
}

/** Paso 2 — /ai. Una burbuja de conversación que se convierte en tareas. */
export function IlustracionConversacion({ className }: Props) {
  return (
    <Lienzo className={className}>
      <motion.g variants={forma} custom={0} style={ORIGEN_PROPIO}>
        <path
          d="M20 40C20 31.7157 26.7157 25 35 25H92C100.284 25 107 31.7157 107 40V76C107 84.2843 100.284 91 92 91H48L33 105V91H35C26.7157 91 20 84.2843 20 76V40Z"
          fill="var(--color-panel-2)"
        />
      </motion.g>
      {[
        { y: 45, w: 56, r: 0.2 },
        { y: 58, w: 68, r: 0.3 },
        { y: 71, w: 40, r: 0.4 },
      ].map((l) => (
        <motion.path
          key={l.y}
          d={`M36 ${l.y}H${36 + l.w}`}
          stroke="var(--color-paper)"
          strokeOpacity="0.5"
          strokeWidth="4"
          strokeLinecap="round"
          variants={trazo}
          custom={l.r}
        />
      ))}

      {/* El salto: lo dicho se transforma en filas estructuradas. */}
      <motion.path
        d="M116 62C126 62 128 46 138 46"
        stroke="var(--color-coral)"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 5"
        variants={trazo}
        custom={0.55}
      />

      {[
        { y: 34, coral: true, r: 0.58 },
        { y: 68, coral: false, r: 0.68 },
        { y: 102, coral: false, r: 0.78 },
      ].map((t) => (
        <motion.g key={t.y} variants={forma} custom={t.r} style={ORIGEN_PROPIO}>
          <rect x="140" y={t.y} width="84" height="26" rx="13" fill="var(--color-panel-2)" />
          <circle cx="154" cy={t.y + 13} r="5" fill={t.coral ? 'var(--color-coral)' : 'var(--color-paper)'} fillOpacity={t.coral ? 1 : 0.35} />
          <path d={`M167 ${t.y + 13}H${t.coral ? 208 : 199}`} stroke="var(--color-paper)" strokeOpacity="0.4" strokeWidth="3.5" strokeLinecap="round" />
        </motion.g>
      ))}

      <motion.path
        d="M96 20L99 28L107 31L99 34L96 42L93 34L85 31L93 28L96 20Z"
        fill="var(--color-coral)"
        variants={forma}
        custom={0.85}
        style={ORIGEN_PROPIO}
      />
    </Lienzo>
  )
}

/** Paso 3 — /horario. La semana, y una fecha que sale sola de ella. */
export function IlustracionHorario({ className }: Props) {
  const columnas = [0, 1, 2, 3, 4]
  const filas = [0, 1, 2]
  // Bloques ocupados. El coral es el que "dispara" la fecha inferida.
  const ocupados = new Set(['0-1', '2-0', '3-2', '4-1'])
  const CORAL = '2-0'

  return (
    <Lienzo className={className}>
      {columnas.map((c) => (
        <motion.rect
          key={`h${c}`}
          x={30 + c * 38}
          y="22"
          width="20"
          height="5"
          rx="2.5"
          fill="var(--color-paper)"
          fillOpacity="0.3"
          variants={forma}
          custom={c * 0.05}
          style={ORIGEN_PROPIO}
        />
      ))}

      {filas.map((f) =>
        columnas.map((c) => {
          const clave = `${c}-${f}`
          const lleno = ocupados.has(clave)
          const esCoral = clave === CORAL
          return (
            <motion.rect
              key={clave}
              x={30 + c * 38}
              y={38 + f * 32}
              width="30"
              height="24"
              rx="8"
              fill={esCoral ? 'var(--color-coral)' : 'var(--color-panel-2)'}
              fillOpacity={lleno ? 1 : 0.4}
              variants={forma}
              custom={0.1 + (f * 5 + c) * 0.03}
              style={ORIGEN_PROPIO}
            />
          )
        })
      )}

      {/* Del bloque de clase sale la fecha de entrega — la idea entera del
          Sprint 7 en un trazo. */}
      <motion.path
        d="M121 66C121 96 148 108 168 130"
        stroke="var(--color-coral)"
        strokeOpacity="0.6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 5"
        variants={trazo}
        custom={0.5}
      />

      <motion.g variants={forma} custom={0.78} style={ORIGEN_PROPIO}>
        <rect x="146" y="132" width="72" height="26" rx="13" fill="var(--color-panel-2)" />
        <circle cx="160" cy="145" r="5" fill="var(--color-coral)" />
        <path d="M172 145H206" stroke="var(--color-paper)" strokeOpacity="0.45" strokeWidth="3.5" strokeLinecap="round" />
      </motion.g>
    </Lienzo>
  )
}

/** Paso 4 — recordatorios. Aviso a tiempo, y choques detectados. */
export function IlustracionRecordatorios({ className }: Props) {
  return (
    <Lienzo className={className}>
      {/* Ondas: el aviso saliendo. Se repiten en bucle suave para que el
          paso no se sienta congelado mientras se lee. */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx="120"
          cy="66"
          r={34 + i * 17}
          stroke="var(--color-coral)"
          strokeWidth="1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.32 - i * 0.09, 0] }}
          transition={{ duration: 2.4, delay: 0.5 + i * 0.28, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }}
        />
      ))}

      <motion.g variants={forma} custom={0.15} style={ORIGEN_PROPIO}>
        <path
          d="M120 26C130.5 26 139 34.5 139 45V58C139 64 142 68 145 71C146.6 72.6 145.5 76 143 76H97C94.5 76 93.4 72.6 95 71C98 68 101 64 101 58V45C101 34.5 109.5 26 120 26Z"
          fill="var(--color-panel-2)"
        />
        <path d="M112 82C112 86.4183 115.582 90 120 90C124.418 90 128 86.4183 128 82" stroke="var(--color-paper)" strokeOpacity="0.45" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="120" cy="26" r="6" fill="var(--color-coral)" />
      </motion.g>

      {/* Los días. Dos corales pegados = dos entregas el mismo día, que es
          exactamente lo que detecta `detectarColisiones`. */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const choque = i === 3
        return (
          <motion.rect
            key={i}
            x={54 + i * 22}
            y={callePorIndice(i)}
            width="14"
            height={choque ? 34 : 14}
            rx="7"
            fill={choque ? 'var(--color-coral)' : 'var(--color-paper)'}
            fillOpacity={choque ? 1 : 0.28}
            variants={forma}
            custom={0.5 + i * 0.06}
            style={ORIGEN_PROPIO}
          />
        )
      })}
    </Lienzo>
  )
}

// El día con choque se dibuja más alto y arranca antes, para que sobresalga
// de la fila en vez de solo cambiar de color (se distingue sin depender del
// color, que es lo que hace que también funcione para daltonismo).
function callePorIndice(i: number): number {
  return i === 3 ? 116 : 126
}

/** Paso 5 — cierre. Las tres capacidades girando alrededor de la marca. */
export function IlustracionEmpezar({ className }: Props) {
  return (
    <Lienzo className={className}>
      <motion.circle cx="120" cy="85" r="40" fill="var(--color-coral)" fillOpacity="0.1" variants={forma} custom={0.4} style={ORIGEN_PROPIO} />

      <motion.circle
        cx="120"
        cy="85"
        r="62"
        stroke="var(--color-paper)"
        strokeOpacity="0.18"
        strokeWidth="1.5"
        strokeDasharray="4 7"
        variants={trazo}
        custom={0.1}
      />

      {/* Órbita real: el grupo entero rota, así que los tres satélites se
          mueven juntos sin calcular posiciones a mano en cada frame. */}
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
      >
        <motion.g variants={forma} custom={0.6} style={ORIGEN_PROPIO}>
          <rect x="106" y="11" width="28" height="22" rx="9" fill="var(--color-panel-2)" />
          <path d="M114 22H126" stroke="var(--color-paper)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
        <motion.g variants={forma} custom={0.72} style={ORIGEN_PROPIO}>
          <rect x="164" y="112" width="26" height="26" rx="9" fill="var(--color-panel-2)" />
          <path d="M171 121H183M171 129H183" stroke="var(--color-paper)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
        <motion.g variants={forma} custom={0.72} style={ORIGEN_PROPIO}>
          <rect x="50" y="112" width="26" height="26" rx="9" fill="var(--color-panel-2)" />
          <circle cx="63" cy="125" r="5" fill="var(--color-paper)" fillOpacity="0.5" />
        </motion.g>
      </motion.g>

      <motion.g variants={forma} custom={0.82} style={ORIGEN_PROPIO}>
        <path d="M120 64V106" stroke="var(--color-coral)" strokeWidth="8" strokeLinecap="round" />
        <path d="M99 85H141" stroke="var(--color-coral)" strokeWidth="8" strokeLinecap="round" />
      </motion.g>
    </Lienzo>
  )
}
