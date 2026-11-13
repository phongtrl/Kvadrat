import {postAuth,readApiResponse} from './auth-client.js';
import {createListingOverview} from './listings.js';
import {SCHEMA_VERSION,NUMERIC_FIELDS,calculate,median,parseCSV,validateSale,validateSales,validateProject,validateBackup,csvExport} from './core.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=0)=>Number.isFinite(n)?new Intl.NumberFormat('nb-NO',{maximumFractionDigits:d,minimumFractionDigits:d}).format(n):'–';
const kr=n=>`${num(n)} kr`, pct=n=>`${num(n,1)} %`;
const short=n=>`${num(n/1e6,2)} mill.`;
const dateLabel=s=>new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(s+'T12:00:00'));
const icons={
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  folder:'<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9h18"/>',
  chart:'<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4M18 4h4"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h2M13 15h2"/>',
  sliders:'<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  locate:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  building:'<path d="M4 21V7l8-4 8 4v14M2 21h20M9 21v-5h6v5M8 9h1M15 9h1M8 12h1M15 12h1"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  trend:'<path d="m3 17 7-7 4 4 7-10M15 4h6v6"/>',
  coins:'<ellipse cx="10" cy="5" rx="7" ry="3"/><path d="M3 5v5c0 3 14 3 14 0V5M3 10v5c0 3 14 3 14 0v-5M17 9c5 0 6 5 2 7v4c-1 2-5 2-8 1v-3"/>',
  check:'<path d="m5 12 4 4L19 6"/>'
};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.building}</svg>`;}
function renderIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
renderIcons();

let state={schemaVersion:SCHEMA_VERSION,sales:[],projects:[]}, demoSales=[],filtered=[],map,markerGroup,addressMarker,selectedId=null,currentPage='annonser',editingExpenses=[],editingTasks=[],revision=null,saving=false,ready=false,needsReload=false;
let listingUI;
let toastTimer;
function toast(message,error=false){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.toggle('error',error);$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
function syncStatus(message,problem=false){$('.local-status').textContent=message;$('.local-status').classList.toggle('sync-problem',problem);}
async function commit(next){
  if(!ready||saving||needsReload){toast(needsReload?'Hent siste versjon før du lagrer.':'Vent til arbeidsområdet er klart.',true);return false;}
  saving=true;syncStatus('Lagrer på nett …');
  try{
    const response=await fetch('/api/workspace',{method:'PUT',credentials:'same-origin',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','If-Match':String(revision)},body:JSON.stringify(next)});
    const result=await readApiResponse(response);
    if(!response.ok){if(response.status===409)needsReload=true;if(response.status===401)showLogin();throw new Error(result.error||'Lagring mislyktes.');}
    revision=result.revision;state=next;syncStatus('Lagret på nett');return true;
  }catch(e){syncStatus(needsReload?'Ny versjon tilgjengelig':'Ikke lagret',true);toast(`${e.message} Endringene er ikke bekreftet lagret.`,true);return false;}
  finally{saving=false;}
}
async function loadWorkspace(background=false){
  if(saving)return;
  if(!background){$('main').inert=true;syncStatus('Kobler til …');}
  try{
    const response=await fetch('/api/workspace',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Logg inn for å åpne arbeidsområdet.');
    const result=await readApiResponse(response);if(response.status===401){showLogin();return;}if(!response.ok)throw new Error(result.error||'Arbeidsområdet kunne ikke lastes.');
    if(saving||$('#project-dialog').open||$('#sale-dialog').open||$('#listing-dialog').open||$('#listing-import-dialog').open)return;
    state=validateBackup(result.workspace);revision=result.revision;ready=true;needsReload=false;
    $('#cloud-error').hidden=true;$('#login-screen').hidden=true;document.body.classList.remove('signed-out');$('main').inert=false;syncStatus('Lagret på nett');route();
    $('#account-name').textContent=result.user.displayName;renderAll();
  }catch(e){syncStatus('Frakoblet',true);if(document.body.classList.contains('signed-out')){$('#login-error').textContent='Kunne ikke koble til serveren. Prøv igjen.';$('#login-error').hidden=false;}if(!background){$('#cloud-error-message').textContent=e.message;$('#cloud-error').hidden=false;}}
  finally{if(ready)$('main').inert=false;}
}

function backup(){download(`kvadrat-sikkerhetskopi-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),'application/json');toast('Sikkerhetskopi lastet ned.');}
function download(name,content,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function confirmAction(title,message){const d=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;d.returnValue='';d.showModal();return new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true}));}

