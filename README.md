# Gemini Live Studio

**A local-first desktop web interface for Google's Gemini Live API.** Speak, type, share images or video, inspect session events, and experiment with tool calling in a browser UI served only on your own computer.

> English is the primary documentation. Translations are available below; if a translation lags behind, follow this README.

## Documentation in 14 languages

English (primary) · [Dansk](docs/i18n/da.md) · [Deutsch](docs/i18n/de.md) · [Español](docs/i18n/es.md) · [Suomi](docs/i18n/fi.md) · [Français](docs/i18n/fr.md) · [हिन्दी](docs/i18n/hi.md) · [Italiano](docs/i18n/it.md) · [日本語](docs/i18n/ja.md) · [한국어](docs/i18n/ko.md) · [Nederlands](docs/i18n/nl.md) · [Svenska](docs/i18n/sv.md) · [Tiếng Việt](docs/i18n/vi.md) · [中文](docs/i18n/zh.md)

## Features

- Real-time microphone streaming and native audio playback, with audio input/output transcription.
- Text turns, image uploads, camera frames, sampled video frames, and audio-file streaming.
- Gemini Live model selection, voice selection, extended-thinking depth, thought summaries, and generation controls.
- Session resumption, context-window compression, custom system instructions, optional Google Search, and user-defined function declarations.
- Manual tool-call review and JSON function responses. The app does **not** execute arbitrary code just because the model requests a tool.
- Event observability, setup-payload preview/copy, transcript and event-log export, and raw received-audio WAV export for diagnosing beeps or crackle.
- Multiple API-key profiles, configurable themes, and local browser preferences.

## Requirements

- Windows, macOS, or Linux desktop with a graphical browser.
- Node.js 20 or newer.
- A Google account and a Gemini API key with access to the selected Live model. API access and quotas are governed by Google.

## Quick start

1. Install Node.js 20+.
2. Download or clone this repository.
3. Run `start-local.cmd` on Windows, or run `node server.mjs` from the project directory on any supported OS.
4. Open **http://127.0.0.1:8765**.
5. Enter your own Gemini API key, select a model, and choose **Connect session**.
6. Grant microphone or camera permission only when you choose to use those features.

The local server binds to `127.0.0.1` by default and is not intended to be exposed to your LAN, a public IP, a tunnel, or a reverse proxy.

## Security and privacy

- You provide your own Gemini API key. The local server exchanges it for a short-lived, single-use ephemeral Live token; the long-lived key is not placed in the browser's Live WebSocket URL.
- By default, saved key profiles and preferences use this browser's `localStorage`. This is **not encrypted storage**. Disable “Remember this key” for session-only use, and secure your browser profile.
- Live audio, text, images, video frames, and tool-related content are sent to Google when used. Review Google's policies and your account settings before sharing sensitive information.
- Local CLI/skill inspection is an optional, allowlisted feature. It is read-only by design and requires explicit user opt-in and approval for each operation. It is not a general-purpose shell.
- Never expose the local server to untrusted networks. Do not commit API keys, browser profiles, credentials, logs, or personal data.

## Audio diagnostics

If output has clicks, beeps, or crackle, export **the last model audio as WAV** from Settings → Tools and listen outside the live session. If the artifact is present in the WAV, it exists in the received audio payload; if the WAV is clean but live playback is noisy, investigate browser scheduling, audio buffering, OS mixer, drivers, and the output device first. This comparison does not by itself prove that the underlying model is at fault.

## Model notes

- This build is configured for `gemini-3.8-live` and `gemini-3.8-live-extended-thinking`. Model availability can change; consult Google's current documentation.
- The standard Live model does not accept a configurable `thinkingLevel`; the app omits its `thinkingConfig`.
- Extended Thinking supports `low`, `medium`, and `high` in this UI.
- Native-audio sessions use AUDIO output. Visible text may be provided by audio-transcription events.
- Live sessions have time limits that vary by modality. Session resumption and context compression are enabled by default.
- Advanced JSON is an expert override; arbitrary fields may be unsupported or rejected upstream.

## Local tools and skills

The included local tool bridge only offers fixed, read-only checks and reads skills from explicit allowlisted directories. Model tool calls are not automatically executed. The operator must enable local tools, review a proposed action, run the approved check, inspect its output, and explicitly return a result. See [LOCAL_AGENT_CAPABILITIES.md](LOCAL_AGENT_CAPABILITIES.md) and the bundled skills under `.gemini/skills/`.

Optional external skill libraries can be configured with `GEMINI_LIVE_MARKETING_SKILLS_DIR`; no maintainer-specific filesystem path is embedded in the public source.

## Project files

- `server.mjs` — loopback-only server, ephemeral-token provisioning, and fixed local inspection endpoints.
- `index.html`, `styles.css` — user interface and visual system.
- `app.js`, `enhancements.js` — Live protocol, media capture/playback, settings, tool-call lifecycle, and event handling.
- `icons.js` — local Lucide SVG icon bundle.
- `.gemini/skills/` — three starter Agent Skills.
- `LOCAL_AGENT_CAPABILITIES.md` — implementation and audio diagnostic notes.

## Official references

- [Gemini Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities)
- [Live API thinking](https://ai.google.dev/gemini-api/docs/live-api/thinking)
- [Session management](https://ai.google.dev/gemini-api/docs/live-api/session-management)
- [Ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)
- [Gemini 3.8 Live](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live)
- [Gemini 3.8 Live Extended Thinking](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live-extended-thinking)

## License

The project is distributed under the MIT License; see [LICENSE](LICENSE). The bundled Lucide icon assets retain their own license notice in [lucide-ISC-LICENSE.txt](lucide-ISC-LICENSE.txt).

## Disclaimer

This is an independent community project and is not affiliated with, sponsored by, or endorsed by Google. Gemini models, API availability, pricing, quotas, and terms are controlled by Google and may change. Use the service in accordance with Google's terms and applicable law.
