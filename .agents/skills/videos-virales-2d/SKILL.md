---
name: videos-virales-2d
description: Crea videos verticales 2D a partir de prompts libres en fabrica-videos-ia. Usa esta habilidad para desarrollar guiones y clips con Google, integrar voz ElevenLabs, ajustar escenas Remotion o generar, validar y entregar MP4 desde el workflow manual y el generador local.
---

# Videos virales 2D

## Objetivo y modos

Crear un video vertical de 1080 × 1920, 30 fps, con voz audible, subtítulos legibles y escenas coherentes. Mejorar claridad y retención sin garantizar viralidad.

Leer `README.md`, `scripts/`, `src/` y los workflows actuales antes de cambiar sus contratos. El modo predeterminado `VIDEO_FORMAT=prompt-ia` acepta un guion o prompt libre de hasta 5000 caracteres en `VIDEO_PROMPT`. `VIDEO_THEME` es únicamente un nombre corto opcional de hasta 120 caracteres. No pedir que el usuario pegue el guion en tema.

- `VIDEO_DEMO=true`: vista previa ilustrada por código con voz robótica española local, sin llamadas a APIs ni clips IA nuevos. Requiere espeak-ng. No presentarla como generación IA gratuita o como cumplimiento visual completo del prompt.
- `VIDEO_DEMO=false` y `prompt-ia`: Google desarrolla el plan y genera clips; ElevenLabs genera la narración masculina; Remotion/FFmpeg montan el MP4.
- `historia`: mantiene la microhistoria por plantillas locales.
- `acertijo-mapa`: mantiene el preset de 60 segundos, cuenta atrás 40–50 y respuesta en el segundo 50.

La integración de Google es una API independiente de Flow, con su propio acceso y facturación. No usa una sesión, cuenta, créditos ni backend de Flow.

## Recoger y desarrollar el prompt

Reutilizar el guion y las preferencias de la conversación. Si hace falta, pedir únicamente la idea o texto que no pueda inferirse. Los valores de partida son 15 segundos, español, formato vertical, `prompt-ia`, demo activa y efectos desactivados. Las instrucciones del usuario prevalecen.

Separar narración, instrucciones de imagen y tiempos. Mantener gancho temprano, desarrollo comprensible y una resolución que responda a lo prometido. Para el estilo humano cartoon 2D, mantener un presentador consistente, contornos limpios, fondo azul, iconos de preguntas o cerebros y subtítulos blancos con contorno negro cuando corresponda a la referencia del usuario. No cambiar detalles ya aprobados.

Preparar el retrato original del presentador con la composición `CharacterReference` y reutilizar su PNG como referencia de todos los clips de Google. Inspirarse en el estilo solicitado sin prometer una copia exacta de una foto ni continuidad perfecta de un modelo generativo.

Si se pide un acertijo de 60 segundos con revelación a los 50, reservar 40–50 para la cuenta atrás sin narración y no revelar la respuesta visualmente antes. Describir las escenas sin incluir la respuesta prematuramente en prompts de clip.

Revisar afirmaciones verificables antes de presentarlas como hechos. Los modelos pueden alterar detalles visuales; distinguir guion planeado, clips generados y resultado inspeccionado.

## APIs, credenciales y costo

El modo real `prompt-ia` requiere secretos de GitHub Actions `GEMINI_API_KEY` y `ELEVENLABS_API_KEY`. Inyectarlos únicamente al paso de generación. Nunca imprimirlos, incluirlos en artifacts, props de Remotion o errores, ni pedir que se peguen en prompts o código.

La voz masculina fija predeterminada es Adam (`pNInz6obpgDQGcFmaJgB`), modelo `eleven_multilingual_v2`. `ELEVENLABS_VOICE_ID` permite cambiarla por otra voz disponible de la cuenta. Mantener una voz consistente y usar la alineación para subtítulos y pausas.

Las variables opcionales `GOOGLE_TEXT_MODEL` y `GOOGLE_VIDEO_MODEL` controlan los modelos; los valores predeterminados de la aplicación son `gemini-3.8-flash` y `gemini-omni-1.2-flash`. Comprobar nombres y acceso vigentes en https://aistudio.google.com/docs/video y https://ai.google.dev/gemini-api/docs antes de afirmar compatibilidad con una cuenta. La configuración no demuestra una llamada real exitosa.

No gastar créditos para comprobar código si los mocks y la demo cubren el caso. No añadir reintentos automáticos de peticiones pagadas ni convertir un fallo real silenciosamente en una demo. `VIDEO_SFX=false` evita una petición opcional adicional de sonido.

## Ejecutar y controlar desde iPhone

Preparar Node.js 22+, FFmpeg, ffprobe, espeak-ng y un navegador para Remotion. Verificar:

```sh
npm ci
npm test
npm run typecheck
VIDEO_FORMAT=prompt-ia VIDEO_PROMPT='Un presentador humano cartoon 2D hace una pregunta curiosa y revela la respuesta al final.' VIDEO_DURATION=15 VIDEO_DEMO=true VIDEO_SFX=false npm run generate
```

El workflow `.github/workflows/generar-video.yml` admite `tema`, `prompt`, `formato`, `duracion`, `demo` y `efectos`. Pasarlos mediante variables de entorno, nunca interpolarlos directamente en comandos shell. `Validar formulario` ejecuta `npm run validate-input` antes de instalar dependencias y sin secretos.

En Safari: Actions → Generar video 2D → Run workflow → main → pegar el guion en **prompt** → `formato: prompt-ia` → duración coherente. Para una vista previa mantener demo; para clips IA y voz de ElevenLabs, configurar las claves y desmarcar demo. Tras una ejecución verde, descargar el artifact, descomprimirlo en Archivos y guardar el MP4 en Fotos. Publicar solo cuando se solicite.

## Validar y entregar

Ejecutar pruebas pertinentes y TypeScript; renderizar una demo tras cambios de composición, tiempos, audio o montaje. Usar animaciones deterministas en Remotion y recursos locales preparados antes del render.

Antes de declarar éxito:

- Comprobar con ffprobe resolución 1080 × 1920, H.264, AAC y duración dentro de tolerancia.
- Analizar volumen y rechazar pistas silenciosas; la demo debe tener voz robótica audible, no solo tonos de cuenta atrás.
- Verificar continuidad de escenas, sincronización de subtítulos, área segura y legibilidad móvil.
- Inspeccionar frames y escuchar el audio cuando las herramientas lo permitan, diferenciando esa revisión de una validación técnica.
- Confirmar `out/video.mp4`, `out/storyboard.json`, `out/subtitles.srt` y `out/validation.json`. En generación IA entregar también `out/clips/*.mp4` y `out/plan.json` cuando exista.
- Informar qué se probó y si las APIs reales quedaron pendientes. No presentar una demo, un mock o un plan como clips IA verificados.

Los workflows publican `out/` con retención de 7 días. Mantener ese directorio libre de secretos y temporales. No versionar renders, dependencias ni credenciales. Revisar que los guiones y prompts exportados sean aptos para artifacts de un repositorio público.

Si falla una ejecución con clips ya generados, el workflow manual publica únicamente esas escenas y `plan.json` en `escenas-parciales-[número]`; recuperar estos archivos sin afirmar que el MP4 final se validó. No perder clips pagados por un fallo posterior del montaje.