function stat(label,value,unit,foot,ico='trend'){return `<article class="stat-card"><div class="stat-label">${escape(label)}</div><span class="stat-decoration">${icon(ico)}</span><div class="stat-value">${value} <small>${escape(unit)}</small></div><div class="stat-foot">${foot}</div></article>`;}
function currentFilters(){const limit=s=>$(s).value===''?Infinity:Number($(s).value);return {district:$('#area-filter').value,period:$('#period-filter').value,min:Number($('#min-area').value)||0,max:limit('#max-area'),price:limit('#max-price'),origin:$('#origin-filter').value};}
function getFiltered(){
  const f=currentFilters(),today=new Date();today.setHours(23,59,59,999);const cutoff=new Date();cutoff.setHours(0,0,0,0);cutoff.setDate(cutoff.getDate()-Number(f.period));
  return state.sales.filter(s=>(!f.district||s.district===f.district)&&(f.period==='all'||new Date(s.date+'T12:00:00')>=cutoff)&&new Date(s.date+'T12:00:00')<=today&&s.area>=f.min&&s.area<=f.max&&s.price<=f.price&&(f.origin==='all'||(f.origin==='real'?!s.demo:s.demo))).sort((a,b)=>b.date.localeCompare(a.date));
}
function refreshAreaOptions(){const value=$('#area-filter').value;const districts=[...new Set(state.sales.map(s=>s.district))].sort((a,b)=>a.localeCompare(b,'nb'));$('#area-filter').innerHTML='<option value="">Alle områder</option>'+districts.map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join('');if(districts.includes(value))$('#area-filter').value=value;}
function renderMarket(){
  filtered=getFiltered();const demoCount=filtered.filter(s=>s.demo).length;const unitMedian=median(filtered.map(s=>s.price/s.area));const medPrice=median(filtered.map(s=>s.price));const medArea=median(filtered.map(s=>s.area));
  $('#market-stats').innerHTML=stat('Median pris per m²',num(unitMedian),'kr / m²',`${demoCount?'<span>Eksempeldata i utvalget</span>':'Beregnet fra importerte salg'}`,'chart')+stat('Solgte boliger',num(filtered.length),'salg','I valgt område og periode','building')+stat('Median salgspris',medPrice===null?'–':num(medPrice/1e6,2),'mill. kr','Kontant salgspris i datasettet','coins')+stat('Median boligstørrelse',num(medArea),'m² BRA-i','Blant boligene i utvalget','map');
  const strip=$('.demo-strip');strip.hidden=!state.sales.some(s=>s.demo);
  const count=[Number(!!$('#min-area').value),Number(!!$('#max-area').value),Number(!!$('#max-price').value),Number($('#origin-filter').value!=='all')].reduce((a,b)=>a+b,0);$('#filter-count').textContent=count?`(${count})`:'';
  $('#sale-count').textContent=filtered.length;
  $('#sales-table').innerHTML=filtered.map(s=>`<tr><td><div class="address-cell"><span class="building-symbol">${icon('building')}</span><div><strong>${escape(s.address)}</strong><small>${escape(s.district)} · Trondheim</small></div></div></td><td>${escape(dateLabel(s.date))}</td><td>${num(s.area)} m²</td><td class="money">${kr(s.price)}</td><td>${num(s.price/s.area)} kr</td><td><span class="pill ${s.demo?'':'green'}" title="${escape(s.source)}">${s.demo?'Eksempeldata':escape(s.source.slice(0,30))}</span></td><td><button class="table-action" data-sale="${escape(s.id)}" aria-label="Se ${escape(s.address)}">${icon('arrow')}</button></td></tr>`).join('');
  $('#sales-empty').hidden=filtered.length>0;
  if(selectedId&&!filtered.some(s=>s.id===selectedId))selectedId=null;
  renderMarkers();renderInsight();if(currentPage==='analyse')renderAnalysis();
}
function monthlyGroups(rows,limit=6){
  if(!rows.length)return [];
  const end=rows.reduce((a,b)=>a>b.date?a:b.date,rows[0].date);const d=new Date(end+'T12:00:00');d.setDate(1);const groups=[];
  for(let i=limit-1;i>=0;i--){const month=new Date(d.getFullYear(),d.getMonth()-i,1);const key=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}`;const sales=rows.filter(s=>s.date.startsWith(key));groups.push({key,label:new Intl.DateTimeFormat('nb-NO',{month:'short'}).format(month),sales});}
  return groups;
}
function sparkline(rows){
  const groups=monthlyGroups(rows).filter(g=>g.sales.length);if(groups.length<2)return '<div class="insight-note">For lite datagrunnlag til en prislinje.</div>';
  const values=groups.map(g=>median(g.sales.map(s=>s.price/s.area)));const min=Math.min(...values)*.97,max=Math.max(...values)*1.03;const points=values.map((v,i)=>[i*220/(values.length-1),49-(v-min)/(max-min)*42]);const path=points.map((p,i)=>`${i?'L':'M'}${p.join(',')}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 220 55" preserveAspectRatio="none" role="img" aria-label="Median kvadratmeterpris per måned i utvalget"><line x1="0" y1="53" x2="220" y2="53"/><path class="area" d="${path} L220,55 L0,55 Z"/><path class="line" d="${path}"/></svg>`;
}
function renderInsight(){
  const sale=filtered.find(s=>s.id===selectedId);
  if(sale){$('#insight-panel').innerHTML=`<div class="insight-label">VALGT BOLIG <button class="insight-close" id="close-insight">Oversikt ${icon('close')}</button></div><div class="area-heading"><span class="area-icon">${icon('building')}</span><div><h2 style="font-size:16px">${escape(sale.address)}</h2><small>${escape(sale.district)} · Trondheim</small></div></div><span class="pill ${sale.demo?'':'green'}">${sale.demo?'Fiktiv bolig og salgspris':escape(sale.source)}</span><div class="insight-rows"><div class="insight-row"><span>Salgspris</span><strong>${kr(sale.price)}</strong></div><div class="insight-row"><span>Pris per m²</span><strong>${num(sale.price/sale.area)} kr</strong></div><div class="insight-row"><span>BRA-i</span><strong>${num(sale.area)} m²</strong></div><div class="insight-row"><span>Solgt dato</span><strong>${escape(dateLabel(sale.date))}</strong></div></div><p class="insight-note">Bruk boligen som utgangspunkt for en egen kalkyle. Forventet salgspris må vurderes ut fra tilstand og sammenlignbare salg.</p><button class="button primary" id="project-from-sale">${icon('plus')} Opprett prosjekt her</button>`;
    $('#close-insight').onclick=()=>{selectedId=null;renderMarkers();renderInsight();};$('#project-from-sale').onclick=()=>openProject(null,{address:sale.address,name:`Prosjekt · ${sale.district}`,lat:sale.lat,lng:sale.lng,area:sale.area,purchase:sale.price,stampBase:sale.price,resale:sale.price,notes:sale.demo?'Opprettet fra fiktive eksempeldata. Erstatt adresse og priser med reelle opplysninger.':`Sammenligningssalg: ${sale.source}, ${sale.date}.`});return;
  }
  const f=currentFilters(),title=f.district||'Trondheim';const average=filtered.length?filtered.reduce((s,r)=>s+r.area,0)/filtered.length:null;
  $('#insight-panel').innerHTML=`<div class="insight-label">OMRÅDEINNSIKT ${icon('spark')}</div><div class="area-heading"><span class="area-icon">${icon('pin')}</span><div><h2>${escape(title)}</h2><small>${f.district?'Trondheim kommune':'Trøndelag · kommune 5001'}</small></div></div><div class="insight-rows"><div class="insight-row"><span>Salg i utvalget</span><strong>${filtered.length} boliger</strong></div><div class="insight-row"><span>Median pris / m²</span><strong>${num(median(filtered.map(s=>s.price/s.area)))} kr</strong></div><div class="insight-row"><span>Gj.snittlig størrelse</span><strong>${num(average)} m²</strong></div><div class="insight-row"><span>Datagrunnlag</span><strong>${filtered.some(s=>s.demo)?'Inkl. eksempeldata':filtered.length?'Importerte salg':'Ingen salg'}</strong></div></div><div class="mini-chart"><div class="mini-chart-label"><span>Median m²-pris per måned</span><span>Utvalget</span></div>${sparkline(filtered)}</div><p class="insight-note">Et utvalg, ikke hele markedet. Små utvalg og ulik boligstandard kan gi store utslag.</p><a class="button light" href="#analyse">Se markedsanalyse ${icon('arrow')}</a>`;
}
function initMap(){
  if(!window.L){$('#map-failure').hidden=false;return;}
  map=L.map('map',{zoomControl:false,scrollWheelZoom:false}).setView([63.431,10.408],13);
  L.control.zoom({position:'topright'}).addTo(map);
  const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
  let tileErrors=0;tiles.on('tileerror',()=>{if(++tileErrors>=5){$('#map-failure').textContent='Bakgrunnskartet er utilgjengelig. Salgspunkter, listevisning og kalkyler kan fortsatt brukes.';$('#map-failure').hidden=false;}});tiles.on('tileload',()=>{$('#map-failure').hidden=true;tileErrors=0;});
  markerGroup=L.layerGroup().addTo(map);
  $('#map-home').onclick=()=>{map.setView([63.431,10.408],13);map.invalidateSize();};
}
function renderMarkers(){
  if(!markerGroup)return;markerGroup.clearLayers();
  // Behold alle salg i liste og analyse; begrens antall kartmarkører for nettleserytelse.
  const visible=filtered.slice(0,500);
  for(const s of visible){const marker=L.marker([s.lat,s.lng],{icon:L.divIcon({className:'',html:`<div class="price-marker ${selectedId===s.id?'selected':''}">${short(s.price)}</div>`,iconSize:[76,30],iconAnchor:[38,30]}),title:`${s.address}: ${kr(s.price)}${s.demo?' (eksempeldata)':''}`,keyboard:true}).addTo(markerGroup);marker.on('click',()=>selectSale(s.id,false));}
  for(const p of state.projects){L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:`<div class="price-marker project-marker">${icon('folder')} Prosjekt</div>`,iconSize:[95,32],iconAnchor:[47,32]}),title:p.name}).addTo(markerGroup).on('click',()=>openProject(p.id));}
  if(filtered.length>500)toast('Kartet viser de 500 nyeste salgene. Listen og analysen inkluderer hele utvalget.');
}
function selectSale(id,fly=true){selectedId=id;if($('#map-layout').classList.contains('list-only'))setMapView(true);renderMarkers();renderInsight();const s=filtered.find(x=>x.id===id);if(map&&s&&fly){map.setView([s.lat,s.lng],15);$('#map-layout').scrollIntoView({behavior:'smooth',block:'center'});}}
function setMapView(show){$('#map-layout').classList.toggle('list-only',!show);$('#map-view').classList.toggle('active',show);$('#list-view').classList.toggle('active',!show);$('#map-view').setAttribute('aria-pressed',show);$('#list-view').setAttribute('aria-pressed',!show);if(show&&map)setTimeout(()=>map.invalidateSize(),50);}

