// IMPURO a propósito — separado de dias.ts/inferirFecha.ts (que son puros
// y nunca llaman a new Date()) para que quede un único punto en todo el
// dominio de horario que lee el reloj real. Todo lo demás recibe `hoy`
// como parámetro.
//
// Usa getFullYear/getMonth/getDate (hora LOCAL del navegador), no
// toISOString().slice(0,10) (que es UTC) — para un preview del lado del
// cliente, lo correcto es la fecha tal como la ve el usuario en su propio
// reloj, no la fecha UTC, que puede ir un día adelantada o atrasada según
// la hora y el huso horario.
//
// SOLO PARA CLIENTE. En el navegador el reloj del proceso ES el del
// usuario, así que esto es exactamente lo correcto acá (AddTaskBar,
// ResultTaskRow).
//
// En el servidor NO: ahí el reloj del proceso es UTC en producción y no
// tiene por qué coincidir con el huso del usuario, así que los Route
// Handlers usan hoyEnZona() (lib/ai/context/fecha.ts) — la limitación que
// este comentario documentaba desde el Sprint 7 quedó resuelta en el
// Sprint 10, cuando POST/PATCH /api/tareas dejaron de llamar a esta
// función. Si vas a usar esto en código de servidor, casi seguro querés
// hoyEnZona() en su lugar.
export function hoyISOLocal(): string {
  const d = new Date()
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}
