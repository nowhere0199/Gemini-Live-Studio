# Gemini Live Studio — Español

[← Documentación principal en inglés](../../README.md)

**Gemini Live Studio** es una interfaz web local para la API Gemini Live de Google. Permite conversar por voz o texto, compartir imágenes y fotogramas de vídeo, observar eventos de sesión y probar llamadas a herramientas.

## Funciones

- Transmisión de micrófono en tiempo real, reproducción de audio y transcripción cuando la API la proporciona.
- Mensajes de texto, imágenes, fotogramas de cámara, fotogramas extraídos de vídeo y archivos de audio.
- Selección de modelo y voz, parámetros de generación y nivel de razonamiento Extended Thinking.
- Reanudación de sesión, compresión de contexto, instrucciones de sistema personalizadas y Google Search opcional.
- Las llamadas a herramientas requieren revisión manual; la aplicación no ejecuta código arbitrario automáticamente.
- Registro de eventos, vista/copia del payload de configuración, exportación de la conversación y WAV del audio recibido para diagnosticar pitidos o crujidos.
- Perfiles de claves API, temas personalizables y preferencias locales del navegador.

## Inicio rápido

1. Instala Node.js 20 o posterior.
2. Descarga o clona este repositorio.
3. En Windows ejecuta `start-local.cmd`; en otros sistemas compatibles, ejecuta `node server.mjs`.
4. Abre **http://127.0.0.1:8765**.
5. Introduce tu propia clave API de Gemini, elige un modelo y pulsa **Connect session**.
6. Concede permisos de micrófono/cámara solo cuando quieras usarlos.

El servidor escucha únicamente en `127.0.0.1` de forma predeterminada. No expongas el puerto a la LAN, a túneles ni a proxies inversos.

## Seguridad y privacidad

El servidor local intercambia la clave API permanente por un token Live efímero de un solo uso. La clave permanente no se incluye en la URL WebSocket Live del navegador. Sin embargo, los perfiles guardados usan `localStorage` del navegador y **no están cifrados**. Desactiva «Remember this key» para no guardar la clave.

El audio, texto, imágenes, fotogramas de vídeo y datos de herramientas se envían a Google cuando se usan. La inspección local de CLI/skills es opcional, de solo lectura y limitada a operaciones permitidas; exige activación y aprobación explícitas. No es una shell genérica.

## Diagnóstico de audio

Si escuchas pitidos, clics o crujidos, exporta el último audio del modelo como WAV desde Settings → Tools y escúchalo fuera de la sesión. Si el defecto está en el WAV, ya existe en el audio recibido. Si el WAV está limpio pero la reproducción en directo falla, revisa primero la planificación del navegador, los búferes, el mezclador del sistema, los controladores y el dispositivo de salida. Esto no demuestra por sí solo que el modelo sea culpable.

La versión actual está configurada para `gemini-3.8-live` y `gemini-3.8-live-extended-thinking`. Google controla la disponibilidad, las cuotas y las condiciones. Proyecto independiente, sin afiliación ni respaldo de Google.

Consulta el [README en inglés](../../README.md), las [capacidades de las herramientas locales](../../LOCAL_AGENT_CAPABILITIES.md) y la [licencia](../../LICENSE).