function renderProjects(){
  $('#project-count').textContent=state.projects.length;const sums=state.projects.map(calculate);const active=state.projects.filter(p=>p.status!=='Solgt').length;
  $('#project-summary').innerHTML=stat('Prosjekter i arbeid',String(active),'prosjekter','Alle som ikke er markert solgt','folder')+stat('Samlet kalkulert investering',num(sums.reduce((s,c)=>s+c.total,0)/1e6,2),'mill. kr','Inkludert kostnader og finansiering','coins')+stat('Samlet estimert fortjeneste',num(sums.reduce((s,c)=>s+c.profit,0)/1e6,2),'mill. kr','Før skatt · alle prosjektkalkyler','trend');
  $('#project-empty').hidden=state.projects.length>0;
  $('#project-cards').innerHTML=state.projects.map(p=>{const c=calculate(p),done=p.tasks.filter(t=>t.done).length;return `<article class="project-card"><div class="project-card-top"><span>${icon('building')}</span><span class="pill ${p.status==='Solgt'?'green':'warm'}">${escape(p.status)}</span></div><div class="project-card-content"><h2>${escape(p.name)}</h2><p>${escape(p.address)} · ${num(p.area)} m²</p><div class="project-card-value"><small>Estimert fortjeneste før skatt</small><strong class="${c.profit<0?'negative':'positive'}">${kr(c.profit)}</strong></div><div class="insight-row"><span>Avkastning på egenkapital</span><strong>${pct(c.equityRoi)}</strong></div><div class="insight-row"><span>Oppussing, faktisk / ramme</span><strong>${num(c.actual/1000)} / ${num(c.renovationBudget/1000)} t.kr</strong></div><div class="insight-row"><span>Oppgaver fullført</span><strong>${done} av ${p.tasks.length}</strong></div><button class="button light" style="margin-top:18px" data-project="${escape(p.id)}">Åpne prosjekt ${icon('arrow')}</button></div></article>`;}).join('');
}
function renderAnalysis(){
  const grouped=[...new Set(filtered.map(s=>s.district))].map(name=>{const rows=filtered.filter(s=>s.district===name);return{name,rows,price:median(rows.map(s=>s.price/s.area))};}).sort((a,b)=>b.price-a.price);
  const max=Math.max(1,...grouped.map(g=>g.price));const months=monthlyGroups(filtered);const countMax=Math.max(1,...months.map(g=>g.sales.length));
  const demo=filtered.filter(s=>s.demo).length;
  $('#analysis-content').innerHTML=`<div class="stats-grid three">${stat('Salg i aktivt utvalg',String(filtered.length),'salg',`${demo} fiktive · ${filtered.length-demo} importerte`,'building')}${stat('Median pris per m²',num(median(filtered.map(s=>s.price/s.area))),'kr / m²','Median av hvert salgs pris / BRA-i','chart')}${stat('Områder i utvalget',String(grouped.length),'områder','Områdenavn kommer fra salgsdataene','map')}</div><div class="analysis-grid"><article class="panel"><h2>Prisnivå per område</h2><p class="small-copy">Median pris per m² · gjeldende filtre</p><div class="chart-bars">${grouped.length?grouped.map(g=>`<div><div class="chart-bar-top"><span>${escape(g.name)}</span><strong>${num(g.price)} kr / m²</strong></div><div class="chart-track"><div class="chart-fill" style="width:${g.price/max*100}%"></div></div><div class="chart-count">${g.rows.length} salg ${g.rows.length<5?'· Lite utvalg':''}</div></div>`).join(''):'<div class="empty-state">Ingen data i utvalget.</div>'}</div></article><article class="panel"><h2>Hvor mange blir solgt?</h2><p class="small-copy">Månedlig antall salg i ditt datasett</p><div class="month-chart">${months.map(g=>`<div class="month-column"><strong>${g.sales.length}</strong><div style="height:${g.sales.length/countMax*135}px" title="${escape(g.key)}: ${g.sales.length} salg"></div><span>${escape(g.label)}</span></div>`).join('')||'<div class="empty-state">Ingen data i utvalget.</div>'}</div><p class="analysis-footnote">Seks måneder frem til nyeste salg i utvalget. Antall gjelder kun tilgjengelige salgsrader, og viser ikke hele markedets omsetning.</p><div class="notice" style="margin-top:24px;margin-bottom:0">Sammenlign boliger med lignende størrelse, eierform og standard før du setter forventet salgspris. Datasettet i denne versjonen har ikke tilstand eller eierform per salg.</div></article></div><article class="panel"><h2>Hvor følsomme er prosjektene dine?</h2><p class="small-copy">Fortjeneste før skatt ved 5 % lavere, forventet og 5 % høyere salgspris. Øvrige kostnader holdes uendret.</p>${state.projects.length?`<div class="table-wrap sensitivity"><table><thead><tr><th>Prosjekt</th><th>−5 % salgspris</th><th>Forventet</th><th>+5 % salgspris</th></tr></thead><tbody>${state.projects.map(p=>{const c=calculate(p);return `<tr><td>${escape(p.name)}</td>${[-.05,0,.05].map(f=>`<td class="${c.profit+p.resale*f<0?'negative':'positive'}">${kr(c.profit+p.resale*f)}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div>`:'<p>Opprett et prosjekt for å sammenligne scenarioer.</p>'}</article>`;
}
function renderData(){const n=state.sales.filter(s=>s.demo).length;$('#dataset-summary').textContent=`${state.sales.length} salg totalt · ${n} eksempeldata · ${state.sales.length-n} importerte salg · ${state.projects.length} prosjekter.`;$('#remove-demo').disabled=!n;$('#restore-demo').disabled=demoSales.length>0&&demoSales.every(s=>state.sales.some(x=>x.id===s.id));}
function renderAll(){listingUI?.render();refreshAreaOptions();renderMarket();renderProjects();renderData();if(currentPage==='analyse')renderAnalysis();}
function route(){const names={annonser:'Boliger fra FINN',marked:'Markedskart',prosjekter:'Mine prosjekter',analyse:'Markedsanalyse',datakilder:'Data og import'};currentPage=location.hash.slice(1);if(!names[currentPage])currentPage='annonser';$$('.page').forEach(el=>el.hidden=el.id!==`page-${currentPage}`);$$('nav a').forEach(el=>{el.classList.toggle('active',el.dataset.page===currentPage);if(el.dataset.page===currentPage)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});$('#breadcrumb-title').textContent=names[currentPage];if(currentPage==='annonser')listingUI?.activate();if(currentPage==='analyse')renderAnalysis();if(currentPage==='marked'&&map)setTimeout(()=>map.invalidateSize(),50);}

function formProject(){const values=Object.fromEntries(new FormData($('#project-form')));for(const field of NUMERIC_FIELDS)values[field]=Number(values[field]);return {...values,id:$('#project-id').value||crypto.randomUUID(),expenses:editingExpenses,tasks:editingTasks};}
function openProject(id,prefill={}){
  const p=id?state.projects.find(p=>p.id===id):null;if(id&&!p)return;
  const form=$('#project-form');form.reset();$('#project-id').value=p?.id||'';
  const defaults={...prefill};const values=p||defaults;
  for(const [key,value] of Object.entries(values)){if(form.elements.namedItem(key)&&!['expenses','tasks'].includes(key))form.elements.namedItem(key).value=value;}
  editingExpenses=structuredClone(p?.expenses||[]);editingTasks=structuredClone(p?.tasks||[]);
  $('#project-dialog-title').textContent=p?p.name:'En ny mulighet.';$('#project-tracking').hidden=false;$('#delete-project').hidden=!p;
  $('#expense-description').value='';$('#expense-amount').value='';$('#task-description').value='';
  renderTracking();renderLiveCalculation();$('#project-dialog').showModal();
}
function renderLiveCalculation(){const p=formProject();if(NUMERIC_FIELDS.some(f=>!Number.isFinite(p[f])))return;const c=calculate(p);$('#live-calculation').innerHTML=`<div><small>Samlet investering</small><strong>${kr(c.total)}</strong></div><div><small>Fortjeneste før skatt</small><strong class="${c.profit<0?'negative':'positive'}">${kr(c.profit)}</strong></div><div><small>Avkastning på egenkapital</small><strong class="${c.profit<0?'negative':'positive'}">${pct(c.equityRoi)}</strong></div><p>Dokumentavgift ${kr(c.stamp)} · oppussing inkl. buffer / overskridelser ${kr(c.renovation)} · løpende utgifter ${kr(c.holding)} · renter ${kr(c.financing)}.<br>Lånebehov før renter ${kr(c.loan)} · avkastning på samlet investering ${pct(c.roi)} · kjøpesum inkl. fellesgjeld ${kr(c.exposure)}.<br>Renter er forenklet beregnet med fullt lånebehov fra start, inkludert salgsomkostninger og løpende utgifter. Egenkapital utover kapitalbehov reduserer ikke kostnadene ytterligere.</p>`;}
function renderTracking(){
  $('#expenses-list').innerHTML=editingExpenses.map((e,i)=>`<div class="expense-row"><span>${escape(e.description)}</span><strong>${kr(e.amount)}</strong><button type="button" class="icon-button" data-remove-expense="${i}" aria-label="Fjern ${escape(e.description)}">${icon('close')}</button></div>`).join('')+`<div class="expense-total"><span>Registrerte kostnader</span><strong>${kr(editingExpenses.reduce((s,e)=>s+e.amount,0))}</strong></div>`;
  $('#tasks-list').innerHTML=editingTasks.map((t,i)=>`<div class="task-row"><label><input type="checkbox" data-task="${i}" ${t.done?'checked':''}>${escape(t.description)}</label><button type="button" class="icon-button" data-remove-task="${i}" aria-label="Fjern oppgave">${icon('close')}</button></div>`).join('');
}

async function readSmallFile(file){if(file.size>5*1024*1024)throw new Error('Filen er større enn 5 MB.');return file.text();}
async function importSales(file){
  const result=$('#import-result');try{const content=await readSmallFile(file);const json=file.name.toLowerCase().endsWith('.json');const raw=json?JSON.parse(content):parseCSV(content);if(!Array.isArray(raw))throw new Error('JSON-filen må inneholde en liste med salg.');
    // Bevar merking når eksempeldata eksporteres og importeres på nytt.
    const rows=validateSales(raw,true);for(let i=0;i<rows.length;i++){if(raw[i].demo===true||String(raw[i].demo).toLowerCase()==='true'||rows[i].id.startsWith('demo-')||/fiktiv|eksempeldata/i.test(rows[i].source))rows[i].demo=true;}
    const byId=new Map(state.sales.map(s=>[s.id,s]));let replaced=0;for(const row of rows){if(byId.has(row.id))replaced++;byId.set(row.id,row);}if(byId.size>5000)throw new Error('Maks 5 000 salg totalt. Fjern eksempeldata eller bruk et mindre utvalg.');
    if(!await commit({...state,sales:[...byId.values()]}))return false;renderAll();result.classList.remove('error');result.textContent=`Import fullført: ${rows.length-replaced} nye salg, ${replaced} erstattet. Velg «Hele datasettet» på kartet hvis eldre salg ikke vises.`;toast('Salgsdata er lagret på nett.');return true;
  }catch(e){result.classList.add('error');result.textContent=`Import avbrutt: ${e.message} Ingen data er endret.`;toast('Importen kunne ikke fullføres.',true);return false;}}

let searchTimer,searchController,searchVersion=0;
$('#address-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchController?.abort();const version=++searchVersion;const q=$('#address-search').value.trim(),results=$('#address-results');if(q.length<3){results.hidden=true;return;}results.hidden=false;results.textContent='Søker i Kartverkets adressedata …';searchTimer=setTimeout(async()=>{
  searchController=new AbortController();const timeout=setTimeout(()=>searchController.abort(),10000);
  try{const url=new URL('/api/addresses',location.origin);url.searchParams.set('q',q);const r=await fetch(url,{signal:searchController.signal});if(!r.ok)throw new Error();const data=await r.json();if(version!==searchVersion)return;const rows=(data.adresser||[]).filter(a=>a.kommunenummer==='5001');results.innerHTML=rows.length?rows.map((a,i)=>`<button type="button" data-address-index="${i}">${escape(a.adressetekst)}<br><small>${escape(a.postnummer)} ${escape(a.poststed)}</small></button>`).join(''):'Ingen adresser funnet i Trondheim. Prøv gate og husnummer.';
    results.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{const a=rows[i],pos=a.representasjonspunkt;results.hidden=true;$('#address-search').value=a.adressetekst;if(map){if(addressMarker)map.removeLayer(addressMarker);addressMarker=L.circleMarker([pos.lat,pos.lon],{radius:9,color:'#b78a55',fillColor:'#fff',fillOpacity:1,weight:3}).addTo(map);map.setView([pos.lat,pos.lon],17);}selectedId=null;$('#insight-panel').innerHTML=`<div class="insight-label">ADRESSE FRA KARTVERKET ${icon('check')}</div><div class="area-heading"><span class="area-icon">${icon('pin')}</span><div><h2 style="font-size:17px">${escape(a.adressetekst)}</h2><small>${escape(a.postnummer)} ${escape(a.poststed)}</small></div></div><div class="insight-rows"><div class="insight-row"><span>Kommune</span><strong>Trondheim · 5001</strong></div><div class="insight-row"><span>Breddegrad</span><strong>${num(pos.lat,5)}</strong></div><div class="insight-row"><span>Lengdegrad</span><strong>${num(pos.lon,5)}</strong></div></div><p class="insight-note">Dette er offisielle adressedata. Salgspris, areal og tilstand følger ikke med adresseoppslaget.</p><button class="button primary" id="project-from-address">${icon('plus')} Vurder som prosjekt</button>`;$('#project-from-address').onclick=()=>openProject(null,{address:a.adressetekst,name:a.adressetekst,lat:pos.lat,lng:pos.lon,notes:'Adresse og koordinater fra Kartverkets Adresse REST-API. Alle økonomiske felt er foreløpige standardverdier og må vurderes.'});});
  }catch(e){if(version===searchVersion){results.textContent='Adressesøket er utilgjengelig akkurat nå. Kontroller nettilgangen og prøv igjen.';}}
  finally{clearTimeout(timeout);}
},350);});
document.addEventListener('click',e=>{if(!e.target.closest('.map-search'))$('#address-results').hidden=true;});
$('#address-search').addEventListener('keydown',e=>{if(e.key==='Escape')$('#address-results').hidden=true;if(e.key==='ArrowDown'){$('#address-results button')?.focus();e.preventDefault();}});

