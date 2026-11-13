# Kvadrat · Eiendomsutvikling i Trondheim

Nettbasert verktøy for å undersøke oppussingsobjekter og følge prosjektøkonomi. Grensesnittet er HTML, CSS og JavaScript. En Cloudflare Worker håndterer signert tilgang, adressesøk og skylagring. Leaflet følger med i `vendor/`.

## Åpne Kvadrat på nett

Kvadrat brukes som en privat nettside. Åpne den publiserte lenken og logg inn med brukernavn og passord. Det kreves ingen lokal installasjon, server, Node.js eller filer for vanlig bruk. Prosjekter, oppgaver, oppussingskostnader og salgsdata lagres i en hosted Cloudflare D1-database og følger den innloggede kontoen på tvers av enheter.

Du kan registrere salg i skjemaet under «Data og import», finne adressekoordinater med Kartverket eller lime inn CSV/JSON direkte på siden. Filimport, eksport og nedlasting av sikkerhetskopi er valgfrie tilleggsfunksjoner.

## Dette er med

- Interaktivt kart med Trondheim som startområde, prismerker og prosjektpunkter.
- Offisielt adressesøk via Kartverkets Adresse REST-API, kommune 5001.
- Områdefilter, periode, BRA-i, maksimalpris og skille mellom egne salg og eksempeldata.
- Medianpris, pris per m², salgsantall, områdeanalyse og månedlig salgsvolum i det valgte datasettet.
- CSV- og JSON-import med validering. Samme salgs-ID oppdaterer en eksisterende rad.
- Prosjektkalkyle med dokumentavgift, oppussingsbuffer, finansiering, salgsomkostninger og løpende utgifter.
- Prosjektstatus, notater, faktiske oppussingskostnader og oppgaveliste.
- Scenarioanalyse ved ±5 % endring i forventet salgspris.
- Privat skylagring knyttet til admin-kontoen, eksport av salgsutvalg og valgfri sikkerhetskopiering.
- Registrer salg og lim inn CSV/JSON direkte på siden.
- Versjonskontroll som stopper gamle faner fra å overskrive nyere endringer.

## Datagrunnlag: ekte adresser, fiktive eksempelsalg

**De 40 medfølgende eksempelsalgene, adressene og salgsprisene er fiktive.** Kartpunktene er illustrative plasseringer i bydeler i Trondheim. Eksempelsalgene har datoer fra mai til november 2026 og oppdateres ikke automatisk. Standardfilteret er siste 90 dager; velg «Hele datasettet» for eldre salg.

Kartverkets oversikt over åpne eiendomsdata er undersøkt 12. november 2026:
https://www.kartverket.no/api-og-data/eiendomsdata/apent-tilgjengelige-data-og-tjenester

Siden beskriver blant annet adresser, bygningspunkt, eiendomsteiger og administrative grenser, og sier uttrykkelig at grunnboksdata ikke deles på Geonorge. **Denne åpne datakilden gir ikke en komplett strøm av nylige leilighetssalg med oppnådde salgspriser.** Verktøyet bruker derfor egen import for salgsdata; det er ikke integrert med en betalt salgstjeneste. Fullverdig salgsdekning krever en egnet dataleverandør, avtale og/eller egne kvalitetssikrede registreringer.

Integrert adresse-API:
`https://ws.geonorge.no/adresser/v1/sok?sok=...&kommunenummer=5001`

Bakgrunnskart: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright. Adressesøk og bakgrunnskart krever internett. Søketeksten sendes til Kartverkets adresse-API; OpenStreetMap mottar forespørsler for kartflisene du ser. Skrifttyper lastes fra Google Fonts, med systemskrift som reserve. Prosjekter og salgsdata sendes til Kvadrats private API og lagres i D1 under kontoens bruker-ID. Adressesøket går gjennom Kvadrats server til Kartverkets API.

Eiendomsgrenser, bygninger, automatisk salgsinnhenting og delte prosjektarbeidsområder er ikke implementert i denne versjonen. Innlogging og privat skybasert database er implementert.

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

## Skylagring og tilgang

Appen har egen innlogging på serveren. Publisert tilgang må settes til offentlig i Sites slik at innloggingssiden kan åpnes uten ChatGPT; dette gjør ikke prosjekt-API-et offentlig. Alle data- og adressesøk krever en gyldig serversesjon som varer frem til utlogging eller tilbakekalling. Kontonavnet er `admin`; innloggingsopplysninger ligger ikke i frontend eller i GitHub-repoet.

