# Gemini Live Studio — Italiano

[← Documentazione principale in inglese](../../README.md)

**Gemini Live Studio** è un'interfaccia web locale per l'API Gemini Live di Google. Consente conversazioni vocali e testuali, condivisione di immagini e fotogrammi video, osservazione degli eventi di sessione e sperimentazione delle chiamate agli strumenti.

## Funzionalità

- Streaming del microfono in tempo reale, riproduzione audio e trascrizione quando fornita dall'API.
- Messaggi di testo, caricamento immagini, fotogrammi della fotocamera, fotogrammi estratti dai video e streaming di file audio.
- Scelta di modello e voce, parametri di generazione e livello Extended Thinking.
- Ripresa della sessione, compressione del contesto, istruzioni di sistema personalizzate e Google Search opzionale.
- Le chiamate agli strumenti richiedono revisione manuale; l'app non esegue automaticamente codice arbitrario su richiesta del modello.
- Registro eventi, anteprima/copia del payload di setup, esportazione della trascrizione ed esportazione WAV dell'audio ricevuto per diagnosticare beep e crepitii.
- Profili multipli di chiavi API, temi personalizzabili e preferenze locali del browser.

## Avvio rapido

1. Installa Node.js 20 o successivo.
2. Scarica o clona questo repository.
3. Su Windows avvia `start-local.cmd`; sugli altri sistemi supportati esegui `node server.mjs`.
4. Apri **http://127.0.0.1:8765**.
5. Inserisci la tua chiave API Gemini, scegli un modello e premi **Connect session**.
6. Concedi i permessi di microfono o fotocamera solo quando desideri usarli.

Il server ascolta per impostazione predefinita solo su `127.0.0.1`. Non esporre la porta alla LAN, a tunnel o a reverse proxy.

## Sicurezza e privacy

Il server locale scambia la chiave API permanente con un token Live effimero monouso. La chiave permanente non viene inserita nell'URL WebSocket Live del browser. I profili salvati sono però memorizzati nel `localStorage` del browser e **non sono cifrati**. Disattiva “Remember this key” per un uso temporaneo.

Audio, testo, immagini, fotogrammi video e dati relativi agli strumenti vengono inviati a Google quando il servizio è usato. Il ponte CLI/skills opzionale offre solo controlli autorizzati in sola lettura e richiede abilitazione e approvazione esplicite. Non è una shell generica.

## Diagnostica audio

In caso di beep, clic o crepitii, esporta l'ultimo audio del modello in WAV da Settings → Tools e ascoltalo separatamente. Se il difetto è presente nel WAV, è già nell'audio ricevuto. Se il WAV è pulito ma la riproduzione live è rumorosa, controlla prima pianificazione del browser, buffer, mixer del sistema operativo, driver e dispositivo di uscita. Questo non dimostra da solo che la causa sia il modello.

Questa versione è configurata per `gemini-3.8-live` e `gemini-3.8-live-extended-thinking`. Disponibilità, quote e condizioni sono gestite da Google. Progetto indipendente, non affiliato né approvato da Google.

Consulta il [README inglese](../../README.md), le [funzionalità degli strumenti locali](../../LOCAL_AGENT_CAPABILITIES.md) e la [licenza](../../LICENSE).
