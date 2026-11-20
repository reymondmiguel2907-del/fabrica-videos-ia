# Fábrica de videos 2D desde el iPhone

Escribe un **prompt completo** y descarga un MP4 vertical de **1080 × 1920, 30 fps**, con voz, subtítulos y escenas. El control está en **GitHub Actions**, accesible desde Safari; no necesitas instalar herramientas en el iPhone.

El formato `prompt-ia` usa Google para desarrollar el guion y generar clips de video, ElevenLabs para la voz masculina y Remotion/FFmpeg para el montaje. Es una integración con la **API de Google**, independiente de Flow: no inicia sesión en Flow ni usa sus créditos o suscripciones. Requiere acceso a los modelos y facturación de las APIs correspondientes.

El proyecto prepara un retrato original del presentador y reutiliza su PNG como referencia común para los clips. El estilo puede inspirarse en una imagen indicada por el usuario; no promete una copia exacta ni identidad visual perfecta entre generaciones.

## Primer video desde Safari

1. Abre [Generar video 2D](https://github.com/reymondmiguel2907-del/fabrica-videos-ia/actions/workflows/generar-video.yml) e inicia sesión en GitHub con permiso de escritura.
2. Toca **Run workflow**, selecciona **main** y elige **formato: prompt-ia**.
3. Pega tu guion o instrucciones en **prompt**, hasta 5000 caracteres. **tema** es solo un nombre corto opcional, de hasta 120 caracteres.
4. Selecciona una **duración** coherente con el prompt. Para probar sin gasto, deja **demo** marcado: verás una vista previa dibujada por código con voz robótica local, sin generación de clips IA.
5. Para producir escenas con IA y voz de ElevenLabs, configura las dos claves descritas abajo y **desmarca demo**. Deja **efectos** desmarcado para evitar una petición adicional de sonido.
6. Toca **Run workflow** y abre la ejecución. Espera a que termine en verde; la generación de clips y el render pueden tardar varios minutos.
7. Baja a **Artifacts → video-[número]** y descarga el ZIP. En **Archivos**, tócalo para descomprimirlo; abre `video.mp4` y usa **Compartir → Guardar video** para añadirlo a Fotos.

Después puedes subir el archivo a TikTok. No se publica automáticamente. Si GitHub oculta el formulario en móvil, usa el menú de página de Safari → **Solicitar sitio web de escritorio**.

## Claves para generar con IA y voz real

En el repositorio, abre **Settings → Secrets and variables → Actions → Secrets → New repository secret** y crea:

| Secreto | Uso |
| --- | --- |
| `GEMINI_API_KEY` | Guion estructurado y generación de clips mediante Google. |
| `ELEVENLABS_API_KEY` | Narración masculina y, si los activas, efectos opcionales. |

Obtén las credenciales desde [Google AI Studio](https://aistudio.google.com/apikey) y tu cuenta de ElevenLabs. No pegues las claves en el prompt, el tema, un issue o el código. Los secretos se inyectan únicamente al paso de generación; no se guardan en el artifact.

La voz fija predeterminada es **Adam**, ID `pNInz6obpgDQGcFmaJgB`, con `eleven_multilingual_v2`. Para usar otra voz masculina de tu biblioteca, crea una **variable** de repositorio `ELEVENLABS_VOICE_ID` en la pestaña **Variables**. La disponibilidad depende de tu cuenta.

Las variables opcionales `GOOGLE_TEXT_MODEL` y `GOOGLE_VIDEO_MODEL` seleccionan los modelos. Sus valores predeterminados en la aplicación son `gemini-3.8-flash` y `gemini-omni-1.2-flash`, respectivamente. Los modelos, permisos y regiones cambian: confirma el acceso y los nombres vigentes en la [documentación de video de Google](https://aistudio.google.com/docs/video) y la [documentación de la API de Gemini](https://ai.google.dev/gemini-api/docs). Esta configuración no implica que una cuenta tenga acceso al modelo ni que se haya probado una llamada real con tus credenciales.

Las llamadas reales pueden consumir créditos. No se reintentan automáticamente peticiones pagadas; ejecutar de nuevo puede cobrar de nuevo. Un fallo de API no se convierte silenciosamente en una demo.

**Estado de verificación:** se utilizan pruebas simuladas y demos locales; la generación real con Google queda pendiente de configurar `GEMINI_API_KEY` y comprobar el acceso de la cuenta. No se afirma que los clips de API real estén probados.

## Ejemplo de prompt: acertijo de 60 segundos

En el formulario elige `formato: prompt-ia` y `duracion: 60`. Pega lo siguiente **en prompt**, no en tema:

```text
Crea un video vertical de 60 segundos para TikTok. Estilo humano cartoon 2D: un presentador joven con camiseta verde y jeans, contornos limpios, fondo azul, iconos de cerebros y signos de pregunta. Mantén el mismo personaje y estilo en todos los planos. Voz masculina en español, clara y natural. Subtítulos blancos grandes con contorno negro, dentro del área segura móvil.

0–8 s: Gancho. El presentador mira a cámara y pregunta: «Tengo ciudades, pero no casas; montañas, pero no árboles; y agua, pero no peces. ¿Qué soy?» Muestra iconos de ciudad, montaña y río.
8–25 s: Repite visualmente las tres pistas, una por una, con cambios de encuadre y animaciones sencillas. No muestres todavía un mapa ni su respuesta.
25–40 s: Invita a pensar. El presentador observa las pistas y aparece un cerebro animado. Di: «Piensa en algo que representa muchos lugares sin contenerlos de verdad».
40–50 s: Haz una cuenta atrás de diez segundos en pantalla, con pulsos suaves. Sin narración ni revelación durante este intervalo.
50–57 s: Revela la respuesta: «¡Un mapa!» Muestra un mapa desplegándose y conecta sus símbolos con las tres pistas.
57–60 s: Cierre breve: «¿Lo adivinaste antes de la cuenta atrás?»
```

En **demo** se previsualiza el estilo con una ilustración por código y voz robótica española. La demo usa un texto de prueba y **no interpreta el prompt ni genera escenas nuevas con IA gratis**. Para cambiar a clips IA, conserva los campos y desmarca `demo` tras configurar las claves.

## Formatos y entradas

| Campo | Función |
| --- | --- |
| `prompt` | Guion o instrucciones completas, hasta 5000 caracteres, para `prompt-ia`. Puede incluir varias líneas. |
| `tema` | Nombre corto opcional, máximo 120 caracteres. No pegues aquí el guion. |
| `formato` | `prompt-ia` por defecto; `historia` y `acertijo-mapa` conservan las plantillas anteriores. |
| `duracion` | 10, 15, 30, 45 o 60 segundos en el formulario. Usa una duración coherente con el prompt. |
| `demo` | Marcado por defecto: vista previa con dibujos de código y voz robótica local, sin API. |
| `efectos` | Opcional. Fuera de demo puede gastar créditos adicionales de ElevenLabs. |

`historia` crea una microhistoria con plantillas locales. `acertijo-mapa` usa el guion integrado y exige exactamente **60 segundos**, con cuenta atrás entre 40–50 y respuesta a los 50. Para esos formatos, el guion se modifica en el código con Codex. El formato libre es `prompt-ia`.

## Descarga y validación

El artifact contiene `video.mp4`, `storyboard.json`, `subtitles.srt` y `validation.json`. En generación con IA incluye además **`clips/`**, con escenas individuales descargables, y **`plan.json`** cuando se genera el plan. La conservación es de **7 días**.

Si la ejecución falla después de generar algunas escenas, el artifact **`escenas-parciales-[número]`** conserva los clips disponibles y el plan. Permite recuperar esas escenas sin presentarlas como un MP4 final validado; si no hay archivos, no se crea ese artifact.

Antes de publicar el artifact, se validan códecs H.264/AAC, resolución, duración y volumen de audio; una pista silenciosa se rechaza. El repositorio es público: no introduzcas datos privados en guiones o prompts que pasarán a los archivos descargables. No se garantiza viralidad ni que un modelo respete perfectamente cada detalle visual.

## Desarrollo y diagnóstico

Requisitos: Node.js 22+, FFmpeg, ffprobe y **espeak-ng** en `PATH`. Remotion usa Chrome/Chromium; puedes indicar su ruta con `REMOTION_BROWSER_EXECUTABLE`. Los workflows instalan la voz local y FFmpeg. Cada cambio a `main` o pull request ejecuta pruebas, TypeScript y una demo sin secretos.

```sh
npm ci
npm test
npm run typecheck
VIDEO_FORMAT=prompt-ia VIDEO_PROMPT='Un presentador cartoon 2D hace una pregunta y revela la respuesta al final.' VIDEO_DURATION=15 VIDEO_DEMO=true VIDEO_SFX=false npm run generate
```

El paso **Validar formulario** comprueba las entradas sin claves ni gasto antes de instalar dependencias. Si el tema supera el límite, deja un nombre corto y mueve el texto largo a **prompt**. Si el preset `acertijo-mapa` rechaza la duración, elige 60. Si falla una llamada real, revisa acceso al modelo, facturación, cuota y permisos de las claves en los servicios correspondientes. No compartas las claves para diagnosticarlo.

La Skill está en [`.agents/skills/videos-virales-2d/SKILL.md`](.agents/skills/videos-virales-2d/SKILL.md). Para uso comercial, revisa la [licencia de Remotion](https://www.remotion.dev/license) y las condiciones de Google y ElevenLabs.
