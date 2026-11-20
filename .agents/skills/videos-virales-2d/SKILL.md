---
name: videos-virales-2d
description: Crea y modifica videos verticales de animación 2D para TikTok en fabrica-videos-ia. Usa esta habilidad al escribir guiones, ajustar escenas Remotion, generar narración ElevenLabs o producir y validar MP4 mediante el workflow manual y el generador local.
---

# Videos virales 2D

## Objetivo y alcance

Transformar un tema en una microhistoria animada con gancho, progresión y cierre. Producir MP4 de 1080 × 1920, 30 fps, video H.264 y audio AAC mediante Remotion y FFmpeg. Mejorar claridad y retención sin prometer viralidad ni inventar métricas.

Este proyecto usa un planificador local de historias, sin API de texto. Los temas inspiran ficción; no presentar las frases generadas como hechos investigados. Para contenidos educativos o afirmaciones verificables, contrastar las fuentes y adaptar el guion antes de narrar.

## Contexto y entradas

Leer `README.md`, los archivos actuales en `scripts/`, `src/` y `.github/workflows/generar-video.yml` antes de cambiar contratos entre planificador, narración y render.

Reutilizar el tema y las preferencias de la conversación. Si falta el tema y no puede inferirse, pedirlo. Valores de partida:

- Duración: 15 segundos; el formulario admite 10, 15, 30, 45 o 60.
- Español, tono cercano y personajes originales en 2D.
- Formato vertical 9:16, con subtítulos dentro del área segura móvil.
- `VIDEO_DEMO=true`: sin llamadas a ElevenLabs, audio sintético local sin voz humana.
- `VIDEO_SFX=false`: efectos opcionales desactivados.

Las instrucciones del usuario prevalecen sobre los valores por defecto. Conservar personajes, referencias y textos ya aprobados.

## Flujo creativo

1. Definir una idea central y un gancho visible en los primeros segundos.
2. Escribir una narración breve: gancho → obstáculo → acción → giro → resolución. Ajustar cantidad de palabras a la duración.
3. Dividir el guion en escenas contiguas; cada escena tiene una acción principal y propósito narrativo. Mantener sincronizados narración, títulos y subtítulos.
4. Mantener silueta, paleta y proporciones de los personajes entre planos. Animar con los frames de Remotion; evitar aleatoriedad no determinista, peticiones de red o fuentes externas durante el render.
5. Acompañar la historia con movimiento y transiciones legibles. Mantener texto breve, contrastado y lejos de la interfaz de TikTok. Evitar destellos rápidos.

## Generación y voz

Preparar Node.js 22+, FFmpeg y ffprobe. Instalar y revisar:

```sh
npm ci
npm test
npm run typecheck
```

Probar primero una demo corta:

```sh
VIDEO_THEME='Una idea pequeña cambia el día' VIDEO_DURATION=15 VIDEO_DEMO=true VIDEO_SFX=false npm run generate
```

En modo real, `VIDEO_DEMO=false` usa el secreto de GitHub Actions `ELEVENLABS_API_KEY`. La voz masculina fija predeterminada es Adam (`pNInz6obpgDQGcFmaJgB`); `ELEVENLABS_VOICE_ID` permite seleccionar otra voz disponible sin cambiarla de forma aleatoria entre videos. Mantener ajustes estables y utilizar los tiempos devueltos por ElevenLabs para los subtítulos. FFmpeg ajusta duración dentro de los límites del generador.

Nunca imprimir, leer para mostrar, versionar o incluir secretos en artifacts, storyboard, props de Remotion o mensajes de error. No registrar cuerpos crudos de errores del proveedor. El modo demo debe ignorar las credenciales y no realizar peticiones de contenido. Las llamadas reales consumen créditos; no añadir reintentos automáticos tras peticiones pagadas ni sustituir un error real por una demo sin avisar.

## Control desde iPhone

Usar `.github/workflows/generar-video.yml`, ejecución manual `workflow_dispatch`, rama `main`. Sus entradas son `tema`, `duracion`, `demo` y `efectos`. Pasarlas como variables de entorno; nunca interpolar el tema o secretos directamente dentro de comandos de shell.

En Safari: Actions → Generar video 2D → Run workflow → main → completar entradas → Run workflow. Tras una ejecución verde, descargar el artifact `video-[número]`, descomprimirlo en Archivos y compartir `video.mp4` a Fotos. Publicar en TikTok solo cuando el usuario lo solicite.

## Validación y entrega

Ejecutar las pruebas pertinentes y el chequeo de TypeScript tras cambios. Renderizar una demo cuando se modifiquen composición, tiempos, audio o montaje. No gastar créditos para comprobar cambios de código si las pruebas simuladas y el modo demo cubren el caso.

Antes de declarar éxito:

- Revisar que ffprobe confirme 1080 × 1920, H.264, pista AAC y duración solicitada dentro de la tolerancia del generador.
- Verificar que el storyboard cubra todos los frames sin huecos y los subtítulos correspondan a la narración.
- Inspeccionar frames representativos y escuchar el audio si hay reproducción disponible; distinguir estas revisiones de la validación técnica.
- Comprobar que existan `out/video.mp4`, `out/storyboard.json`, `out/subtitles.srt` y `out/validation.json`.
- Informar qué se probó, qué queda pendiente y el enlace de descarga cuando exista. No presentar una simulación o un storyboard como un video terminado.

No incluir dependencias, credenciales, temporales ni renders grandes en Git. El workflow publica únicamente los cuatro entregables, con retención de 7 días. Revisar que el contenido sea adecuado para un artifact de un repositorio público.
