// Offisiell kommunestatistikk holdes separat fra geokodede enkeltsalg.
export function marketRows(dataset,type='03'){
  const ids=dataset.id, sizes=dataset.size;
  const index=(code,value)=>dataset.dimension[code].category.index[value];
  return Object.keys(dataset.dimension.Tid.category.index).sort().map(period=>{
    const value=metric=>{
      const values={Region:'5001',Boligtype:type,ContentsCode:metric,Tid:period};
      const offset=ids.reduce((sum,id,i)=>sum*sizes[i]+index(id,values[id]),0);
      return dataset.value[offset]??null;
    };
    return {period,price:value('KvPris'),count:value('Omsetninger')};
  }).slice(-4);
}
export async function loadHistoricalMarket(){
  const panels=[...document.querySelectorAll('[data-historical-market]')];
  try{
    const response=await fetch(new URL('./data/ssb-trondheim.json',import.meta.url));
    if(!response.ok)throw new Error('Historiske tall kunne ikke lastes.');
    const dataset=await response.json();
    for(const panel of panels){
      panel.innerHTML=`<div class="historical-heading"><div><span class="pill green">EKTE DATA · SSB</span><h2>Boligmarkedet i Trondheim</h2><p>Fire siste publiserte kvartaler · oktober 2025–september 2026</p></div><label>Boligtype<select aria-label="Boligtype for SSB-statistikk"><option value="03">Blokkleiligheter</option><option value="00">Alle boligtyper</option><option value="01">Eneboliger</option><option value="02">Småhus</option></select></label></div><div class="historical-values"></div><div class="historical-table"></div><p class="small-copy">Offisiell statistikk for hele kommunen, uavhengig av kartfiltrene. Gjennomsnittlig pris per m² BRA-i, ikke median. Antall gjelder SSBs statistikkgrunnlag. Kvartalstallene viser sammensetningen av omsatte boliger og er ikke en prisindeks. Tallene gir ikke adresser eller verdivurdering av en bestemt bolig.</p><p class="small-copy">Kilde: <a href="https://www.ssb.no/statbank/table/14310" target="_blank" rel="noopener">SSB, tabell 14310 ↗</a> · Oppdatert hos SSB 12.10.2026 · Hentet 13.11.2026 · <a href="./data/ssb-trondheim.json" download>Last ned kildedata (JSON)</a></p>`;
      const draw=()=>{
        const rows=marketRows(dataset,panel.querySelector('select').value), latest=rows.at(-1);
        const n=v=>v===null?'Ikke publisert':new Intl.NumberFormat('nb-NO').format(v);
        const total=rows.every(r=>r.count!==null)?rows.reduce((s,r)=>s+r.count,0):null;
        panel.querySelector('.historical-values').innerHTML=`<div><small>Pris per m² · ${latest.period}</small><strong>${n(latest.price)} kr</strong></div><div><small>Omsetninger · fire kvartaler</small><strong>${n(total)}</strong></div><div><small>Omsetninger · ${latest.period}</small><strong>${n(latest.count)}</strong></div>`;
        panel.querySelector('.historical-table').innerHTML=`<table><caption class="sr-only">Kvartalsvise priser og salgsvolum fra SSB</caption><thead><tr><th scope="col">Kvartal</th><th scope="col">Gj.snitt kr/m²</th><th scope="col">Omsetninger</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${r.period}</th><td>${n(r.price)}</td><td>${n(r.count)}</td></tr>`).join('')}</tbody></table>`;
      };
      panel.querySelector('select').addEventListener('change',draw);draw();
    }
  }catch{for(const panel of panels)panel.textContent='SSB-tallene kunne ikke lastes. Last siden på nytt for å prøve igjen.';}
}
