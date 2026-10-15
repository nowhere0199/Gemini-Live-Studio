# Gemini Live Studio — Nederlands

[← Hoofddocumentatie in het Engels](../../README.md)

**Gemini Live Studio** is een lokaal draaiende webinterface voor de Gemini Live API van Google. Je kunt ermee praten of typen, afbeeldingen en videoframes delen, sessiegebeurtenissen bekijken en tool-calls testen.

## Functies

- Realtime microfoonstreaming, audioweergave en transcriptie wanneer de API die aanbiedt.
- Tekstberichten, afbeeldingsuploads, cameraframes, uit video geëxtraheerde frames en audiobestanden.
- Model- en stemkeuze, generatieparameters en het Extended Thinking-niveau.
- Sessie hervatten, context comprimeren, aangepaste systeeminstructies en optionele Google Search.
- Tool-calls vereisen handmatige beoordeling; willekeurige code wordt niet automatisch uitgevoerd op verzoek van het model.
- Gebeurtenissenlog, setup-payload bekijken/kopiëren, transcript exporteren en WAV-export van ontvangen audio om piepjes en gekraak te onderzoeken.
- Meerdere API-keyprofielen, aanpasbare thema's en lokale browservoorkeuren.

## Snel starten

1. Installeer Node.js 20 of nieuwer.
2. Download of clone deze repository.
3. Start op Windows `start-local.cmd`; voer op andere ondersteunde systemen `node server.mjs` uit.
4. Open **http://127.0.0.1:8765**.
5. Vul je eigen Gemini API-key in, kies een model en klik op **Connect session**.
6. Geef alleen microfoon- of cameratoestemming wanneer je die functies wilt gebruiken.

De server luistert standaard alleen op `127.0.0.1`. Stel de poort niet bloot via LAN, tunnel of reverse proxy.

## Beveiliging en privacy

De lokale server wisselt de permanente API-key in voor een kortlevend, eenmalig Live-token. De permanente sleutel staat niet in de Live-WebSocket-URL van de browser. Opgeslagen sleutelprofielen staan echter in de browser-`localStorage` en zijn **niet versleuteld**. Schakel “Remember this key” uit als je de sleutel niet wilt bewaren.

Audio, tekst, afbeeldingen, videoframes en toolgerelateerde gegevens worden naar Google verzonden wanneer je de dienst gebruikt. De optionele CLI-/skills-brug biedt alleen toegestane, alleen-lezen controles en vereist expliciete activering en goedkeuring. Het is geen algemene shell.

## Audioproblemen onderzoeken

Bij piepjes, klikken of gekraak exporteer je de laatste modelaudio als WAV via Settings → Tools en beluister je die apart. Als het probleem ook in de WAV zit, zit het in de ontvangen audiogegevens. Is de WAV schoon maar klinkt live-weergave slecht, controleer dan eerst browserscheduling, buffers, de OS-mixer, drivers en het uitvoerapparaat. Dit bewijst op zichzelf niet dat het model de oorzaak is.

Deze versie is ingesteld op `gemini-3.8-live` en `gemini-3.8-live-extended-thinking`. Google bepaalt beschikbaarheid, quota en voorwaarden. Dit is een onafhankelijk project, niet verbonden aan of goedgekeurd door Google.

Zie de [Engelse README](../../README.md), [mogelijkheden van lokale tools](../../LOCAL_AGENT_CAPABILITIES.md) en de [licentie](../../LICENSE).
