# Fábrica de videos 2D

Genera un MP4 vertical de **1080 × 1920, 30 fps**, con animación 2D en Remotion, subtítulos integrados, transiciones y montaje final con FFmpeg. Se controla desde **GitHub Actions en Safari en iPhone**: no necesitas instalar Node.js en el teléfono ni mantener un servidor.

El campo **tema es un título corto de 1 a 120 caracteres**, no un espacio para pegar un guion o un prompt largo. El selector **formato** elige el guion integrado: `historia` crea una microhistoria con plantillas locales y `acertijo-mapa` genera el acertijo del mapa de 60 segundos. No necesita una API de texto ni investiga datos sobre el tema. Para cambiar el argumento y las frases, pide a Codex que edite el guion integrado en `scripts/`. No se garantiza viralidad.

Cada cambio a `main` y cada pull request ejecuta también **Verificar fábrica (demo)**: pruebas, TypeScript y un render de 10 segundos sin secretos ni API. Su artifact `demo-validada-[número]` permite revisar el funcionamiento antes de generar narraciones de pago.

## Tu primer video desde el iPhone

1. Abre en Safari [Generar video 2D](https://github.com/reymondmiguel2907-del/fabrica-videos-ia/actions/workflows/generar-video.yml) e inicia sesión en GitHub con una cuenta que tenga permiso de escritura en el repositorio.
2. Toca **Run workflow**. Selecciona la rama **main**.
3. Escribe un **tema corto**, elige **formato: historia** y **15 segundos**, deja **demo** marcado y **efectos** desmarcado. Toca el botón verde **Run workflow**.
4. Abre la ejecución más reciente. Si aún no aparece, actualiza la página. Espera a que el trabajo termine en verde; el render puede tardar varios minutos.
5. En el resumen de la ejecución, baja hasta **Artifacts** y toca **video-[número]** para descargar el ZIP.
6. En Safari, abre **Descargas** y luego el archivo en **Archivos**. Toca el ZIP para descomprimirlo, abre `video.mp4` y usa **Compartir → Guardar video** para añadirlo a Fotos.
7. Abre TikTok y selecciona ese video desde Fotos. La fábrica prepara el archivo; la publicación la haces tú.

Si GitHub oculta el formulario en la vista móvil, usa el menú de página de Safari → **Solicitar sitio web de escritorio** y vuelve a abrir el enlace de Actions. Si Actions está desactivado, abre la pestaña **Actions** y habilítalo primero.

### Generar el acertijo del mapa

En **Run workflow**, selecciona estos valores:

| Campo | Valor |
| --- | --- |
| Rama | `main` |
| Tema | `Acertijo del mapa` |
| Formato | `acertijo-mapa` |
| Duración | `60` |
| Demo | Marcado (`true`) |
| Efectos | Desmarcado (`false`) |

Copia **solo `Acertijo del mapa`** en tema; no pegues allí el guion completo. El preset ya contiene el guion, las escenas y los tiempos. Incluye una cuenta atrás entre los segundos 40 y 50 y revela la respuesta en el segundo 50. Este formato exige exactamente 60 segundos. Para personalizar el acertijo, pide a Codex que cambie su guion integrado.

La demo no usa la API. En modo real, la narración se solicita en una sola petición a ElevenLabs con alineación; el montaje inserta los silencios y la cuenta atrás en sus tiempos, sin generar una petición de voz por escena.

### Qué hace el modo demo

`demo = true` no realiza ninguna llamada a ElevenLabs, aunque exista un secreto configurado. Produce animación, subtítulos y audio sintético local, **sin voz humana y sin gastar créditos de API**. Si activas efectos en demo, también son locales. El render en GitHub Actions sigue sujeto a los minutos y límites de tu cuenta de GitHub.

## Activar la voz masculina de ElevenLabs

Haz primero una demo. Después, desde Safari:

1. En el repositorio, abre **Settings → Secrets and variables → Actions → Secrets → New repository secret**.
2. Escribe exactamente `ELEVENLABS_API_KEY` como nombre y pega tu clave de ElevenLabs como valor. Guarda el secreto. No lo pegues en un issue, código, tema ni conversación.
3. Vuelve a **Actions → Generar video 2D → Run workflow**, selecciona `main` y desmarca **demo**.
4. Deja **efectos** desmarcado para generar solo la narración. Activarlo añade una petición de efecto de sonido a ElevenLabs y puede consumir créditos adicionales.

La voz predeterminada es **Adam**, ID `pNInz6obpgDQGcFmaJgB`, con modelo `eleven_multilingual_v2` y ajustes estables. Se reutiliza la misma voz en todas las ejecuciones. La disponibilidad depende de tu cuenta de ElevenLabs. Para elegir otra voz masculina de tu biblioteca, crea una **variable** de repositorio, no un secreto, llamada `ELEVENLABS_VOICE_ID` en **Settings → Secrets and variables → Actions → Variables** y escribe su ID. Se conserva ese ID hasta que lo cambies.

La narración devuelve tiempos por carácter para sincronizar los subtítulos. FFmpeg ajusta el audio a la duración elegida dentro de los límites admitidos por la aplicación; un desfase excesivo detiene la ejecución con una explicación. Los errores de voz no se convierten silenciosamente en una demo. No hay reintentos automáticos de peticiones pagadas para evitar cobros duplicados; volver a ejecutar manualmente puede consumir créditos de nuevo.

## Entradas del formulario

| Entrada | Uso |
| --- | --- |
| `tema` | Solo título corto en español, de 1 a 120 caracteres. Ejemplo: `Acertijo del mapa`. No admite el guion completo ni un prompt largo. Se trata como datos, nunca como un comando. |
| `formato` | `historia` (predeterminado) o `acertijo-mapa` (guion integrado de 60 segundos). |
| `duracion` | El formulario permite 10, 15, 30, 45 o 60 segundos. `acertijo-mapa` exige `60`. Localmente, `historia` admite enteros entre 10 y 60. |
| `demo` | Marcado de forma predeterminada: sin API ni voz humana. |
| `efectos` | Opcional; desmarcado de forma predeterminada. En modo real puede gastar créditos. |

## Archivos descargables

Cada ejecución correcta publica un artifact `video-[número]` con:

| Archivo | Contenido |
| --- | --- |
| `video.mp4` | Video H.264 con audio AAC y compatibilidad para reproducción móvil. |
| `storyboard.json` | Guion, escenas y tiempos utilizados para el render. |
| `subtitles.srt` | Copia reutilizable de los subtítulos incluidos en el video. |
| `validation.json` | Resultado de la validación técnica con ffprobe. |

Se comprueban las pistas, códecs, resolución y duración del MP4 antes de publicar. Los artifacts se conservan **7 días**. Descárgalos antes de que expiren. El repositorio es público: los videos y guiones descargables pueden ser accesibles a otros usuarios de GitHub; no introduzcas datos privados en el tema.

## Desarrollo local

Requisitos: Node.js 22 o posterior, npm, FFmpeg y ffprobe en `PATH`. Remotion descarga un navegador para el render y necesita conexión la primera vez. Si ya tienes Chromium o Chrome, puedes indicar su ruta mediante `REMOTION_BROWSER_EXECUTABLE=/ruta/al/navegador`. Actions utiliza Chrome del runner cuando está disponible. El modo demo no consume APIs de contenido.

```sh
npm ci
npm test
npm run typecheck
VIDEO_THEME='Una idea pequeña cambia el día' VIDEO_FORMAT=historia VIDEO_DURATION=15 VIDEO_DEMO=true VIDEO_SFX=false npm run generate
```

Para probar el preset completo:

```sh
VIDEO_THEME='Acertijo del mapa' VIDEO_FORMAT=acertijo-mapa VIDEO_DURATION=60 VIDEO_DEMO=true VIDEO_SFX=false npm run generate
```

Para una narración real, define `ELEVENLABS_API_KEY` mediante tu gestor de secretos o entorno local y usa `VIDEO_DEMO=false`. No escribas la clave en archivos versionados ni en el historial del terminal. En GitHub Actions solo se inyecta al paso de generación. `ELEVENLABS_VOICE_ID` es opcional.

El código, la Skill y los archivos de configuración son reutilizables. Antes de dar uso comercial a Remotion, revisa su [licencia vigente](https://www.remotion.dev/license); ElevenLabs también aplica sus condiciones y límites de cuenta.

## Si la ejecución falla

Abre la ejecución roja y el paso que falló. Los mensajes indican el problema sin mostrar claves ni el cuerpo de errores del proveedor.

El paso **Validar formulario** comprueba el título, el formato y la duración antes de instalar dependencias o generar contenido. No usa secretos ni gasta créditos. La clave se comprueba posteriormente, solo si eliges una narración real.

| Problema | Qué revisar |
| --- | --- |
| El tema supera 120 caracteres | En tema escribe únicamente un título corto, por ejemplo `Acertijo del mapa`. El texto del guion va en el preset del código; no lo pegues en el formulario. |
| El formato acertijo-mapa requiere 60 segundos | Selecciona `duracion: 60`; las pausas, cuenta atrás y respuesta tienen tiempos fijos. |
| Falta la clave | Crea el secreto `ELEVENLABS_API_KEY` o activa `demo`. |
| Autorización o voz no disponible | Verifica la clave, sus permisos y el ID de voz en tu cuenta de ElevenLabs. |
| Cuota o límite de solicitudes | Revisa tus créditos y límites en ElevenLabs antes de volver a ejecutar. |
| Tiempo de voz incompatible | Prueba una duración distinta o simplifica el guion en el planificador. |
| Fallo de render o tiempo agotado | Prueba 10 o 15 segundos y revisa el paso de generación. |
| Validación del MP4 fallida | No se publica un artifact de video; revisa el diagnóstico del generador. |

La Skill de Codex está en [`.agents/skills/videos-virales-2d/SKILL.md`](.agents/skills/videos-virales-2d/SKILL.md). Describe cómo crear o modificar historias, producir el MP4 y comprobar el resultado.
