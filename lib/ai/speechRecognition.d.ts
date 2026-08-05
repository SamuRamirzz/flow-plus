// Sub-sprint 7.4 — la Web Speech API (dictado por voz) no está del todo
// estandarizada: TypeScript trae los tipos auxiliares en lib.dom.d.ts
// (SpeechRecognitionResult, SpeechRecognitionResultList,
// SpeechRecognitionAlternative) pero NO la interfaz principal
// (SpeechRecognition) ni su presencia en `Window` — se declara acá lo
// mínimo que usa lib/ai/useDictado.ts. Ambient (sin import/export a nivel
// de archivo) a propósito, para que aplique globalmente sin tener que
// importar este archivo en ningún lado.

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

interface Window {
  SpeechRecognition?: { new (): SpeechRecognition }
  webkitSpeechRecognition?: { new (): SpeechRecognition }
}
