import {calculate} from './core.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=0)=>Number.isFinite(v)?new Intl.NumberFormat('nb-NO',{maximumFractionDigits:d}).format(v):'–';
export function indexSeries(data,region){
 const ids=data.id,sizes=data.size;
 return Object.keys(data.dimension.Tid.category.index).sort().map(period=>{const values={Region:region,Boligtype:'00',ContentsCode:'SesJustBoligindeks',Tid:period};const offset=ids.reduce((s,id,i)=>s*sizes[i]+data.dimension[id].category.index[values[id]],0);return {period,value:data.value[offset]??null};});
}
function trend(values,horizon=4){
 const logs=values.slice(-12).map(Math.log),mean=logs.reduce((s,v)=>s+v,0)/logs.length,mid=(logs.length-1)/2;
 const slope=logs.reduce((s,y,i)=>s+(i-mid)*(y-mean),0)/logs.reduce((s,_,i)=>s+(i-mid)**2,0);
 // Half the fitted trend, bounded to +/- 10% annually, to avoid extreme extrapolation.
 const annual=Math.max(-.1,Math.min(.1,Math.expm1(slope*4*.5)));
 return values.at(-1)*(1+annual)**(horizon/4);
}
export function forecastIndex(series){
 if(series.length<24||series.some((r,i)=>!Number.isFinite(r.value)||r.value<=0||(i&&quarter(r.period)!==quarter(series[i-1].period)+1)))return null;
 const values=series.map(r=>r.value),errors=[];
 for(let origin=values.length-12;origin<=values.length-5;origin++){
  const training=values.slice(0,origin+1),actual=values[origin+4];
  errors.push({model:Math.abs(trend(training)/actual-1)*100,flat:Math.abs(training.at(-1)/actual-1)*100});
 }
 const average=key=>errors.reduce((s,e)=>s+e[key],0)/errors.length,modelError=average('model'),flatError=average('flat');
 const selected=modelError<flatError?'trend':'flat',latest=values.at(-1),central=selected==='trend'?trend(values):latest;
 return {latest,central,low:central*.95,high:central*1.05,annual:central/latest-1,selected,modelError,flatError,tests:errors.length,period:series.at(-1).period,target:periodLabel(quarter(series.at(-1).period)+4),yearChange:latest/values.at(-5)-1};
}
function quarter(period){const match=/^(\d{4})K([1-4])$/.exec(period);return match?Number(match[1])*4+Number(match[2])-1:NaN;}
function periodLabel(q){return `${Math.floor(q/4)}K${q%4+1}`;}
export function projectScenario(project,{annual=0,overrun=20,delay=3,rate=2,target=300000}={}){
 if(![annual,overrun,delay,rate,target].every(Number.isFinite)||annual<=-100||overrun<0||delay<0||rate<0||target<0)throw new Error('Ugyldige scenarioforutsetninger.');
 const adjusted={...project,resale:project.resale*(1+annual/100)**(project.months/12)},base=calculate(adjusted);
 const stress={...adjusted,resale:adjusted.resale*.9,renovation:base.renovation*(1+overrun/100),contingency:0,expenses:[],months:project.months+delay,interest:project.interest+rate};
 const downside=calculate(stress), margin=adjusted.resale?base.profit/adjusted.resale*100:0;
 // Search the same financing/cost model, including equity and document duty, for a bid limit.
 const atPurchase=price=>calculate({...adjusted,purchase:price,stampBase:project.ownership==='selveier'?price:0}).profit;
 let low=0,high=Math.max(project.purchase,adjusted.resale,1),iterations=0;
 while(atPurchase(high)>target&&iterations++<40)high*=2;
 const feasible=atPurchase(0)>=target;
 if(feasible)for(let i=0;i<60;i++){const mid=(low+high)/2;if(atPurchase(mid)>=target)low=mid;else high=mid;}
 return {base,downside,margin,bid:feasible?low:null,breakEven:base.total,cushion:adjusted.resale?base.profit/adjusted.resale*100:0,adjustedResale:adjusted.resale,verdict:base.profit<target?'Under resultatmål':downside.profit<0?'Taper i stresscenario':'Tåler valgt stress'};
}
export function createProfitPlanner({getState,openProject}){
 const root=document.querySelector('#profit-planner');let dataset;
 root.innerHTML=`<div class="eyebrow">MARKEDSUTSIKTER OG BESLUTNINGSSTØTTE</div><h2>Kjøp med en margin som tåler motgang</h2><p>Se markedssignaler og finn hvilke av dine prosjektkalkyler som tåler et svakere marked. Ingen av scenariene er et løfte om avkastning.</p><label>Prisindeksregion<select id="forecast-region"><option value="004">Trondheim</option><option value="010">Trøndelag uten Trondheim</option></select></label><div id="forecast-content" aria-live="polite">Laster SSBs prisindeks …</div><h3>Sammenlign dine prosjektkalkyler</h3><form id="planner-form"><div class="form-row thirds"><label>Årlig justering av salgsanslag, %<input name="annual" type="number" step="any" min="-50" max="50" value="0" required></label><label>Ønsket fortjeneste før skatt, kr<input name="target" type="number" step="any" min="0" value="300000" required></label><label>Oppussing dyrere i stress, %<input name="overrun" type="number" step="any" min="0" max="500" value="20" required></label></div><div class="form-row"><label>Ekstra eiertid i stress, måneder<input name="delay" type="number" step="1" min="0" max="60" value="3" required></label><label>Renteøkning i stress, prosentpoeng<input name="rate" type="number" step="any" min="0" max="30" value="2" required></label></div><button type="submit" class="button primary">Oppdater vurdering</button></form><p class="small-copy">Standardverdiene er egne scenarioantakelser. Justering av salgsanslag beregnes over hvert prosjekts oppgitte eiertid og er relativ til ditt lagrede anslag. Bruk 0 hvis anslaget allerede gjelder salgsdatoen. Stress inkluderer dessuten 10 % lavere salgspris. Kostnadsøkningen gjelder hele oppussingsanslaget inklusive buffer og eventuelt allerede påløpte kostnader, som en konservativ sammenligning. Endringer her endrer ikke lagrede prosjekter.</p><div id="planner-projects" aria-live="polite"></div>`;
 const form=root.querySelector('form');
 function renderForecast(){
  if(!dataset)return;const region=root.querySelector('#forecast-region').value,series=indexSeries(dataset,region),f=forecastIndex(series),target=root.querySelector('#forecast-content');
  if(!f){target.textContent='For lite sammenhengende prisindeksdata til å beregne scenario.';return;}
  const history=series.slice(-8),all=[...history.map(r=>r.value),f.low,f.high],min=Math.min(...all)*.98,max=Math.max(...all)*1.02,y=v=>130-(v-min)/(max-min)*110;
  const path=history.map((r,i)=>`${i?'L':'M'}${i*40+20},${y(r.value)}`).join(' ');
  target.innerHTML=`<div class="historical-values"><div><small>Historisk årsvekst · ${f.period}</small><strong>${n(f.yearChange*100,1)} %</strong></div><div><small>Modellscenario · til ${f.target}</small><strong>${n(f.annual*100,1)} %</strong></div><div><small>Valgt enkel modell</small><strong>${f.selected==='flat'?'Uendret nivå':'Dempet trend'}</strong></div></div><svg class="forecast-chart" viewBox="0 0 500 175" role="img" aria-label="Historisk sesongjustert prisindeks og tre illustrative scenarioer frem til ${f.target}"><path d="${path}" fill="none" stroke="#284f3f" stroke-width="3"/><path d="M300,${y(f.latest)} L460,${y(f.central)}" fill="none" stroke="#284f3f" stroke-width="3" stroke-dasharray="5 5"/><path d="M300,${y(f.latest)} L460,${y(f.low)} M300,${y(f.latest)} L460,${y(f.high)}" fill="none" stroke="#b27d48" stroke-width="2" stroke-dasharray="4 4"/><text x="20" y="165">${history[0].period}</text><text x="270" y="165">${f.period}</text><text x="430" y="165">${f.target}</text></svg><div class="historical-table"><table><thead><tr><th>Prisindeks · 2015=100</th><th>Historisk ${f.period}</th><th>Lavt scenario ${f.target}</th><th>Modellscenario ${f.target}</th><th>Høyt scenario ${f.target}</th></tr></thead><tbody><tr><th>Alle boligtyper</th><td>${n(f.latest,1)}</td><td>${n(f.low,1)}</td><td>${n(f.central,1)}</td><td>${n(f.high,1)}</td></tr></tbody></table></div><details><summary>Metode og historisk kontroll</summary><p>SSBs sesongjusterte prisindeks, alle boligtyper, fra 2016. Trend er lineær regresjon av log-indeks over 12 kvartaler, halvert og begrenset til ±10 % årlig. Åtte rullerende historiske tester med fire kvartalers horisont bruker bare data kjent ved hver testdato. Gjennomsnittlig absolutt prosentfeil: trend ${n(f.modelError,1)} %, uendret nivå ${n(f.flatError,1)} %. Modellen med lavest historisk feil velges. Testene overlapper; dette er ikke uavhengig validering av modellvalget. Resultatene er ikke sannsynligheter. Lavt/høyt scenario er ±5 % rundt modellnivået, egne antakelser uten kalibrert konfidensnivå. Horisonten regnes fra siste SSB-kvartal, ikke dagens dato.</p></details><p class="small-copy">Kilde: <a href="https://www.ssb.no/statbank/table/07221" target="_blank" rel="noopener">SSB 07221</a> · Hentet 13.11.2026 · Indeksen er ikke kr/m² og gir ikke forventet pris for en bestemt bolig. Bruk ikke markedets prisvekst som erstatning for verdiskaping i prosjektet.</p>`;
 }
 function render(){
  if(!form.checkValidity()){root.querySelector('#planner-projects').textContent='Fyll inn gyldige scenarioforutsetninger og velg Oppdater vurdering.';return;}
  const settings=Object.fromEntries(new FormData(form));for(const key of Object.keys(settings))settings[key]=Number(settings[key]);
  const projects=getState().projects.filter(p=>p.status!=='Solgt').map(p=>({p,s:projectScenario(p,settings)})).sort((a,b)=>b.s.downside.profit-a.s.downside.profit);
  root.querySelector('#planner-projects').innerHTML=projects.length?`<p>Sortert etter fortjeneste i stresscenario. Historiske prosjekter med status «Solgt» er utelatt. Alle beløp er før skatt.</p><div class="historical-table"><table><thead><tr><th>Prosjekt</th><th>Grunnscenario</th><th>Stresscenario</th><th>Nullpunkt salgspris</th><th>Tåler prisfall</th><th>Budgrense for resultatmål</th><th>Vurdering</th></tr></thead><tbody>${projects.map(({p,s})=>`<tr><th><button class="text-button" data-planner-project="${esc(p.id)}">${esc(p.address)}</button></th><td>${n(s.base.profit)} kr<br><small>${n(s.margin,1)} % av salg</small></td><td class="${s.downside.profit<0?'negative':'positive'}">${n(s.downside.profit)} kr</td><td>${n(s.breakEven)} kr</td><td>${n(Math.max(0,s.cushion),1)} %</td><td>${s.bid===null?'Ingen positiv budramme':n(s.bid)+' kr'}${s.bid!==null&&p.purchase>s.bid?`<br><small>Kjøpspris ligger ${n(p.purchase-s.bid)} kr over grensen</small>`:''}</td><td>${s.verdict}</td></tr>`).join('')}</tbody></table></div><p class="small-copy">Nullpunkt og prisfallmargin gjelder grunnscenarioets kostnader. Budgrensen bruker samme kostnads- og rentemodell som prosjektet, med dokumentavgiftsgrunnlag lik kjøpspris for selveier. For kjøpte boliger er budgrensen bare en sammenligningsverdi. Fellesgjeld antas overført uendret. Skatt, endret fellesgjeld og rente på renter er ikke beregnet.</p><div class="notice"><strong>Prioriter dokumentert margin.</strong> Undersøk først prosjekter som tåler stress og når resultatmålet. Ved tap i stress: reduser budet, innhent bindende håndverkertilbud eller revurder prosjektet. Ingen rad betyr at kjøp er godkjent; salgsanslag og kostnader må kontrolleres.</div>`:'<p><a href="#prosjekter">Opprett et prosjekt</a> med kjøpspris, realistisk salg og kostnader for å få en konkret vurdering her.</p>';
  root.querySelectorAll('[data-planner-project]').forEach(button=>button.onclick=()=>openProject(button.dataset.plannerProject));
 }
 form.addEventListener('submit',e=>{e.preventDefault();render();});root.querySelector('#forecast-region').onchange=renderForecast;
 fetch(new URL('./data/ssb-price-index.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{dataset=data;renderForecast();}).catch(()=>root.querySelector('#forecast-content').textContent='Prisindeksen kunne ikke lastes. Prosjektkalkylene kan fortsatt brukes.');
 return {render};
}
