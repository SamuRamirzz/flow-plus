export const PUNTOS_CLAVE_INFORME_AGENT_ID = 'puntos-clave-informe-agent'
export const PUNTOS_CLAVE_INFORME_AGENT_TRIGGER_EVENT = 'informe.puntos_clave_solicitados'

export type PuntosClaveInformeAgentOutput = {
  /** Frases ya validadas contra los datos. Vacío = usar el fallback. */
  puntos: string[]
}
