# Kvadrat · Eiendomsutvikling i Trondheim

Førsteversjon av et lokalt verktøy for å undersøke oppussingsobjekter og følge prosjektøkonomi. Laget med HTML, CSS, JavaScript og JSON. Ingen npm-pakker eller byggetrinn er nødvendig. Leaflet følger med i `vendor/`.

## Legg filene i Windows-mappen din

1. Pakk ut **innholdet** i prosjektets ZIP-fil til:
   `C:\Users\phong\Documents\Projects Visual Code\Eiendomsutvikling`
2. `index.html`, `app.js`, `start.bat` og de øvrige filene skal ligge direkte i denne mappen.
3. Installer Node.js LTS fra https://nodejs.org hvis det ikke allerede finnes på PC-en.
4. Dobbeltklikk `start.bat`, og åpne http://localhost:3000 i nettleseren. Hold terminalvinduet åpent.

Du kan også åpne mappen i Visual Studio Code, starte en terminal og kjøre:

```powershell
node server.mjs
```

Ikke åpne `index.html` med dobbeltklikk. Nettleseren trenger HTTP for JavaScript-moduler og JSON. Som alternativ til Node kan du bruke `py -m http.server 3000 --bind 127.0.0.1` fra prosjektmappen. Bruk samme adresse og port hver gang for å finne igjen nettleserlagrede data.

## Dette er med

- Interaktivt kart med Trondheim som startområde, prismerker og prosjektpunkter.
- Offisielt adressesøk via Kartverkets Adresse REST-API, kommune 5001.
- Områdefilter, periode, BRA-i, maksimalpris og skille mellom egne salg og eksempeldata.
- Medianpris, pris per m², salgsantall, områdeanalyse og månedlig salgsvolum i det valgte datasettet.
- CSV- og JSON-import med validering. Samme salgs-ID oppdaterer en eksisterende rad.
- Prosjektkalkyle med dokumentavgift, oppussingsbuffer, finansiering, salgsomkostninger og løpende utgifter.
- Prosjektstatus, notater, faktiske oppussingskostnader og oppgaveliste.
- Scenarioanalyse ved ±5 % endring i forventet salgspris.
- Lokal lagring, eksport av salgsutvalg og sikkerhetskopiering/gjenoppretting av hele arbeidsområdet.

## Datagrunnlag: ekte adresser, fiktive eksempelsalg

**De 40 medfølgende eksempelsalgene, adressene og salgsprisene er fiktive.** Kartpunktene er illustrative plasseringer i bydeler i Trondheim. Eksempelsalgene har datoer fra mai til november 2026 og oppdateres ikke automatisk. Standardfilteret er siste 90 dager; velg «Hele datasettet» for eldre salg.

Kartverkets oversikt over åpne eiendomsdata er undersøkt 12. november 2026:
https://www.kartverket.no/api-og-data/eiendomsdata/apent-tilgjengelige-data-og-tjenester

Siden beskriver blant annet adresser, bygningspunkt, eiendomsteiger og administrative grenser, og sier uttrykkelig at grunnboksdata ikke deles på Geonorge. **Denne åpne datakilden gir ikke en komplett strøm av nylige leilighetssalg med oppnådde salgspriser.** Verktøyet bruker derfor egen import for salgsdata; det er ikke integrert med en betalt salgstjeneste. Fullverdig salgsdekning krever en egnet dataleverandør, avtale og/eller egne kvalitetssikrede registreringer.

Integrert adresse-API:
`https://ws.geonorge.no/adresser/v1/sok?sok=...&kommunenummer=5001`

Bakgrunnskart: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright. Adressesøk og bakgrunnskart krever internett. Søketeksten sendes til Kartverkets adresse-API; OpenStreetMap mottar forespørsler for kartflisene du ser. Skrifttyper lastes fra Google Fonts, med systemskrift som reserve. Prosjekter og salgsdata lastes ikke opp til noen server av denne applikasjonen.

Eiendomsgrenser, bygninger, automatisk salgsinnhenting, samarbeid, skybasert database og innlogging er ikke implementert i denne versjonen.

## Importformat

Last ned CSV-mal under «Data og import». CSV kan bruke semikolon eller komma, med standard doble anførselstegn rundt felt som inneholder skilletegn. Bruk UTF-8. Norske desimalkomma støttes i tallfelt når de ikke kolliderer med skilletegnet. JSON skal være en liste med objekter:

```json
[
  {
    "id": "egen-kilde-unik-id",
    "address": "Adresse fra din kilde",
    "district": "Midtbyen",
    "date": "2026-11-01",
    "area": 65,
    "price": 3900000,
    "lat": 63.4305,
    "lng": 10.3951,
    "source": "Navn på din datakilde"
  }
]
```

