---
name: audio-output-diagnostics
description: Diagnose clicks, beeps, crackling and discontinuities in Gemini Live PCM audio output. Compare the saved raw PCM capture with realtime playback and inspect scheduler diagnostics before blaming the model.
---

# Audio output diagnostics

## Goal
Distinguish audio artifacts already present in Gemini's returned PCM from artifacts added by the browser playback scheduler, audio graph, device driver, or output device.

## Canonical format
Gemini Live audio output is raw mono PCM, signed 16-bit little-endian at 24,000 samples/second. The app must decode little-endian signed 16-bit values and schedule AudioBuffers at 24 kHz. Do not interpret raw PCM as WAV/MP3, stereo, float PCM, or 16 kHz.

## Diagnostic procedure
1. Reproduce the issue with one short text turn, microphone disabled, and a stable audio output device.
2. Export the app's captured raw model output as WAV. It contains the exact PCM bytes received from the model, wrapped with a WAV header only.
3. Listen to the exported WAV outside the live session.
4. If the same beeps/crackle are audible in the WAV, they exist in the received model/API audio. This does not by itself prove the base model is at fault; network payload/model behavior may still be involved.
5. If the WAV is clean but realtime playback is noisy, prioritize browser scheduling, buffer discontinuity/underrun, audio context state, analyser routing, OS mixer, audio driver and output device.
6. Inspect the event log's chunk count, scheduling-gap/underrun count, max late time, peak level and near-clipping count. Repeated scheduling gaps around the audible artifact strongly implicate playback continuity.
7. Repeat with a second output device and compare. Avoid noise filters, denoisers, EQ or voice enhancement until the raw/live comparison identifies where the artifact enters the chain.

## Important limits
- Output transcription is not an audio-quality oracle: it describes recognized words and cannot confirm or deny non-speech sounds in the audio.
- A WAV export reconstructed from received PCM is a diagnostic artifact; do not normalize, resample, denoise or fade it before comparison.
- Never log the user's API key, ephemeral token, raw full audio contents, or unredacted request headers.
