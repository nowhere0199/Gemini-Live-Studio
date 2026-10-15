# Gemini Live Studio — Suomi

[← Englanninkielinen päädokumentaatio](../../README.md)

**Gemini Live Studio** on paikallisesti toimiva verkkokäyttöliittymä Googlen Gemini Live API:lle. Se tukee puhetta ja tekstiä, kuvia ja videoruutuja, istuntotapahtumien tarkastelua sekä työkalukutsujen kokeilua.

## Ominaisuudet

- Mikrofonin reaaliaikainen suoratoisto, äänen toisto ja transkriptio, kun API tarjoaa sen.
- Tekstiviestit, kuvien lataus, kameraruudut, videosta poimitut ruudut ja äänitiedostot.
- Mallin ja äänen valinta, generointiparametrit sekä Extended Thinking -taso.
- Istunnon jatkaminen, kontekstin tiivistäminen, omat järjestelmäohjeet ja valinnainen Google-haku.
- Työkalukutsut vaativat manuaalisen tarkistuksen; sovellus ei suorita mielivaltaista koodia automaattisesti mallin pyynnöstä.
- Tapahtumaloki, asetusten payload-esikatselu ja kopiointi, keskustelun vienti sekä vastaanotetun äänen WAV-vienti piippausten ja rätinän selvittämiseksi.
- Useita API-avainprofiileja, mukautettavat teemat ja selaimeen tallennettavat asetukset.

## Pika-aloitus

1. Asenna Node.js 20 tai uudempi.
2. Lataa tai kloonaa tämä repository.
3. Windowsissa suorita `start-local.cmd`; muissa tuetuissa järjestelmissä suorita `node server.mjs`.
4. Avaa **http://127.0.0.1:8765**.
5. Syötä oma Gemini API -avaimesi, valitse malli ja paina **Connect session**.
6. Salli mikrofonin tai kameran käyttö vain, kun haluat käyttää niitä.

Palvelin kuuntelee oletusarvoisesti vain osoitteessa `127.0.0.1`. Älä avaa porttia lähiverkkoon, tunneliin tai käänteiseen välityspalvelimeen.

## Tietoturva ja yksityisyys

Paikallinen palvelin vaihtaa pitkäikäisen API-avaimen lyhytikäiseen, kertakäyttöiseen Live-tokeniin. Pitkäikäistä avainta ei sijoiteta selaimen Live-WebSocket-URL-osoitteeseen. Tallennetut avainprofiilit ovat kuitenkin selaimen `localStorage`-tilassa eivätkä ole **salattuja**. Poista “Remember this key” käytöstä, jos et halua tallentaa avainta.

Ääni, teksti, kuvat, videoruudut ja työkaluihin liittyvät tiedot lähetetään Googlelle palvelua käytettäessä. Valinnainen CLI-/skill-silta tarjoaa vain sallittuja, vain luku -tarkistuksia ja edellyttää käyttäjän nimenomaista käyttöönottoa ja hyväksyntää. Se ei ole yleiskäyttöinen komentotulkki.

## Ääniongelmien diagnosointi

Jos äänessä on piippauksia, napsahduksia tai rätinää, vie viimeisin mallin ääni WAV-tiedostoksi kohdassa Settings → Tools ja kuuntele sitä erillisellä soittimella. Jos häiriö kuuluu WAV-tiedostossa, se on mukana vastaanotetussa äänidatassa. Jos WAV on puhdas mutta reaaliaikainen toisto häiriintyy, tarkista ensin selaimen ajoitus, puskurit, järjestelmämikseri, ajurit ja ulostulolaite. Tämä ei yksin todista mallin olevan syyllinen.

Tämä versio on määritetty malleille `gemini-3.8-live` ja `gemini-3.8-live-extended-thinking`. Google hallitsee saatavuutta, kiintiöitä ja ehtoja. Projekti on riippumaton eikä Googlen hyväksymä tai siihen sidoksissa.

Katso [englanninkielinen README](../../README.md), [paikallisten työkalujen kuvaus](../../LOCAL_AGENT_CAPABILITIES.md) ja [lisenssi](../../LICENSE).
