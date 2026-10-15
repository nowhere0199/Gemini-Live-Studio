# Gemini Live Studio: local tools, skills and audio diagnostics

This document describes the local CLI/skill bridge and audio diagnostics.

## Audio output diagnostics

Gemini Live audio output is raw mono, signed 16-bit little-endian PCM at 24 kHz. The app can export the latest received PCM as WAV without filtering or normalization. Compare that file in an external player with real-time playback.

1. If the beep/crackle is present in the WAV, it exists in the received model/API audio. This alone does not prove the base model is at fault.
2. If the WAV is clean but live playback is noisy, investigate browser scheduling, buffer gaps, the audio graph, OS mixer, driver and output device.
3. Check event diagnostics such as chunk count, scheduling gaps, late time, peak level and near-clipping count.
4. Try a second output device. Transcription cannot confirm or rule out non-speech artifacts.

Never log API keys, ephemeral tokens, full audio payloads or unredacted request headers.

## Local CLI/CMD bridge

The same-origin endpoint POST /api/local-tool is loopback-only.

- It accepts a fixed operation allowlist, not arbitrary shell text, command-line arguments or arbitrary working directories.
- Read-only checks cover Node, npm, Git, Python, CMD/PowerShell, Gemini/Hermes/Claude CLI, Gemini CLI skills, project JavaScript syntax and project Git status.
- Local tools must be enabled by the user in Settings > Tools. Each operation requires an explicit review/run step.
- Results appear in a JSON response editor. The operator must inspect the result and explicitly return it to Gemini.
- The endpoint validates localhost Origin, rate-limits requests, limits input/output size and redacts recognizable API keys and bearer tokens.
- Arbitrary shell execution, file mutation, package/skill installation, process termination, deployment and arbitrary path access are intentionally unsupported.

## Agent Skills

Three starter skills are included under .gemini/skills/:

- audio-output-diagnostics: compare raw PCM WAV with real-time playback.
- safe-local-cli: use fixed read-only checks and preserve the approval boundary.
- gemini-live-tool-calling: validate call IDs, arguments and FunctionResponse lifecycle.

Skill libraries available to the browser:

- project: this repository's .gemini/skills/.
- gemini-user: %USERPROFILE%/.gemini/skills.
- agents-user: %USERPROFILE%/.agents/skills.
- marketing: optional; configure GEMINI_LIVE_MARKETING_SKILLS_DIR to a trusted local skill-library path.

The browser-side reader is a read-only catalogue. Reading a skill is not the same as installing it or loading it into an Agent CLI. Gemini CLI may require the workspace to be explicitly trusted before loading workspace skills.

## Function calling

Live API tool calls are handled by the client. The app receives a functionCall, applies its own review/allowlist policy, and returns a FunctionResponse with the same call ID and function name. It never executes arbitrary code simply because a model requested a tool.

Re-check model-specific blocking/non-blocking behavior against official documentation when model IDs change.

## References

- https://ai.google.dev/gemini-api/docs/live-api/capabilities
- https://ai.google.dev/gemini-api/docs/live-api/tools
- https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live
- https://geminicli.com/docs/cli/skills/
- https://geminicli.com/docs/cli/creating-skills/