Passord lagres som saltet PBKDF2-SHA256-hash med 100 000 iterasjoner. Øktnøkler er tilfeldige 256-bits verdier; bare SHA-256-hashene lagres i databasen. Kapslene bruker HttpOnly, Secure, SameSite=Strict, Path=/ og __Host-prefiks. Innlogging og passordendring har en vedvarende grense på 10 forsøk per IP og 15-minutters tidsvindu. POST krever samme Origin. Utlogging tilbakekaller økten på serveren, og passordendring krever gjeldende passord og tilbakekaller andre økter. Nytt passord må ha minst 12 tegn.

`ADMIN_BOOTSTRAP_HASH` er en hemmelig runtime-variabel i Sites, med JSON-feltene `salt` (32–128 bokstav-/talltegn) og `hash` (64 heksadesimale tegn). Den brukes kun til å opprette admin-kontoen første gang og overskriver aldri et endret passord. Hashen beregnes med `passwordHash` i `worker/auth.js`. Klartekstpassordet skal ikke legges i kildekoden eller hostingmanifestet. Hvis eksisterende arbeidsområder fra tidligere innlogging skal overføres, settes `LEGACY_OWNER_ID` server-side til korrekt tidligere eier-ID. Kopiering skjer ved første admin-lesing uten å slette originalen eller overskrive et allerede opprettet admin-arbeidsområde. Alle med admin-passordet deler samme arbeidsområde.

`GET /api/workspace` henter eller oppretter kontoens arbeidsområde med fiktive eksempelsalg. `PUT /api/workspace` validerer alle data før en atomisk oppdatering. Oppdateringer krever riktig Origin, JSON og en `If-Match`-versjon. Ved samtidige endringer får den gamle versjonen HTTP 409. Siden ber deg hente siste versjon før du lagrer videre, og beholder skjemaet ved mislykket lagring. Bekreftet lagring vises som «Lagret på nett». Ingen prosjektdata skrives til `localStorage` eller IndexedDB.

Den samme kontoen ser lagrede data fra andre enheter. Bruk «Hent siste versjon» for å hente endringer; oversikten oppdateres også når fanen får fokus, så lenge du ikke redigerer et skjema. Dette er ikke samtidig samskriving.

Valgfri sikkerhetskopi kan eksporteres og gjenopprettes i nettleseren. Gjenoppretting erstatter gjeldende arbeidsområde etter bekreftelse. Eksisterende data fra versjon 1 kan flyttes med sikkerhetskopi-import; det gamle localhost-arbeidsområdet kan ikke leses fra den nye nettdomenen.

Maksimalt lagret arbeidsområde er 1 800 000 UTF-8-byte. API-et avviser større oppdateringer uten å endre data. De opprinnelige grensene på 5 000 salg og 5 MB per importfil gjelder i tillegg. De faktiske grensene avhenger dermed også av notat- og tekstlengder.

## Arkitektur og utvikling

```text
index.html / styles.css / app.js   Nettgrensesnitt med sky-API
core.js                            Delt validering og økonomiberegning
worker/index.js                    Autentisert API og statiske ressurser
worker/auth.js                     Passordhash, serverøkter og passordendring
.openai/hosting.json                Sites-ID og D1-binding
db/schema.js                       Databaseskjema (Drizzle)
drizzle/                           Versjonerte SQL-migreringer og metadata
scripts/build.mjs                  Pakker HTML/JS/CSS og Worker uten runtime-avhengigheter
scripts/dev-server.mjs             Kun for utviklere, aldri i hosted Worker
tests/                             Økonomi-, import- og API-tester
```

Utvikling krever Node.js 24+ og `npm ci`. `npm test` bygger appen og kjører 49 tester med en ekte SQLite-database i minnet. Testene kontrollerer blant annet kontoisolasjon, påloggingskrav, Origin, datavalidering, varig lagring og samtidige oppdateringer. `npm run db:generate` genererer schema-only-migreringer fra Drizzle-skjemaet. Hosted migreringer skal brukes av publiseringsflyten; tabeller opprettes aldri under API-kall.

`npm run build` produserer `dist/server/index.js` med alle nødvendige nettressurser innebygd, samt manifest og migreringer. Ingen utviklingsserver, lokal database eller lokale filer inngår i brukerflyten. `npm run dev` er en valgfri utviklerforhåndsvisning med en separat testdatabase og eksplisitt konfigurert testhash i `ADMIN_BOOTSTRAP_HASH`, som ikke publiseres.

Publisering styres av Sites. GitHub-repoet er kildekoden; Sites bruker sin tilknyttede kilderepo og en arkivpakke av nøyaktig samme commit for produksjon. Behold `.openai/hosting.json` sin prosjekt-ID ved senere oppdateringer. Hemmeligheter skal aldri legges i kildekoden.

## FINN-kandidater uten budsjettgrense

