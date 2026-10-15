# Gemini Live Studio: local tools, skills and audio diagnostics

Updated: 2026-10-15

## Audio output: model versus local playback

Gemini Live audio output is raw mono, signed 16-bit little-endian PCM at 24 kHz. The browser must decode little-endian int16 samples and schedule each returned chunk at 24,000 Hz.

This app keeps an unmodified copy of the received PCM for the latest completed output (capped at 16 MiB) and exposes Export last model audio (WAV) under Settings â†’ Tools. It also logs chunk count, scheduling gaps/late time, peak amplitude and near-clipping rate. The playback path serializes scheduling work, starts with a small initial queue, and uses a short ramp-in after a measured late gap to reduce a click caused by a discontinuity. The exported WAV is built from the raw received bytes and is not filtered or normalized.

Diagnostic decision:
1. Play the WAV outside the live session.
2. If the beep/crackle is present in the WAV, it exists in the audio returned by Gemini/the API path.
3. If the WAV sounds clean but the live session is noisy, investigate browser scheduling, output audio graph, OS mixer/driver/device and underrun metrics first.
4. Use a second output device to rule out a local endpoint problem.
5. Transcription does not confirm or rule out non-speech artifacts.

The app cannot conclude â€œLLM faultâ€ from a report alone. A matching raw-WAV artifact is the first useful separation test.

## Local CLI/CMD bridge

Path: POST /api/local-tool (loopback-only server; same-origin page calls only).

- The bridge accepts only a fixed name allowlist. It does not accept arbitrary shell text, command-line arguments or an arbitrary working directory.
- Read-only checks cover Node, npm, Git, Python, CMD/PowerShell versions, Gemini/Hermes/Claude CLI versions, Gemini CLI's skills list, JavaScript syntax checks for this project, and git status for this project.
- Tool calls are not run only because Gemini requested them. User opt-in must be enabled in Settings â†’ Tools; a call card then exposes a button to run the approved read-only operation.
- Results are placed in a JSON response editor. The operator must review them and explicitly choose Return result to send a FunctionResponse back to Gemini.
- The endpoint checks the expected localhost Origin, rate-limits requests, limits request/output size, and redacts recognizable API keys and bearer tokens from outputs.
- Skills are read-only from fixed skill roots. Skill content remains in the browser until the operator returns it as a tool result.
- Not supported by design: free-form PowerShell/CMD, arbitrary script execution, file mutation, installing/uninstalling skills/packages, process termination, deployment, and access to arbitrary paths. Those require a separate reviewed execution workflow.

## Agent Skills

Three local starter skills are included under .gemini/skills/, the workspace skill directory used by Gemini CLI:

- audio-output-diagnostics: compare raw PCM WAV against real-time playback.
- safe-local-cli: use the fixed read-only bridge and maintain an explicit approval boundary.
- gemini-live-tool-calling: handle call IDs, arguments and FunctionResponse lifecycle safely.

Available skill libraries exposed to the browser:
- project â†’ this repo's .gemini/skills/.
- marketing â†’ optional path configured with GEMINI_LIVE_MARKETING_SKILLS_DIR.
- gemini-user â†’ %USERPROFILE%\.gemini\skills.
- agents-user â†’ %USERPROFILE%\.agents\skills.

This is a browser-side, read-only catalogue. Reading a skill is distinct from installing it or loading it into an Agent CLI. Gemini CLI supports workspace skills in .gemini/skills/ and .agents/skills/, and user skills under .gemini/skills/ and .agents/skills/, with SKILL.md metadata. The current CLI reports this project as untrusted and therefore returns â€œNo skills discoveredâ€; a user must explicitly trust the workspace in Gemini CLI before it loads workspace skills. The browser-side local reader does not change CLI trust. See the official documentation below.

## Function calling notes

Live API tool calls are handled by the client: it receives a function call, runs/reviews the implementation, then returns a FunctionResponse with the same ID and function name. The browser never auto-runs an arbitrary command simply because a function call arrived.

The current model family has its own blocking/non-blocking behavior. The code does not force NON_BLOCKING onto every user function declaration; explicit behavior is preserved, and the selected model's default applies otherwise. Any model-specific scheduling behavior should be rechecked against its official documentation when the model ID changes.

## References

- Gemini Live capabilities and audio format: https://ai.google.dev/gemini-api/docs/live-api/capabilities
- Gemini Live tool calling: https://ai.google.dev/gemini-api/docs/live-api/tools
- Gemini 3.8 Live model notes: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live
- Gemini CLI Agent Skills: https://geminicli.com/docs/cli/skills/
- Gemini CLI skill authoring: https://geminicli.com/docs/cli/creating-skills/