$$('[data-action="new-project"]').forEach(b=>b.onclick=()=>openProject());
$$('.close-dialog').forEach(b=>b.onclick=()=>$('#project-dialog').close());
$('#project-form').addEventListener('input',renderLiveCalculation);
$('#project-form').addEventListener('submit',async e=>{e.preventDefault();try{const p=validateProject(formProject());const existing=state.projects.some(x=>x.id===p.id);const projects=existing?state.projects.map(x=>x.id===p.id?p:x):[...state.projects,p];if(!await commit({...state,projects}))return;$('#project-dialog').close();renderAll();location.hash='prosjekter';toast('Prosjektet er lagret.');}catch(err){toast(err.message,true);}});
$('#delete-project').onclick=async()=>{const id=$('#project-id').value;if(!await confirmAction('Slette prosjektet?','Prosjektet, kostnader og oppgaver slettes fra arbeidsområdet på nett. Last ned en sikkerhetskopi først hvis du vil beholde dem.'))return;if(await commit({...state,projects:state.projects.filter(p=>p.id!==id)})){$('#project-dialog').close();renderAll();toast('Prosjektet er slettet.');}};
$('#add-expense').onclick=()=>{const description=$('#expense-description').value.trim(),amount=Number($('#expense-amount').value);if(!description||!Number.isFinite(amount)||amount<=0||amount>1e9){toast('Skriv en beskrivelse og et gyldig kostnadsbeløp.',true);return;}if(editingExpenses.length>=1000){toast('Maks 1 000 kostnader per prosjekt.',true);return;}editingExpenses.push({id:crypto.randomUUID(),description,amount});$('#expense-description').value='';$('#expense-amount').value='';renderTracking();renderLiveCalculation();};
$('#add-task').onclick=()=>{const description=$('#task-description').value.trim();if(!description){$('#task-description').focus();return;}if(editingTasks.length>=1000){toast('Maks 1 000 oppgaver per prosjekt.',true);return;}editingTasks.push({id:crypto.randomUUID(),description,done:false});$('#task-description').value='';renderTracking();};
$('#project-tracking').addEventListener('click',e=>{const exp=e.target.closest('[data-remove-expense]'),task=e.target.closest('[data-remove-task]');if(exp){editingExpenses.splice(Number(exp.dataset.removeExpense),1);renderTracking();renderLiveCalculation();}if(task){editingTasks.splice(Number(task.dataset.removeTask),1);renderTracking();}});
$('#project-tracking').addEventListener('change',e=>{if(e.target.matches('[data-task]'))editingTasks[Number(e.target.dataset.task)].done=e.target.checked;});
$('#project-cards').addEventListener('click',e=>{const b=e.target.closest('[data-project]');if(b)openProject(b.dataset.project);});
$('#sales-table').addEventListener('click',e=>{const b=e.target.closest('[data-sale]');if(b)selectSale(b.dataset.sale);});
$('#map-view').onclick=()=>setMapView(true);$('#list-view').onclick=()=>setMapView(false);
$('#filters-button').onclick=()=>{const panel=$('#extra-filters');panel.hidden=!panel.hidden;$('#filters-button').setAttribute('aria-expanded',!panel.hidden);};
['#area-filter','#period-filter','#origin-filter'].forEach(s=>$(s).addEventListener('change',()=>{selectedId=null;renderMarket();if(map&&s==='#area-filter'&&filtered.length){const coords=filtered.map(s=>[s.lat,s.lng]);map.fitBounds(L.latLngBounds(coords),{padding:[40,40],maxZoom:15});}}));
['#min-area','#max-area','#max-price'].forEach(s=>$(s).addEventListener('input',renderMarket));
$('#reset-filters').onclick=()=>{['#min-area','#max-area','#max-price'].forEach(s=>$(s).value='');$('#origin-filter').value='all';$('#area-filter').value='';$('#period-filter').value='90';renderMarket();};
$('#export-sales').onclick=()=>{if(!filtered.length){toast('Det er ingen salg å eksportere.',true);return;}download('kvadrat-salgsutvalg.csv',csvExport(filtered),'text/csv;charset=utf-8');};
$('#sales-file').onchange=async e=>{const file=e.target.files[0];if(file)await importSales(file);e.target.value='';};
$('#download-template').onclick=()=>download('kvadrat-importmal.csv',csvExport([{id:'demo-mal-001',address:'Fiktiv eksempeladresse',district:'Midtbyen',date:'2026-11-01',area:65,price:3900000,lat:63.4305,lng:10.3951,source:'Fiktive eksempeldata',demo:true}]),'text/csv;charset=utf-8');
$('#remove-demo').onclick=async()=>{if(!await confirmAction('Fjerne eksempeldata?','Alle salg merket som eksempeldata fjernes. Dine importerte salg og prosjekter beholdes.'))return;if(await commit({...state,sales:state.sales.filter(s=>!s.demo)})){renderAll();toast('Eksempeldata er fjernet.');}};
$('#restore-demo').onclick=async()=>{const ids=new Set(state.sales.map(s=>s.id));const sales=[...state.sales,...demoSales.filter(s=>!ids.has(s.id))];if(sales.length>5000){toast('Det er ikke plass til eksempeldata. Maks 5 000 salg totalt.',true);return;}if(await commit({...state,sales})){renderAll();toast('Eksempeldata er gjenopprettet.');}};
$('#backup-button').onclick=backup;$('#backup-button-2').onclick=backup;
$('#backup-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=validateBackup(JSON.parse(await readSmallFile(file)));if(await confirmAction('Erstatte arbeidsområdet?','Salgsdata og prosjekter i arbeidsområdet på nett erstattes med sikkerhetskopien. Last ned en kopi av nåværende data først hvis du vil beholde dem.')){if(await commit(data)){renderAll();toast('Sikkerhetskopien er gjenopprettet.');}}}catch(err){toast(`Kunne ikke gjenopprette: ${err.message}`,true);}finally{e.target.value='';}};
window.addEventListener('hashchange',route);
$('#new-sale').onclick=()=>{const form=$('#sale-form');form.reset();$('#sale-address-results').textContent='';$('#sale-dialog').showModal();};
$('#close-sale').onclick=$('#cancel-sale').onclick=()=>$('#sale-dialog').close();
$('#sale-form').addEventListener('submit',async e=>{
  e.preventDefault();
  try{if(state.sales.length>=5000)throw new Error('Maks 5 000 salg totalt.');const form=$('#sale-form'),values=Object.fromEntries(new FormData(form));const sale=validateSale({...values,id:crypto.randomUUID(),demo:form.elements.demo.checked},true);if(await commit({...state,sales:[...state.sales,sale]})){$('#sale-dialog').close();renderAll();toast('Salget er lagret på nett.');}}
  catch(error){toast(error.message,true);}
});
$('#sale-lookup').onclick=async()=>{
  const form=$('#sale-form'),q=form.elements.address.value.trim(),results=$('#sale-address-results');
  if(q.length<3){toast('Skriv gate og husnummer først.',true);return;}
  results.textContent='Søker i Kartverkets adressedata …';
  try{const response=await fetch('/api/addresses?'+new URLSearchParams({q}));const data=await response.json();if(!response.ok)throw new Error(data.error);const rows=data.adresser||[];results.innerHTML=rows.length?rows.map((a,i)=>`<button type="button" class="button light" data-result="${i}">${escape(a.adressetekst)} · ${escape(a.poststed)}</button>`).join(''):'Ingen treff i Trondheim. Prøv et mer presist søk.';results.querySelectorAll('button').forEach((button,i)=>button.onclick=()=>{const a=rows[i];form.elements.address.value=a.adressetekst;form.elements.lat.value=a.representasjonspunkt.lat;form.elements.lng.value=a.representasjonspunkt.lon;results.textContent='Adresse og koordinater hentet fra Kartverket.';});}
  catch(error){results.textContent=error.message||'Kunne ikke hente adressen. Prøv igjen.';}
};
$('#paste-sales').onclick=()=>{$('#pasted-sales').value='';$('#paste-dialog').showModal();};
$('#close-paste').onclick=()=>$('#paste-dialog').close();
$('#paste-form').addEventListener('submit',async e=>{e.preventDefault();const text=$('#pasted-sales').value.trim();const file={name:text.startsWith('[')?'innlimt.json':'innlimt.csv',size:new TextEncoder().encode(text).byteLength,text:async()=>text};if(await importSales(file))$('#paste-dialog').close();});
$('#reload-workspace').onclick=async()=>{
  if(saving)return;
  if(($('#project-dialog').open||$('#sale-dialog').open||$('#listing-dialog').open||$('#listing-import-dialog').open)&&!await confirmAction('Hente siste versjon?','Ulagrede endringer i skjemaet forkastes. Arbeidsområdet lastes inn fra nettet.'))return;
  $('#project-dialog').close();$('#sale-dialog').close();$('#listing-dialog').close();$('#listing-import-dialog').close();await loadWorkspace();
};
$('#retry-cloud').onclick=()=>loadWorkspace();
window.addEventListener('focus',()=>{if(ready&&!saving&&!needsReload&&!$('#project-dialog').open&&!$('#sale-dialog').open&&!$('#listing-dialog').open&&!$('#listing-import-dialog').open)loadWorkspace(true);});

function showLogin(){
  ready=false;revision=null;needsReload=false;$('main').inert=true;document.body.classList.add('signed-out');$('#login-screen').hidden=false;
  $$('dialog[open]').forEach(d=>d.close());state={schemaVersion:SCHEMA_VERSION,sales:[],projects:[],listings:[]};editingExpenses=[];editingTasks=[];
  $$('dialog form').forEach(form=>form.reset());
  $('#login-form').elements.password.value='';renderAll();
}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();$('#login-submit').disabled=true;$('#login-error').hidden=true;try{await postAuth('login',Object.fromEntries(new FormData(e.target)));e.target.elements.password.value='';await loadWorkspace();}catch(error){$('#login-error').textContent=error.message;$('#login-error').hidden=false;}finally{$('#login-submit').disabled=false;}});
$('#logout-button').onclick=async()=>{
  if(saving)return;
  if($$('dialog[open]').length&&!await confirmAction('Logge ut?','Ulagrede endringer i skjemaet forkastes når du logger ut.'))return;
  try{await postAuth('logout');showLogin();$('#login-error').hidden=true;}catch(error){toast(error.message,true);}
};
$('#change-password').onclick=()=>{$('#password-form').reset();$('#password-error').hidden=true;$('#password-dialog').showModal();};
$('#close-password').onclick=()=>{$('#password-dialog').close();$('#password-form').reset();};
$('#password-form').addEventListener('submit',async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));$('#password-error').hidden=true;
  if(values.newPassword!==values.confirmPassword){$('#password-error').textContent='De nye passordene er ikke like.';$('#password-error').hidden=false;return;}
  $('#password-submit').disabled=true;try{await postAuth('password',values);$('#password-dialog').close();e.target.reset();toast('Passordet er endret. Andre økter er logget ut.');}catch(error){$('#password-error').textContent=error.message;$('#password-error').hidden=false;}finally{$('#password-submit').disabled=false;}
});

async function init(){
  $('main').inert=true;
  try{const r=await fetch('/data/demo-sales.json');if(r.ok)demoSales=validateSales(await r.json(),true);}catch{}
  initMap();route();setMapView(true);await loadWorkspace();
}
listingUI=createListingOverview({getState:()=>state,commit,openProject,toast,escape,kr,num,stat});
init();