Startsiden «Boliger fra FINN» viser et avgrenset annonseutvalg og dine egne registreringer. Den har kart, fritekstsøk, statusfilter, oppussingsfilter, favoritter og sortering etter totalpris, pris inkl. gjeld per BRA-i, areal og kontrolltidspunkt. Ingen maksimalpris er forhåndsvalgt. Annonser holdes adskilt fra registrerte salg; prisantydninger brukes ikke i salgsstatistikken.

`data/listings.json` inneholder to kandidater funnet gjennom tilgjengelige annonseutdrag, kontrollert 13. november 2026. Status «Annonsert · ubekreftet» garanterer ikke at boligen fortsatt er tilgjengelig. Kartposisjonene er hentet fra Kartverket. Listen er **ikke hele FINN-markedet**, og det finnes ingen automatisk FINN-oppdatering i denne versjonen. Appen markerer dette eksplisitt og lenker til FINNs leilighetssøk for Trondheim.

Direkte henting av FINNs søkeside returnerte 403 med JavaScript-/anti-bot-kontroll i utviklingsmiljøet. Ingen omgåelse er implementert. FINNs dokumenterte API er normalt begrenset til annonsedata man selv eier eller forvalter: https://www.finn.no/api/ og https://hjelpesenter.finn.no/hc/no/articles/22629030477202-API . En komplett løpende markedsoversikt krever en egnet dataleveranse med dekning og bruksrettigheter. En vanlig annonsør-API-nøkkel gir ikke automatisk rett eller tilgang til alle boliger i Trondheim.

På siden kan du lagre annonser med FINN-lenke og opplysninger eller lime inn en JSON-liste. FINN-lenken henter ikke automatisk annonseinnhold. Samme FINN-kode oppdaterer samme kandidat. Egne endringer og favoritter lagres i kontoens skylagring og følger med sikkerhetskopien. Eldre sikkerhetskopier uten `listings` støttes fortsatt.

«Vis på kart» slår opp manglende koordinater hos Kartverket og godtar bare ett eksakt adressetreff. Ukjente posisjoner vises aldri som et vilkårlig sentrumspunkt. «Vurder prosjekt» overfører prisantydning, fellesgjeld og øvrige oppgitte kostnader til prosjektkalkylen. Forventet salg settes lik prisantydning og oppussingsbudsjettet til 0; dette er ikke en lønnsomhetsprognose. Brukeren må sette egne forutsetninger. Annonser markert solgt eller trukket har ikke prosjektknapp aktivert.

### Innloggingstransport og feilsvar

Klienten sender innloggingshandlinger som vanlige URL-kodede skjemadata til `/kvadrat-auth/login`, `/kvadrat-auth/logout` og `/kvadrat-auth/password`. Disse app-eide rutene ligger utenfor vertsleverandørens `/api/auth/`-navnerom. De gamle JSON-rutene beholdes for bakoverkompatibilitet, med samme ratebegrensning og øktkontroll.

`auth-client.js` kontrollerer Content-Type og svarstruktur før JSON brukes. HTML-feilsider fra hosting, mellomlagring eller sikkerhetsgateway vises aldri som rå JSON-parserfeil eller HTML i brukergrensesnittet. Klienten viser en norsk melding med HTTP-status. Innlogging regnes først som bekreftet når serveren svarer med riktig bruker. De automatiserte testene dekker HTML-svar med både suksess- og feilstatus, ugyldig JSON, skjemakoding av spesialtegn og hele klient–Worker–SQLite-flyten.

## GitHub Pages-adressen beholdes

Grensesnittet kjører på `https://phongtrl.github.io/Kvadrat/` uten videresending. `api-client.js` sender kun API-kall til den publiserte Worker-serveren. Statiske JSON-filer lastes relativt til modulen, slik at `/Kvadrat/`-undermappen støttes. Backend tillater CORS kun fra sin egen opprinnelse og `https://phongtrl.github.io`, med eksplisitt forhåndskontroll av metode og headere.

GitHub-grensesnittet sender ikke eller mottar øktkapsler fra et annet nettsted. Etter gyldig innlogging får det en tilfeldig øktnøkkel som lagres i localStorage på GitHub-opprinnelsen og sendes i Authorization-headeren. Brukernavn og passord lagres ikke i nettleseren eller i URL. Økten gjenopprettes ved omlasting og gjenåpning, og fjernes ved utlogging eller HTTP 401. Andre faner oppdager utlogging gjennom storage-hendelsen. Samme-origin-bruk på Worker-domenet bruker sikre HttpOnly-kapsler med nettleserens maksimale levetid på 400 dager. Serversesjoner avsluttes ved utlogging eller passordendring; sletting av nettleserdata krever ny innlogging. Lokal lagring som er blokkert av nettleseren, gir kun innlogging i gjeldende sideøkt.
