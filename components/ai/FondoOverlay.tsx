'use client'
import { motion } from 'motion/react'
import DotField from '@/components/reactbits/DotField'

// Sprint Correcciones /ai — Parte 1. El fondo Dot Field y el destello vivían
// en la PANTALLA DE ENTRADA de /ai; su sitio real es el overlay inmersivo:
// es la experiencia a pantalla completa donde un fondo animado y una entrada
// dramática tienen sentido, no la pantalla de compose inicial.
//
// Va DENTRO del overlay (absolute, no fixed) y por debajo del contenido: el
// overlay pinta su propio color de fondo en el contenedor padre, así que
// esta capa queda sobre ese color y bajo la conversación.

// 🐛 `ancho`/`alto` son el tamaño FINAL del overlay (el viewport), no
// `inset-0`. Bug real encontrado en la verificación en navegador, no leyendo
// el código: DotField mide su canvas UNA sola vez, con
// `canvas.parentElement.getBoundingClientRect()` al montarse, y solo lo vuelve
// a medir ante un `window.resize`. La caja del overlay crece con un spring de
// motion (no dispara ningún resize de ventana), así que con `inset-0` el
// canvas quedaba con el tamaño de la píldora inicial: la grilla de puntos se
// veía SOLO en una franja arriba a la izquierda, con el resto del overlay
// vacío. Fijando el tamaño final desde el primer frame, el canvas nace bien
// medido y el `overflow: hidden` de la caja lo recorta mientras se expande.
type Props = { visible: boolean; ancho: number; alto: number }

export default function FondoOverlay({ visible, ancho, alto }: Props) {
  return (
    <div aria-hidden className="absolute left-0 top-0 overflow-hidden pointer-events-none" style={{ width: ancho, height: alto }}>
      {/* Resplandor ambiental: le da profundidad al fondo plano. Entra con
          un fade lento y se queda — es ambiente, no un efecto. */}
      <motion.div
        className="absolute left-1/2 top-[30%] h-[1000px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgba(255,107,77,0.45) 0%, rgba(255,84,112,0.22) 45%, transparent 72%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 0.5 : 0 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />

      {/* La grilla de puntos. `opacity` en vez de montar/desmontar: el
          componente reconstruye su grilla en cada montaje, y hacerlo a mitad
          de la animación de apertura se nota como un salto. */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <DotField
          dotRadius={1.3}
          dotSpacing={17}
          cursorRadius={420}
          bulgeStrength={48}
          glowRadius={210}
          gradientFrom="rgba(255, 107, 77, 0.34)"
          gradientTo="rgba(255, 84, 112, 0.18)"
          glowColor="#FF6B4D"
        />
      </motion.div>

      {/* Destello de entrada: sube desde fuera del overlay e ilumina la
          escena una sola vez. `pointer-events-none` heredado del contenedor
          — nunca bloquea escribir mientras se desvanece. */}
      {visible && <DestelloOverlay />}
    </div>
  )
}

const DURACION_DESTELLO = 1.5

function DestelloOverlay() {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.5, delay: DURACION_DESTELLO }}
    >
      <motion.div
        className="absolute left-1/2 h-[900px] w-[1400px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,107,77,0.5) 0%, rgba(255,84,112,0.25) 40%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
        // Entra desde debajo del overlay y sube hasta salir por arriba. El
        // pico de opacidad a mitad de camino es lo que lo hace leerse como
        // un barrido de luz y no como un elemento que aparece.
        initial={{ y: '110%', opacity: 0 }}
        animate={{ y: ['110%', '5%', '-25%'], opacity: [0, 0.85, 0] }}
        transition={{ duration: DURACION_DESTELLO, ease: 'easeInOut', times: [0, 0.55, 1] }}
      />
    </motion.div>
  )
}
