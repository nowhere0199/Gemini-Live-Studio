# Gemini Live Studio — Dansk

[← Hoveddokumentation på engelsk](../../README.md)

**Gemini Live Studio** er en lokal webgrænseflade til Googles Gemini Live API. Den understøtter tale og tekst, billeder og videobilleder, sessionshændelser og afprøvning af værktøjskald.

## Funktioner

- Mikrofonstreaming i realtid, lydafspilning og transskription, når API'en leverer det.
- Tekstbeskeder, billeduploads, kamerabilleder, udtrukne videobilleder og lydfiler.
- Valg af model og stemme, genereringsparametre og Extended Thinking-niveau.
- Genoptagelse af session, kontekstkomprimering, egne systeminstruktioner og valgfri Google-søgning.
- Værktøjskald kræver manuel gennemgang; vilkårlig kode køres ikke automatisk efter en modelanmodning.
- Hændelseslog, visning/kopiering af setup-payload, eksport af transskription og WAV-eksport af modtaget lyd til fejlsøgning af bip og knitren.
- Flere API-nøgleprofiler, tilpassede temaer og lokale browserindstillinger.

## Hurtig start

1. Installer Node.js 20 eller nyere.
2. Download eller klon dette repository.
3. På Windows køres `start-local.cmd`; på andre understøttede systemer køres `node server.mjs`.
4. Åbn **http://127.0.0.1:8765**.
5. Indtast din egen Gemini API-nøgle, vælg en model, og tryk **Connect session**.
6. Giv kun adgang til mikrofon og kamera, når du selv vil bruge dem.

Serveren lytter som standard kun på `127.0.0.1`. Eksponér ikke porten via LAN, tunnel eller reverse proxy.

## Sikkerhed og privatliv

Den lokale server bytter den permanente API-nøgle til et kortlivet Live-token, der kun kan bruges én gang. Den permanente nøgle placeres ikke i browserens Live-WebSocket-URL. Gemte nøgleprofiler ligger dog som standard i browserens `localStorage` og er **ikke krypterede**. Slå “Remember this key” fra for kun at bruge nøglen i den aktuelle session.

Lyd, tekst, billeder, videobilleder og værktøjsdata sendes til Google, når funktionen bruges. Den valgfrie CLI-/skill-bro tilbyder kun godkendte skrivebeskyttede kontroller og kræver udtrykkelig aktivering og godkendelse. Den er ikke en generel shell.

## Lydfejlsøgning

Ved bip, klik eller knitren eksporteres den seneste modellyd som WAV via Settings → Tools og afspilles separat. Hvis fejlen også høres i WAV-filen, findes den i den modtagne lyd. Hvis WAV-filen er ren, men liveafspilningen støjer, undersøges først browserens planlægning, buffere, systemmixer, drivere og outputenhed. Det beviser ikke i sig selv, at modellen er årsagen.

Denne version er konfigureret til `gemini-3.8-live` og `gemini-3.8-live-extended-thinking`. Google styrer tilgængelighed, kvoter og vilkår. Projektet er uafhængigt og ikke tilknyttet eller godkendt af Google.

Se [README på engelsk](../../README.md), [lokale værktøjsfunktioner](../../LOCAL_AGENT_CAPABILITIES.md) og [licensen](../../LICENSE).
