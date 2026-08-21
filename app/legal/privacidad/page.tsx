import type { Metadata } from 'next'
import { Share2, ShieldCheck, Ghost, AlertTriangle } from 'lucide-react'
import EncabezadoLegal from '@/components/legal/EncabezadoLegal'
import IndiceLegal, { type ItemIndice } from '@/components/legal/IndiceLegal'
import PiePaginaLegal from '@/components/legal/PiePaginaLegal'
import TituloSeccion from '@/components/legal/TituloSeccion'
import Destacado from '@/components/legal/Destacado'
import { P, Lista, Item, Sub, Fuerte } from '@/components/legal/Texto'

export const metadata: Metadata = {
  title: 'Política de Privacidad — Flow+',
  description: 'Qué datos recolecta Flow+, cómo los usa la IA, con quién se comparten y qué derechos tenés sobre ellos.',
}

const ACTUALIZADO = '21 de agosto de 2026'

const ITEMS: ItemIndice[] = [
  { id: 'responsable', numero: '01', titulo: 'Quién es el responsable de tus datos' },
  { id: 'que-recolectamos', numero: '02', titulo: 'Qué datos recolectamos' },
  { id: 'como-los-obtenemos', numero: '03', titulo: 'Cómo obtenemos tus datos' },
  { id: 'para-que', numero: '04', titulo: 'Para qué usamos tus datos' },
  { id: 'ia', numero: '05', titulo: 'Cómo usamos la Inteligencia Artificial' },
  { id: 'con-quien', numero: '06', titulo: 'Con quién compartimos tus datos' },
  { id: 'transferencia', numero: '07', titulo: 'Transferencia internacional de datos' },
  { id: 'seguridad', numero: '08', titulo: 'Cómo protegemos tus datos' },
  { id: 'conservacion', numero: '09', titulo: 'Cuánto tiempo conservamos tus datos' },
  { id: 'derechos', numero: '10', titulo: 'Tus derechos sobre tus datos' },
  { id: 'menores', numero: '11', titulo: 'Menores de edad' },
  { id: 'invitado', numero: '12', titulo: 'Modo invitado' },
  { id: 'cookies', numero: '13', titulo: 'Cookies y almacenamiento local' },
  { id: 'cambios', numero: '14', titulo: 'Cambios a esta política' },
  { id: 'contacto', numero: '15', titulo: 'Contacto' },
]

