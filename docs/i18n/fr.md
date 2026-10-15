# Gemini Live Studio — Français

[← Documentation principale en anglais](../../README.md)

**Gemini Live Studio** est une interface web locale pour l'API Gemini Live de Google. Elle permet de converser par la voix ou le texte, de partager des images et des images vidéo, d'observer les événements de session et d'expérimenter l'appel d'outils.

## Fonctionnalités

- Diffusion du microphone en temps réel, lecture audio et transcription lorsque l'API la fournit.
- Messages texte, images, images de caméra, images extraites de vidéos et fichiers audio.
- Sélection du modèle et de la voix, paramètres de génération et niveau de réflexion Extended Thinking.
- Reprise de session, compression du contexte, instructions système personnalisées et recherche Google facultative.
- Appels d'outils soumis à validation manuelle : aucun code arbitraire n'est exécuté automatiquement.
- Journal d'événements, aperçu/copie du payload, export de transcription et export WAV de l'audio reçu pour diagnostiquer les bips et grésillements.
- Profils de clés API, thèmes et préférences conservés dans le navigateur.

## Démarrage rapide

1. Installez Node.js 20 ou une version plus récente.
2. Téléchargez ou clonez ce dépôt.
3. Sous Windows, lancez `start-local.cmd`; ailleurs, exécutez `node server.mjs`.
4. Ouvrez **http://127.0.0.1:8765**.
5. Saisissez votre propre clé API Gemini, choisissez un modèle et cliquez sur **Connect session**.
6. N'autorisez le microphone ou la caméra que lorsque vous souhaitez les utiliser.

Le serveur écoute par défaut uniquement sur `127.0.0.1`. N'exposez pas son port au réseau local, à un tunnel ou à un proxy inverse.

## Sécurité et confidentialité

Le serveur local échange la clé API durable contre un jeton Live éphémère, à usage unique. La clé durable n'est pas incluse dans l'URL WebSocket Live du navigateur. Les profils de clés enregistrés utilisent toutefois le `localStorage` du navigateur : ce stockage **n'est pas chiffré**. Désactivez « Remember this key » pour une utilisation temporaire.

L'audio, le texte, les images, les images vidéo et les données liées aux outils sont envoyés à Google lorsque vous utilisez le service. Évitez les informations sensibles sans avoir vérifié les règles applicables. Le pont CLI/skills est facultatif, limité à des contrôles autorisés en lecture seule et exige une activation et une approbation explicites de l'utilisateur.

## Diagnostic audio

En cas de clics, bips ou grésillements, exportez le dernier audio du modèle au format WAV dans Settings → Tools et écoutez-le séparément. Si le défaut apparaît dans le WAV, il est présent dans l'audio reçu. Si le WAV est propre mais que la lecture en direct est bruyante, vérifiez d'abord l'ordonnancement du navigateur, les buffers, le mélangeur système, les pilotes et le périphérique de sortie. Cela ne prouve pas à lui seul que le modèle est responsable.

La version actuelle cible `gemini-3.8-live` et `gemini-3.8-live-extended-thinking`. La disponibilité, les quotas et les conditions dépendent de Google. Projet indépendant, non affilié à Google.

Voir le [README anglais](../../README.md), les [capacités des outils locaux](../../LOCAL_AGENT_CAPABILITIES.md) et la [licence](../../LICENSE).
