# Historiske markedsdata

`ssb-trondheim.json` er et uendret JSON-stat2-svar fra SSBs åpne API,
hentet 13.11.2026. Spørringen ligger i `ssb-query.json` (fylke 50 og alle 38 kommuner i Trøndelag,
alle boligtyper og statistikkvariabler, 2025K1–2026K3).

Kilde: https://www.ssb.no/statbank/table/14310
API: https://data.ssb.no/api/v0/no/table/14310

Reproduser uttrekket med en HTTP POST til API-adressen, Content-Type
application/json og innholdet i ssb-query.json som request body. API-svaret
har official-statistics=true og copyright=false. SSB oppgir at kvadratmeterprisen
gjelder internt bruksareal (BRA-i), jf. NS 3940:2023.

Appen viser de fire siste publiserte kvartalene. Dette er fylkes- og kommunestatistikk,
ikke geokodede enkeltsalg. Data lagres som publisert, uten beregning av
fiktive adresser eller fordeling på bydeler. Kvartalsprisene skal ikke tolkes
som prisindeks. Nye uttrekk krever også oppdatering av periodetekst og
kildedato i historical-market.js.

## Søkeprioritet

Markedsanalysen rangerer kommuner med minst 50 omsetninger over fire kvartaler,
publiserte positive antall i hvert kvartal og positiv publisert pris i siste
kvartal. Poeng = 60 × ln(1 + antall) / ln(1 + høyeste antall) +
40 × laveste pris / kommunens pris. Sammenligningen gjelder valgt boligtype.
Dette er en egen modell for å prioritere videre undersøkelser, ikke et SSB-mål
eller et estimat på lønnsomhet. Null/manglende verdier erstattes ikke med nullpris.

Budrammekalkylen er en separat illustrasjon for selveier uten fellesgjeld,
med 15 % oppussingsbuffer, 2,5 % dokumentavgift (grunnlag antatt lik kjøpspris),
brukerens øvrige kostnader og ønsket fortjeneste før skatt. SSB-pris × areal
er kun et redigerbart startanslag, uten noen premie for oppussing.
Stresscenarioet reduserer salgspris med 10 % og øker oppussing inklusive
buffer med 20 %, mens andre kostnader holdes faste.
