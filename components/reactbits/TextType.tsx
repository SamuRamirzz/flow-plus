'use client'

// Adaptado de React Bits (https://www.reactbits.dev/text-animations/text-type)
// para el Sub-sprint 7.5. La fuente original del registro (TextType-TS-TW)
// depende de `gsap` SOLO para el parpadeo del cursor (todo el ciclo de
// escribir/borrar es puro useState/setTimeout, sin animación de librería).
// En vez de sumar gsap como dependencia nueva del proyecto, el parpadeo se
// reimplementó con `motion/react` (ya instalado, mismo `repeat: Infinity` +
// `yoyo` que hacía gsap.to) — mismo comportamiento, cero dependencias
// nuevas. El resto de la lógica es una traducción fiel del original.
import { ElementType, useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { motion } from 'motion/react'

interface TextTypeProps {
  className?: string
  showCursor?: boolean
  hideCursorWhileTyping?: boolean
  cursorCharacter?: string | React.ReactNode
  cursorBlinkDuration?: number
  cursorClassName?: string
  text: string | string[]
  as?: ElementType
  typingSpeed?: number
  initialDelay?: number
  pauseDuration?: number
  deletingSpeed?: number
  loop?: boolean
  textColors?: string[]
  variableSpeed?: { min: number; max: number }
  onSentenceComplete?: (sentence: string, index: number) => void
  startOnVisible?: boolean
  reverseMode?: boolean
}

const TextType = ({
  text,
  as: Component = 'div',
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = '',
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = '|',
  cursorClassName = '',
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  ...props
}: TextTypeProps & React.HTMLAttributes<HTMLElement>) => {
  const [displayedText, setDisplayedText] = useState('')
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(!startOnVisible)
  const containerRef = useRef<HTMLElement>(null)

  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text])

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed
    const { min, max } = variableSpeed
    return Math.random() * (max - min) + min
  }, [variableSpeed, typingSpeed])

  const getCurrentTextColor = () => {
    if (textColors.length === 0) return 'inherit'
    return textColors[currentTextIndex % textColors.length]
  }

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
          }
        })
      },
      { threshold: 0.1 }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [startOnVisible])

  useEffect(() => {
    if (!isVisible) return

    let timeout: ReturnType<typeof setTimeout>

    const currentText = textArray[currentTextIndex]
    const processedText = reverseMode ? currentText.split('').reverse().join('') : currentText

    const executeTypingAnimation = () => {
      if (isDeleting) {
        if (displayedText === '') {
          setIsDeleting(false)
          if (currentTextIndex === textArray.length - 1 && !loop) {
            return
          }

          if (onSentenceComplete) {
            onSentenceComplete(textArray[currentTextIndex], currentTextIndex)
          }

          setCurrentTextIndex((prev) => (prev + 1) % textArray.length)
          setCurrentCharIndex(0)
          timeout = setTimeout(() => {}, pauseDuration)
        } else {
          timeout = setTimeout(() => {
            setDisplayedText((prev) => prev.slice(0, -1))
          }, deletingSpeed)
        }
      } else {
        if (currentCharIndex < processedText.length) {
          timeout = setTimeout(
            () => {
              setDisplayedText((prev) => prev + processedText[currentCharIndex])
              setCurrentCharIndex((prev) => prev + 1)
            },
            variableSpeed ? getRandomSpeed() : typingSpeed
          )
        } else if (textArray.length >= 1) {
          if (!loop && currentTextIndex === textArray.length - 1) return
          timeout = setTimeout(() => {
            setIsDeleting(true)
          }, pauseDuration)
        }
      }
    }

    if (currentCharIndex === 0 && !isDeleting && displayedText === '') {
      timeout = setTimeout(executeTypingAnimation, initialDelay)
    } else {
      executeTypingAnimation()
    }

    return () => clearTimeout(timeout)
  }, [
    currentCharIndex,
    displayedText,
    isDeleting,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    textArray,
    currentTextIndex,
    loop,
    initialDelay,
    isVisible,
    reverseMode,
    variableSpeed,
    onSentenceComplete,
    getRandomSpeed,
  ])

  const shouldHideCursor = hideCursorWhileTyping && (currentCharIndex < textArray[currentTextIndex].length || isDeleting)

  // JSX en vez de createElement(Component, { ref: containerRef, ... }): la
  // regla react-hooks/refs marca pasar un ref dentro de un objeto de props
  // "a mano" (createElement) como potencialmente leído durante el render;
  // con JSX (`<Component ref={...}>`) React lo maneja por su cuenta y la
  // regla queda satisfecha. Mismo resultado, la fuente original de React
  // Bits ya traía este patrón.
  return (
    // Ajuste — la fuente original de React Bits trae `whitespace-pre-wrap`
    // fijo acá adentro. Se fija explícito a `whitespace-normal` (en vez de
    // dejarlo implícito, o de forzar nowrap como en un ajuste anterior):
    // este componente solo tiene UN consumidor (el heading de /ai) y ese
    // consumidor SÍ necesita que el texto pueda envolver a una segunda
    // línea cuando la frase es larga — forzar una sola línea obligaba a un
    // ancho/alto fijo calculado sobre UNA frase de prueba, y cualquier
    // frase real más larga que esa terminaba cortada (ver el ajuste que
    // corrigió esto). El contenedor (app/ai/page.tsx) es quien reserva la
    // altura para el caso de 2 líneas, medida contra TODAS las frases
    // reales, no este componente.
    <Component ref={containerRef} className={`inline-block whitespace-normal tracking-tight ${className}`} {...props}>
      <span className="inline" style={{ color: getCurrentTextColor() || 'inherit' }}>
        {displayedText}
      </span>
      {showCursor && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: cursorBlinkDuration, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className={`ml-1 inline-block ${shouldHideCursor ? 'hidden' : ''} ${cursorClassName}`}
        >
          {cursorCharacter}
        </motion.span>
      )}
    </Component>
  )
}

export default TextType