export default function PoliticaPrivacidadPage() {
  return (
    <>
      <EncabezadoLegal activo="privacidad" />

      <header className="max-w-2xl mb-14">
        <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-coral mb-3">Documento legal</span>
        <h1 className="font-display text-[32px] sm:text-[42px] font-semibold text-paper tracking-tight leading-[1.1] mb-4">
          Política de Privacidad
        </h1>
        <P>
          Esta página explica, en el detalle real de cómo está construida la aplicación, qué datos recolecta Flow+, para qué los usa, con
          quién los comparte y qué podés hacer al respecto. Está escrita para ser leída por un estudiante, no por un abogado — si algo no
          queda claro, escribinos.
        </P>
      </header>

      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-10 lg:gap-16">
        <IndiceLegal items={ITEMS} />

        <div className="min-w-0">
          <Destacado icono={ShieldCheck} titulo="Lo esencial, antes de entrar en detalle">
            No vendemos tus datos a nadie, ni los usamos con fines publicitarios — Flow+ no tiene ningún rastreador de analítica ni
            publicidad integrado. La IA que usamos (Gemini, de Google) corre sobre un proyecto con facturación activa, lo que significa
            que <Fuerte>por defecto Google no usa tu contenido para entrenar sus modelos</Fuerte> (ver sección 05). El acceso a tu Google
            Drive está limitado a una carpeta propia de Flow+, nunca a todo tu Drive.
          </Destacado>

          <section className="mb-14">
            <TituloSeccion numero="01" id="responsable">
              Quién es el responsable de tus datos
            </TituloSeccion>
            <P>
              Flow+ (<Fuerte>flowplus.space</Fuerte>) es un proyecto personal — no una empresa constituida — operado y mantenido por una
              sola persona. A efectos de esta política, &ldquo;nosotros&rdquo;, &ldquo;Flow+&rdquo; o &ldquo;el operador de Flow+&rdquo; se
              refieren a quien administra y opera la aplicación.
            </P>
            <P>
              Cualquier solicitud relacionada con tus datos personales (acceso, corrección, eliminación, dudas) se atiende directamente por
              el canal de contacto de la sección 15.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="02" id="que-recolectamos">
              Qué datos recolectamos
            </TituloSeccion>
            <Sub>Datos de tu perfil</Sub>
            <Lista>
              <Item>Nombre y apellido — los que nos das al registrarte o los que trae tu cuenta de Google.</Item>
              <Item>
                Tu foto de perfil: la de tu cuenta de Google si iniciaste sesión así, o una que subas vos mismo desde Ajustes — podés
                quitarla en cualquier momento.
              </Item>
              <Item>País, zona horaria y formato de reloj (12h/24h) — para mostrarte fechas y horas correctas.</Item>
              <Item>Institución educativa, si la ingresás.</Item>
              <Item>Tu correo electrónico y el método con el que iniciás sesión (Google, o enlace mágico por correo — Flow+ no usa contraseñas).</Item>
              <Item>Tus preferencias de notificación (cuántas por día, horario de &ldquo;no molestar&rdquo;, y si querés recibirlas también por WhatsApp).</Item>
            </Lista>

            <Sub>Datos académicos</Sub>
            <Lista>
              <Item>Materias: nombre, color e ícono.</Item>
              <Item>Tareas: título, materia, fecha de entrega, prioridad, si está completada y cuándo.</Item>
              <Item>Datos de examen, cuando aplica: temario, formato (oral/escrito/proyecto/mixto) y el peso que tiene en tu nota.</Item>
              <Item>Tu horario de clases: día, hora, aula y profesor de cada bloque.</Item>
            </Lista>

            <Sub>Contenido que vos generás</Sub>
            <Lista>
              <Item>Notas de texto libre que escribís, ancladas o no a una tarea.</Item>
              <Item>
                Archivos que subís (PDFs, imágenes, documentos) y, si los analizás con IA, el resumen, tipo de documento y tareas que la
                IA detectó en ellos.
              </Item>
              <Item>
                La fecha y hora en que abriste o descargaste cada archivo por última vez — es lo que muestra la columna “Última apertura”
                en la sección Archivos. No registramos cuántas veces lo abriste ni desde dónde.
              </Item>
              <Item>El historial de tus conversaciones con el asistente de IA, incluidos los resúmenes que se generan de ellas.</Item>
              <Item>Las preguntas que le hacés a la IA sobre un archivo concreto, y sus respuestas, que se guardan como un hilo asociado a ese archivo.</Item>
            </Lista>

            <Sub>Datos de tu cuenta de Google (solo si conectás Google Drive)</Sub>
            <Lista>
              <Item>El correo de la cuenta de Google que vinculás.</Item>
              <Item>
                Un token de acceso a tu Drive, guardado <Fuerte>cifrado</Fuerte> (ver sección 08) — con un permiso limitado que se explica
                en la sección 06.
              </Item>
            </Lista>

            <Sub>Datos de WhatsApp (solo si lo vinculás)</Sub>
            <Lista>
              <Item>Tu número de teléfono, en el formato que nos das al pedir el código de vinculación.</Item>
              <Item>
                Un identificador interno de la conversación de WhatsApp — necesario porque WhatsApp a veces no revela tu número real al
                proveedor que usamos (ver sección 06), así que a esa persona hay que reconocerla por otra vía.
              </Item>
              <Item>Un registro de los comandos que le escribís al asistente por WhatsApp (qué pediste y si se pudo hacer).</Item>
            </Lista>
            <P>
              Un matiz importante sobre ese último punto: solo guardamos el <Fuerte>contenido</Fuerte> de mensajes que son un intento de
              vincularte o un comando dirigido a Flow+. Cualquier otro mensaje a ese número (por ejemplo, de alguien que todavía no
              vinculó su cuenta) recibe una respuesta automática fija explicando cómo vincularse, pero <Fuerte>lo que esa persona
              escribió no se guarda</Fuerte> en ningún lado — ver el detalle en la sección 08.
            </P>

            <Sub>Datos técnicos internos</Sub>
            <Lista>
              <Item>
                Un registro técnico de qué funciones de IA se ejecutaron y si tuvieron éxito — este registro <Fuerte>no incluye</Fuerte> el
                contenido de tus mensajes ni de tus tareas, solo metadata de ejecución (qué función corrió, cuándo, si falló).
              </Item>
              <Item>
                Una memoria interna que la IA usa para no repetirse entre sesiones (por ejemplo, para no proponerte una materia duplicada).
              </Item>
              <Item>Un registro de qué avisos internos ya te mostramos, para no repetírtelos el mismo día.</Item>
            </Lista>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="03" id="como-los-obtenemos">
              Cómo obtenemos tus datos
            </TituloSeccion>
            <Lista>
              <Item>
                <Fuerte>Directamente de vos</Fuerte>: cuando te registrás, creás una tarea, escribís una nota, subís un archivo o le
                escribís al asistente de IA.
              </Item>
              <Item>
                <Fuerte>De Google</Fuerte>, si elegís iniciar sesión con tu cuenta de Google (nombre, correo y foto de perfil) o si
                conectás Google Drive (correo de esa cuenta y el token de acceso descrito arriba).
              </Item>
              <Item>
                <Fuerte>Por WhatsApp</Fuerte>, si vinculás tu número: los mensajes que le escribís al asistente por ese canal.
              </Item>
              <Item>
                <Fuerte>Calculados por nosotros</Fuerte> a partir de lo anterior: las estadísticas de rendimiento (racha, puntualidad,
                tendencia semanal) y los resúmenes que genera la IA son vistas derivadas de datos que ya tenés — no son una categoría de
                dato nueva ni se recolectan por separado.
              </Item>
            </Lista>
            <P>
              Si usás Flow+ <Fuerte>sin registrarte</Fuerte> (modo invitado), nada de esto llega a nuestros servidores hasta que decidís
              crear una cuenta — ver sección 12.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="04" id="para-que">
              Para qué usamos tus datos
            </TituloSeccion>
            <Lista>
              <Item>Para operar el servicio: mostrarte tus tareas, horario, notas y archivos, y mantener tu sesión iniciada.</Item>
              <Item>Para personalizar la experiencia: fechas y horas en tu zona horaria, formato de reloj, evitar materias duplicadas.</Item>
              <Item>Para avisarte, dentro de la app, sobre tareas próximas a vencer (ver sección 13 sobre cómo funciona esto — nunca por correo ni notificación push hoy).</Item>
              <Item>
                Para que el asistente de IA pueda ayudarte: crear o editar tareas, notas y bloques de horario por texto, voz o foto, leer
                horarios desde una foto, analizar archivos que subís y responder tus preguntas sobre ellos.
              </Item>
              <Item>Para que puedas gestionar tu agenda por WhatsApp, si lo vinculás — crear tareas, consultar tu horario y recibir recordatorios ahí.</Item>
              <Item>Para generar informes descargables en PDF de tu actividad (semanal, mensual o anual), cuando los pedís desde Ajustes.</Item>
            </Lista>
            <Destacado icono={Share2} titulo="Lo que nunca hacemos con tus datos" tono="positivo">
              No los usamos con fines publicitarios, no los vendemos ni los alquilamos a terceros, y no hay ningún servicio de analítica o
              publicidad (Google Analytics, Meta Pixel, o similar) integrado en Flow+.
            </Destacado>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="05" id="ia">
              Cómo usamos la Inteligencia Artificial
            </TituloSeccion>
            <P>
              Flow+ usa <Fuerte>Gemini</Fuerte>, el modelo de inteligencia artificial de Google, para varias funciones: extraer tareas de
              un texto o de una foto de horario, analizar archivos que subís (PDF, imágenes, texto), responder preguntas sobre tus
              archivos y generar resúmenes de tus conversaciones con el asistente.
            </P>
            <Sub>Qué contenido le llega a Gemini</Sub>
            <Lista>
              <Item>El texto que le escribís al asistente (incluido texto que dictaste por voz — ver el matiz sobre audio abajo).</Item>
              <Item>Fotos de tu horario de clases, cuando elegís importarlo así.</Item>
              <Item>El contenido de los archivos que subís, cuando pedís que se analicen.</Item>
              <Item>El contenido de tus notas, cuando le preguntás algo relacionado con ellas.</Item>
              <Item>Los mensajes que le escribís al asistente por WhatsApp, si lo vinculaste — se procesan igual que los que escribís dentro de la app.</Item>
            </Lista>
            <Sub>Sobre los informes en PDF</Sub>
            <P>
              La sección de &ldquo;puntos clave&rdquo; de un informe la redacta la IA a partir de datos ya agregados tuyos (cifras
              calculadas, nunca el título o el id de una tarea puntual) — antes de mostrarla, verificamos automáticamente que ningún
              número que mencione sea inventado. Si detectamos uno que no está en tus datos reales, descartamos ese texto entero y el
              informe muestra en su lugar un resumen calculado directamente, sin pasar por la IA.
            </P>
            <Sub>Sobre el audio de tu voz</Sub>
            <P>
              El dictado por voz usa el reconocimiento de voz que ya trae tu navegador (Web Speech API) — Flow+{' '}
              <Fuerte>no envía el audio a sus propios servidores</Fuerte>, solo recibe el texto ya transcrito. Con matiz honesto: según el
              navegador que uses, esa transcripción puede depender de un servicio de reconocimiento de voz del propio fabricante del
              navegador (por ejemplo, en navegadores basados en Chromium, un servicio de Google) fuera del control de Flow+.
            </P>
            <Sub>¿Google entrena sus modelos con lo que le mandamos?</Sub>
            <P>
              Según la política pública de la API de Gemini, esto depende de si el proyecto que usa la API tiene facturación activa
              (nivel pagado) o no (nivel gratuito). En el nivel pagado, Google declara que{' '}
              <Fuerte>no usa las peticiones ni las respuestas para mejorar o entrenar sus modelos</Fuerte> — solo las retiene hasta 55 días
              para detección de abuso. En el nivel gratuito, sí puede usarlas para mejorar sus productos, y personas revisoras humanas
              pueden llegar a leerlas.
            </P>
            <P>
              El proyecto de Google Cloud que usa Flow+ tiene facturación activa, por lo que hoy aplican los términos del nivel pagado. Lo
              declaramos con esta precisión — y no como una garantía absoluta e inmutable — porque depende de una configuración externa a
              esta página (que la facturación se mantenga activa), no de una promesa contractual de Google específica para Flow+.
            </P>
            <Sub>Los límites de la IA</Sub>
            <P>
              La IA puede cometer errores: interpretar mal una fecha, resumir de forma imprecisa, o no detectar una tarea real dentro de un
              documento. Siempre podés revisar y corregir lo que propone antes de que se guarde — no toma decisiones irreversibles sin tu
              confirmación.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="06" id="con-quien">
              Con quién compartimos tus datos
            </TituloSeccion>
            <P>Solo compartimos datos con los proveedores que necesitamos para operar el servicio — nunca con fines comerciales o publicitarios.</P>
            <Sub>Supabase — base de datos, inicio de sesión y almacenamiento</Sub>
            <P>
              Supabase aloja nuestra base de datos (toda la información descrita en la sección 02), gestiona el inicio de sesión, y guarda
              temporalmente los archivos que subís mientras se procesan. No tenemos control directo sobre la ubicación exacta de sus
              servidores; puede estar fuera de Colombia (ver sección 07).
            </P>
            <Sub>Google — inicio de sesión, Drive y la IA</Sub>
            <Lista>
              <Item>
                <Fuerte>Inicio de sesión</Fuerte>: si elegís entrar con tu cuenta de Google, Google nos confirma tu identidad (a través de
                Supabase) y comparte tu nombre y correo.
              </Item>
              <Item>
                <Fuerte>Google Drive</Fuerte>: si lo conectás, Flow+ pide un permiso llamado <Fuerte>drive.file</Fuerte> — el más
                restrictivo que ofrece Google para archivos. Con este permiso, Flow+ <Fuerte>solo puede ver y modificar los archivos que
                la propia app crea</Fuerte>{' '}
                (dentro de una carpeta &ldquo;Flow+&rdquo; que crea en tu Drive) — nunca el resto de tu Drive, tus fotos,
                ni tus otros documentos.
              </Item>
              <Item>
                <Fuerte>Gemini (IA)</Fuerte>: como se explica en la sección 05.
              </Item>
            </Lista>
            <Sub>Whapi.Cloud — el canal de WhatsApp (solo si lo vinculás)</Sub>
            <P>
              Si vinculás WhatsApp, tus mensajes pasan por <Fuerte>Whapi.Cloud</Fuerte>, un proveedor que conecta aplicaciones a WhatsApp
              mediante una sesión de dispositivo vinculada — el mismo mecanismo que usa &ldquo;WhatsApp Web&rdquo; — y no la API oficial de
              negocios de Meta.
            </P>
            <P>
              Con honestidad sobre cómo está montado hoy: el número al que le escribís es una cuenta de WhatsApp que funciona como el
              canal de Flow+, vinculada de esa forma. Los mensajes pasan por esa sesión antes de llegar a nuestro servidor, igual que
              pasarían por cualquier dispositivo vinculado a un WhatsApp. Nadie los lee manualmente de nuestro lado — el procesamiento
              real lo hace el mismo asistente de IA que ya usás dentro de la app (sección 05), no una persona.
            </P>
            <Sub>Vercel — donde vive la aplicación</Sub>
            <P>Flow+ está desplegado y se sirve desde la infraestructura de Vercel.</P>
            <Sub>Proveedor de dominio/DNS</Sub>
            <P>El dominio flowplus.space está gestionado a través de un proveedor de registro de dominios (Namecheap), que resuelve el DNS del sitio.</P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="07" id="transferencia">
              Transferencia internacional de datos
            </TituloSeccion>
            <P>
              Los proveedores descritos en la sección anterior (Supabase, Google, Vercel) operan con infraestructura que, en la práctica,
              puede estar fuera de Colombia — típicamente en Estados Unidos. La Ley 1581 de 2012 exige que este tipo de transferencia
              cuente con tu autorización expresa cuando el país receptor no esté en la lista de países con nivel adecuado de protección de
              datos que reconoce la Superintendencia de Industria y Comercio (SIC).
            </P>
            <P>Al usar Flow+ y aceptar esta política, autorizás expresamente esta transferencia, necesaria para poder prestarte el servicio.</P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="08" id="seguridad">
              Cómo protegemos tus datos
            </TituloSeccion>
            <Lista>
              <Item>
                El token de acceso a tu cuenta de Google se guarda <Fuerte>cifrado con AES-256-GCM</Fuerte> — un estándar de cifrado
                fuerte — y nunca en texto plano en la base de datos. La clave de cifrado se guarda por separado del dato cifrado.
              </Item>
              <Item>
                Cada usuario solo puede leer o modificar sus propios datos: la base de datos aplica reglas de acceso (Row-Level Security)
                que lo garantizan a nivel de la propia base, no solo en el código de la aplicación.
              </Item>
              <Item>Toda la comunicación entre tu navegador y Flow+ viaja cifrada (HTTPS).</Item>
              <Item>Flow+ no usa contraseñas propias — el inicio de sesión es por Google o por enlace mágico de un solo uso enviado a tu correo, así que no hay una contraseña que se pueda filtrar de nuestro lado.</Item>
              <Item>
                Los mensajes de WhatsApp de números que no vinculaste a tu cuenta <Fuerte>no se guardan</Fuerte>, salvo que sean un
                intento explícito de vincularse o un comando dirigido a Flow+ — una conversación privada con tus contactos nunca pasa a
                formar parte de nuestros registros.
              </Item>
              <Item>Limitamos a 30 mensajes por hora por número de WhatsApp, para frenar el uso automatizado o abusivo de ese canal.</Item>
              <Item>
                Las fotos de perfil que subís se guardan en un almacenamiento <Fuerte>público</Fuerte> — a diferencia de tus archivos y
                tareas, que son privados. Cualquiera que conociera la URL exacta de tu foto podría verla, aunque esa URL no se muestra en
                ningún lugar público ni es adivinable. Si preferís evitar esto, podés dejar la foto de tu cuenta de Google (que no vive
                en nuestro almacenamiento) o no poner ninguna.
              </Item>
            </Lista>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="09" id="conservacion">
              Cuánto tiempo conservamos tus datos
            </TituloSeccion>
            <P>
              Conservamos tus datos mientras tu cuenta esté activa. Algunas particularidades que vale la pena que conozcas:
            </P>
            <Lista>
              <Item>El historial de conversaciones con la IA se recorta automáticamente a los últimos 50 mensajes por conversación.</Item>
              <Item>El registro técnico de ejecuciones de IA (sección 02) se conserva por tiempo indefinido hoy, con fines de auditoría técnica — esto puede cambiar en el futuro hacia una política de expiración automática.</Item>
              <Item>El token de tu cuenta de Google se conserva hasta que desconectás Google Drive (algo que podés hacer vos mismo en cualquier momento — ver sección siguiente).</Item>
              <Item>
                Los archivos que subís se conservan hasta que vos los borrés. Al borrar un archivo desde Flow+ también se elimina de tu
                Google Drive, junto con su resumen de IA, sus tareas detectadas y el hilo de preguntas que hayas tenido sobre él.
              </Item>
              <Item>Si desconectás Google Drive, tus archivos ya subidos <Fuerte>se quedan en tu Drive</Fuerte> — son tuyos; Flow+ solo pierde el acceso a ellos.</Item>
              <Item>El código de verificación de WhatsApp vence a los 10 minutos y queda marcado como usado — nunca se reutiliza, ni siquiera dentro de esa ventana.</Item>
              <Item>
                El registro de comandos de WhatsApp (sección 02) se conserva por tiempo indefinido hoy, con el mismo criterio que el
                registro técnico de ejecuciones de IA — con fines de auditoría y para poder diagnosticar por qué un comando no
                funcionó como esperabas.
              </Item>
            </Lista>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="10" id="derechos">
              Tus derechos sobre tus datos
            </TituloSeccion>
            <P>
              Como titular de tus datos personales, la ley colombiana (Ley 1581 de 2012, &ldquo;Habeas Data&rdquo;) te da derecho a:
            </P>
            <Lista>
              <Item>Conocer, actualizar y rectificar tus datos.</Item>
              <Item>Solicitar prueba de la autorización que nos diste.</Item>
              <Item>Ser informado sobre el uso que le dimos a tus datos.</Item>
              <Item>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.</Item>
              <Item>Revocar tu autorización y/o solicitar la supresión de tus datos, cuando no exista un deber legal de conservarlos.</Item>
              <Item>Acceder de forma gratuita a tus datos personales.</Item>
            </Lista>

            <Destacado icono={AlertTriangle} titulo="Cómo ejercer estos derechos hoy" tono="positivo">
              Desde <Fuerte>Ajustes → Soporte</Fuerte>{' '}
              podés solicitar la eliminación completa de tu cuenta vos mismo, sin escribirnos:
              elegís si también querés borrar los archivos que Flow+ subió a tu Drive, escribís &ldquo;ELIMINAR&rdquo; para confirmar, y tu cuenta
              queda programada para borrarse en <Fuerte>14 días</Fuerte> — un plazo pensado para que puedas arrepentirte; podés cancelar
              la solicitud con un solo clic en cualquier momento antes de que se cumpla. Pasado ese plazo, borramos tu perfil, tus
              tareas, materias, horario, archivos, notas y todo lo demás descrito en la sección 02.
              <Fuerte> Un registro mínimo sobrevive a propósito</Fuerte>: tu correo, la fecha en que se ejecutó el borrado y si tus
              archivos de Drive se eliminaron o no, como constancia de que la solicitud se cumplió — nunca tus tareas, tus notas ni el
              contenido de tus archivos. Lo que también podés hacer vos mismo, sin pasar por este flujo: borrar cualquier archivo suelto
              (desde Archivos), desconectar Google Drive y desvincular tu WhatsApp — todo desde Ajustes. Un botón de{' '}
              <Fuerte>exportar todos tus datos</Fuerte> todavía no existe — para eso, o para cualquier otra duda sobre tus derechos,
              escribinos (sección 15).
            </Destacado>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="11" id="menores">
              Menores de edad
            </TituloSeccion>
            <P>
              Flow+ es una app de agenda académica y es razonable esperar que la usen estudiantes menores de edad. La ley colombiana da a
              los datos de niños, niñas y adolescentes una protección reforzada: su tratamiento requiere el consentimiento de sus
              representantes legales, salvo excepciones puntuales de la ley.
            </P>
            <Lista>
              <Item>Si tenés menos de 14 años, necesitás que un padre, madre o representante legal cree o autorice tu cuenta.</Item>
              <Item>Si tenés entre 14 y 17 años, recomendamos que uses Flow+ con el conocimiento de un adulto responsable.</Item>
              <Item>
                Si sos padre, madre o representante legal y creés que un menor a tu cargo usa Flow+ sin tu autorización, escribinos
                (sección 15) y atenderemos tu solicitud, incluida la eliminación de los datos correspondientes.
              </Item>
            </Lista>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="12" id="invitado">
              Modo invitado
            </TituloSeccion>
            <Destacado icono={Ghost} titulo="Mientras no tengas cuenta, tus datos no salen de tu navegador">
              Podés usar Flow+ sin registrarte. En ese modo, tus materias, tareas y horario se guardan{' '}
              <Fuerte>únicamente en el almacenamiento local de tu navegador</Fuerte> — nunca llegan a nuestros servidores. Si más adelante
              creás una cuenta, esos datos se copian automáticamente a tu cuenta nueva y luego se borran del navegador; si algo falla en
              ese proceso, se conservan localmente para reintentarlo, en vez de perderse.
            </Destacado>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="13" id="cookies">
              Cookies y almacenamiento local
            </TituloSeccion>
            <P>Flow+ no usa cookies de rastreo ni de publicidad. Lo que sí usamos:</P>
            <Lista>
              <Item><Fuerte>Cookies de sesión</Fuerte> (estrictamente necesarias): para mantenerte con la sesión iniciada. Sin ellas, no podrías usar la app estando logueado.</Item>
              <Item><Fuerte>Almacenamiento local del navegador</Fuerte>: para recordar tu preferencia de tema (claro/oscuro) y, si estás en modo invitado, tus datos (ver sección 12).</Item>
            </Lista>
            <P>
              Sobre notificaciones (sección 04): los avisos de tareas próximas a vencer, vencidas o notas nuevas se muestran{' '}
              <Fuerte>dentro de la app</Fuerte> (la campana de notificaciones) — no enviamos correos ni notificaciones push nativas del
              sistema. Si vinculás tu WhatsApp, podés además activar (apagado por defecto, desde Ajustes → WhatsApp) que esas mismas
              notificaciones te lleguen también por ahí.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="14" id="cambios">
              Cambios a esta política
            </TituloSeccion>
            <P>
              Podemos actualizar esta política a medida que Flow+ cambia. Cuando lo hagamos, actualizaremos la fecha al pie de esta
              página. Si el cambio es significativo, haremos un esfuerzo razonable por avisarte dentro de la app.
            </P>
          </section>

          <section className="mb-14">
            <TituloSeccion numero="15" id="contacto">
              Contacto
            </TituloSeccion>
            <P>
              Para cualquier duda sobre esta política, o para ejercer tus derechos sobre tus datos, escribinos — ver el correo al pie de
              esta página.
            </P>
          </section>

          <PiePaginaLegal actualizado={ACTUALIZADO} />
        </div>
      </div>
    </>
  )
}