Alle feltene er obligatoriske. Bruk faktisk salgsdato, oppnådd kontant salgspris i kroner og BRA-i i m². Fellesgjeld per sammenligningssalg finnes ikke i datamodellen ennå; sammenlign bare prisgrunnlag som er konsistente. Salgsdato kan ikke være i fremtiden. Koordinater skal være breddegrad/lengdegrad (ikke UTM), innenfor 63,1–63,6 N og 9,8–10,8 Ø. Dette er en grov geografisk avgrensning rundt Trondheim, ikke en kontroll mot eksakt kommunegrense.

Maks 5 MB per fil og 5 000 salg totalt. Hele importen valideres før noe lagres. Kartet viser maksimalt de 500 nyeste salgene i utvalget; tabell og analyse bruker alle. Eksempeldata kan fjernes og gjenopprettes separat. Eksporterte eksempelsalg beholder demo-merking ved ny import. CSV-malen inneholder ett fiktivt eksempelsalg som du må erstatte.

## Økonomiske forutsetninger

Kalkylen er før skatt og uttrykker kontantfortjeneste, uten verdsetting av egen arbeidsinnsats eller inflasjon:

```text
Dokumentavgift = 2,5 % × angitt grunnlag (selveier), 0 for borettslag/aksje
Oppussing = høyeste av [budsjett × (1 + buffer %)] og registrerte faktiske kostnader
Utgifter i eierperioden = månedlig kostnad × antall måneder
Investering før renter = kjøpesum + dokumentavgift + kjøpsomkostninger
                         + oppussing + salgsomkostninger + utgifter i eierperioden
Lånebehov = maks(0, investering før renter − egenkapital)
Renter = lånebehov × nominell årsrente × måneder / 12
Samlet investering = investering før renter + renter
Fortjeneste = forventet kontant salgspris − samlet investering
Avkastning på egenkapital = fortjeneste / angitt egenkapital
Avkastning på samlet investering = fortjeneste / samlet investering
```

Renter beregnes forenklet som om hele lånebehovet er trukket fra start, også beløp til salg og løpende kostnader. Renter kapitaliseres ikke, og avkastning er for prosjektperioden, ikke annualisert. Faktiske oppussingskostnader under budsjettrammen reduserer ikke estimatet før du selv endrer budsjettet.

Fellesgjeld vises i kjøpets totalpris, men forutsettes overtatt uendret av neste kjøper. Den regnes derfor ikke som en ekstra kontantutbetaling eller et ekstra kontant salgsvederlag. Renter/avdrag som du faktisk betaler via felleskostnader må føres i månedlige utgifter. Ved endring i fellesgjeld eller nedbetaling av hovedstol må kontantstrømmene justeres manuelt. Gjeld per salg og endring i fellesgjeld gjennom prosjektet bør modelleres særskilt i en senere versjon.

Sett dokumentavgiftsgrunnlaget til riktig avgiftsgrunnlag (0 ved fritak). Andre gebyrer, tilvalg, skatt, eventuell merverdiavgift, lånegebyrer og uforutsette utgifter må inkluderes der de er relevante. «Solgt»-status bruker fortsatt kalkylens salgspris, ikke en separat regnskapsavslutning.

## Lagring og sikkerhetskopiering

Data lagres i nettleserens `localStorage` under nøkkelen `kvadrat-workspace-v1`. Dette er ikke en delt database. Sletting av nettleserdata, en annen nettleser, inkognitomodus eller en annen port kan gjøre at arbeidsområdet ser tomt ut. Sikkerhetskopi lagres som JSON og kan importeres under «Data og import»; gjenoppretting erstatter gjeldende data etter bekreftelse. Flere faner oppdaterer oversikten når en annen fane lagrer, men samtidig redigering av samme prosjekt har ingen konfliktløsning.

## Filer og kontroll

```text
index.html           Grensesnitt
styles.css           Design og responsiv tilpasning
app.js               Kart, visninger, prosjekter, import og lokal lagring
core.js              Beregninger og validering
data/demo-sales.json Fiktive eksempeldata
vendor/              Leaflet 1.9.4 med lisens
server.mjs           Lokal HTTP-server uten avhengigheter
start.bat            Windows-startfil
tests/core.test.mjs  Tester for økonomi og dataimport
```

Kjør `npm test` eller `node --test tests/core.test.mjs` for å kontrollere økonomiske beregninger, datavalidering, import og sikkerhetskopiformat. Node.js 20+ anbefales.

## Verifisering i utviklingsmiljøet

9 automatiserte tester består. Lokal HTTP-server, MIME-typer, filreferanser og HTML-ID-er er kontrollert. Adresse-API-et har svart med adresser og koordinater for Trondheim. Visuell nettlesertest kunne ikke fullføres fordi miljøets forhåndsvisningsforbindelse (relay til nettleserporten) ikke startet. Ingen fullført nettleserverifisering er dermed gjort.
