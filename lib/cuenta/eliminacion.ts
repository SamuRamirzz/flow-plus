// Sprint Soporte + Eliminación de cuenta — lógica pura, sin I/O.
//
// PERÍODO DE GRACIA = 14 días exactos: decisión ya tomada por el usuario en
// el encargo, no una constante librada al criterio de esta sesión.

export const DIAS_GRACIA = 14

/**
 * Fecha/hora exacta en que una solicitud de eliminación se ejecutará, si
 * nadie la cancela antes. PURA: no lee `Date.now()`, así que es determinista
 * en los tests y se puede llamar tanto en el servidor (para el cron) como en
 * el cliente (para mostrar la fecha en el banner) sin que difieran por
 * desfase de reloj entre los dos.
 */
export function fechaEjecucion(solicitadaEn: string | Date, diasGracia: number = DIAS_GRACIA): Date {
  const base = typeof solicitadaEn === 'string' ? new Date(solicitadaEn) : solicitadaEn
  return new Date(base.getTime() + diasGracia * 24 * 60 * 60 * 1000)
}

/**
 * Si una solicitud ya cumplió su período de gracia y el cron debe ejecutarla.
 * Se usa tanto para filtrar en memoria (tests, o una segunda pasada de
 * seguridad tras la consulta SQL) como documentación ejecutable de qué
 * significa exactamente "los 14 días ya pasaron": estrictamente mayor o
 * igual, no "casi" — un usuario que cancela en el último segundo se salva.
 */
export function debeEjecutarse(solicitadaEn: string | Date, ahora: Date, diasGracia: number = DIAS_GRACIA): boolean {
  return ahora.getTime() >= fechaEjecucion(solicitadaEn, diasGracia).getTime()
}

/**
 * Cuántos días completos quedan hasta la ejecución — para el texto del
 * banner ("se eliminará en 6 días"). Redondea hacia arriba: si faltan 30
 * horas, son "2 días" en el sentido de "todavía no se cumplió ni un día
 * completo de gracia perdido", no "1 día" (que subestimaría el tiempo real
 * que le queda al usuario para arrepentirse).
 */
export function diasRestantes(solicitadaEn: string | Date, ahora: Date, diasGracia: number = DIAS_GRACIA): number {
  const msRestantes = fechaEjecucion(solicitadaEn, diasGracia).getTime() - ahora.getTime()
  return Math.max(0, Math.ceil(msRestantes / (24 * 60 * 60 * 1000)))
}
