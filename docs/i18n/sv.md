# Gemini Live Studio — Svenska

[← Huvuddokumentation på engelska](../../README.md)

**Gemini Live Studio** är ett lokalt webbgränssnitt för Googles Gemini Live API. Det stöder tal och text, bilder och videorutor, insyn i sessionshändelser och experiment med verktygsanrop.

## Funktioner

- Mikrofonströmning i realtid, ljuduppspelning och transkribering när API:et tillhandahåller det.
- Textmeddelanden, bilduppladdning, kamerarutor, extraherade videorutor och ljudfiler.
- Val av modell och röst, genereringsparametrar och Extended Thinking-nivå.
- Återuppta session, komprimera kontext, egna systeminstruktioner och valfri Google-sökning.
- Verktygsanrop kräver manuell granskning; godtycklig kod körs inte automatiskt på modellens begäran.
- Händelselogg, förhandsvisning/kopiering av setup-payload, export av transkript och WAV-export av mottaget ljud för felsökning av pip och knaster.
- Flera API-nyckelprofiler, anpassade teman och lokala webbläsarinställningar.

## Snabbstart

1. Installera Node.js 20 eller senare.
2. Hämta eller klona detta repository.
3. Kör `start-local.cmd` i Windows; kör `node server.mjs` på andra system som stöds.
4. Öppna **http://127.0.0.1:8765**.
5. Ange din egen Gemini API-nyckel, välj en modell och klicka på **Connect session**.
6. Ge bara mikrofon- eller kamerabehörighet när du vill använda funktionerna.

Servern lyssnar som standard endast på `127.0.0.1`. Exponera inte porten via LAN, tunnel eller reverse proxy.

## Säkerhet och integritet

Den lokala servern byter den permanenta API-nyckeln mot en kortlivad Live-token som bara kan användas en gång. Den permanenta nyckeln placeras inte i webbläsarens Live-WebSocket-URL. Sparade nyckelprofiler ligger dock i webbläsarens `localStorage` och är **inte krypterade**. Stäng av “Remember this key” om nyckeln inte ska sparas.

Ljud, text, bilder, videorutor och verktygsrelaterat innehåll skickas till Google när tjänsten används. Den valfria CLI-/skill-bryggan erbjuder endast tillåtna skrivskyddade kontroller och kräver uttryckligt godkännande. Den är inte ett allmänt skal.

## Ljuddiagnostik

Om ljudet innehåller pip, klick eller knaster exporterar du det senaste modelljudet som WAV via Settings → Tools och lyssnar separat. Om felet hörs i WAV-filen finns det i det mottagna ljudet. Om WAV-filen är ren men liveuppspelningen är störd bör du först undersöka webbläsarens schemaläggning, buffertar, systemmixer, drivrutiner och utdataenhet. Det bevisar inte i sig att modellen är orsaken.

Den här versionen är konfigurerad för `gemini-3.8-live` och `gemini-3.8-live-extended-thinking`. Google styr tillgänglighet, kvoter och villkor. Projektet är oberoende och varken anslutet till eller godkänt av Google.

Se [README på engelska](../../README.md), [lokala verktygsfunktioner](../../LOCAL_AGENT_CAPABILITIES.md) och [licensen](../../LICENSE).
