# Gemini Live Studio — Deutsch

[← Englische Hauptdokumentation](../../README.md)

**Gemini Live Studio** ist eine lokal ausgeführte Weboberfläche für Googles Gemini-Live-API. Sie unterstützt Sprach- und Texteingaben, Bilder und Videoframes, Sitzungsereignisse sowie Experimente mit Tool-Aufrufen.

## Funktionen

- Echtzeit-Mikrofonstreaming, native Audiowiedergabe und Transkription, sofern die API sie bereitstellt.
- Texteingaben, Bild-Uploads, Kameraframes, extrahierte Videoframes und Audio-Dateistreaming.
- Modell- und Stimmauswahl, Generierungsparameter und Extended-Thinking-Tiefe.
- Sitzungsfortsetzung, Kontextkomprimierung, eigene Systemanweisungen und optionale Google-Suche.
- Tool-Aufrufe erfordern manuelle Prüfung; beliebiger Code wird nicht allein auf Anforderung des Modells ausgeführt.
- Ereignisprotokoll, Vorschau/Kopie des Setup-Payloads, Export von Transkript und Ereignissen sowie WAV-Export des empfangenen Audios zur Diagnose von Piepen und Knacken.
- Mehrere API-Key-Profile, anpassbare Designs und lokal gespeicherte Browser-Einstellungen.

## Schnellstart

1. Installiere Node.js 20 oder neuer.
2. Lade dieses Repository herunter oder klone es.
3. Unter Windows `start-local.cmd` starten; auf anderen unterstützten Systemen `node server.mjs` ausführen.
4. **http://127.0.0.1:8765** öffnen.
5. Eigenen Gemini-API-Key eingeben, Modell wählen und **Connect session** anklicken.
6. Mikrofon- und Kamerazugriff nur bei tatsächlicher Nutzung erlauben.

Der Server bindet standardmäßig nur an `127.0.0.1`. Den Port nicht über LAN, Tunnel oder Reverse-Proxy freigeben.

## Sicherheit und Datenschutz

Der lokale Server tauscht den dauerhaften API-Key gegen ein kurzlebiges, einmal verwendbares Live-Token. Der dauerhafte Key steht nicht in der Live-WebSocket-URL des Browsers. Gespeicherte Key-Profile liegen jedoch standardmäßig in `localStorage` und sind **nicht verschlüsselt**. Deaktiviere „Remember this key“ für die reine Sitzung.

Audio, Text, Bilder, Videoframes und toolbezogene Inhalte werden bei Verwendung an Google übertragen. Die optionale CLI-/Skill-Brücke bietet ausschließlich freigegebene, schreibgeschützte Prüfungen und verlangt ausdrückliche Aktivierung und Freigabe. Sie ist keine allgemeine Shell.

## Audiodiagnose

Bei Piepen, Klicks oder Knacken den letzten Modellton unter Settings → Tools als WAV exportieren und außerhalb der Sitzung anhören. Ist der Fehler im WAV hörbar, steckt er bereits im empfangenen Audiopayload. Ist das WAV sauber, die Live-Wiedergabe aber nicht, zuerst Browser-Scheduling, Puffer, Systemmixer, Treiber und Ausgabegerät prüfen. Das beweist für sich genommen keinen Modellfehler.

Diese Version ist für `gemini-3.8-live` und `gemini-3.8-live-extended-thinking` konfiguriert. Verfügbarkeit, Kontingente und Bedingungen legt Google fest. Unabhängiges Projekt, nicht mit Google verbunden oder von Google unterstützt.

Siehe [englisches README](../../README.md), [lokale Tool-Funktionen](../../LOCAL_AGENT_CAPABILITIES.md) und [Lizenz](../../LICENSE).
