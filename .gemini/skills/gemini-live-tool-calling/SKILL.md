---
name: gemini-live-tool-calling
description: Design and debug function calls in the Gemini Live API. Ensure client-side execution, inspect arguments, handle cancellations, and return one FunctionResponse per call.
---

# Gemini Live tool calling

## Lifecycle
1. Function declarations are included in the Live setup message at session start.
2. The model emits a client-side functionCall with an ID, name and arguments.
3. The application decides whether the call is allowed and runs/reviews a local or external implementation.
4. The client returns a FunctionResponse with the same call ID and function name.
5. The model consumes the function result and continues the interaction.

## Reliability
- Validate function names and JSON argument schemas before connect.
- Keep the requested function ID/name intact in the response.
- Support multiple functionCalls in one message and handle cancellation messages.
- Show untrusted arguments as text, not as HTML.
- Never execute a function merely because a model requested it.
- For the current local bridge, permit only read-only functions from its server allowlist. Commands with side effects must be reviewed and implemented through a different approval flow.

## Blocking behavior
Function calling is client-side for Live API; the application must explicitly return FunctionResponse. Do not force NON_BLOCKING on every declaration. Only opt into a model-supported scheduling behavior after verifying support for the selected model. The default is synchronous/blocking.

## Audio and tools
Keep tool events observable in the event stack, but do not treat tool-call timestamps or transcription as proof of audio quality. Diagnose the PCM playback path separately.
