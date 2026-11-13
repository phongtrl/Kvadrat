import {apiFetch} from './api-client.js';
import {validateListing} from './core.js';

export function createListingOverview({getState,commit,openProject,toast,escape,kr,num,stat}){
 const $=s=>document.querySelector(s);
 let supplied=[],listingMap,layers,editing=null,loaded=false;
 const statuses={annonsert:'Annonsert · ubekreftet',ukjent:'Ukjent',solgt:'Merket solgt',trukket:'Trukket'};
 const all=()=>{const rows=new Map(supplied.map(l=>[l.id,l]));for(const row of getState().listings||[])rows.set(row.id,row);return [...rows.values()];};
 const total=l=>l.price+l.debt+l.fees;
 async function save(rows){const merged=new Map((getState().listings||[]).map(l=>[l.id,l]));for(const row of rows)merged.set(row.id,validateListing(row));if(merged.size>5000)throw new Error('Maks 5 000 lagrede annonser.');return commit({...getState(),listings:[...merged.values()]});}
 function render(){
  if(!loaded)return;
  const query=$('#listing-search').value.trim().toLocaleLowerCase('nb'),status=$('#listing-status').value,kind=$('#listing-kind').value;
  const rows=all().filter(l=>(!query||`${l.address} ${l.district} ${l.title}`.toLocaleLowerCase('nb').includes(query))&&(!status||l.status===status)&&(!kind||(kind==='favorites'?l.favorite:l.renovation)));
  const order=$('#listing-sort').value;rows.sort((a,b)=>order==='total'?total(a)-total(b):order==='sqm'?(a.price+a.debt)/a.area-(b.price+b.debt)/b.area:order==='area'?b.area-a.area:(b.checkedAt||'').localeCompare(a.checkedAt||'')||a.address.localeCompare(b.address,'nb'));
  $('#listing-stats').innerHTML=stat('Kandidater i utvalget',num(rows.length),'annonser','Registrerte annonser, ikke hele markedet','building')+stat('Oppussingsbehov oppgitt',num(rows.filter(l=>l.renovation).length),'annonser','Basert på annonsetekst / registrering','spark')+stat('Mine favoritter',num(rows.filter(l=>l.favorite).length),'kandidater','Lagres privat på kontoen din','folder')+stat('Prisavgrensning','Ingen','maksgrense','Alle prisklasser er inkludert','coins');
  $('#listing-table').innerHTML=rows.map(l=>`<tr><td><strong>${escape(l.address)}</strong><br><small>${escape(l.district)} · ${escape(l.title)}</small>${l.renovation?'<br><span class="pill green">Oppussingsbehov</span>':''}</td><td>${num(l.area)} m²</td><td>${kr(l.price)}</td><td>${kr(l.debt)}</td><td class="money">${kr(total(l))}<br><small>${num((l.price+l.debt)/l.area)} kr/m² ekskl. omk.</small></td><td>${kr(l.monthly)}</td><td><span class="pill ${l.status==='solgt'?'warm':''}">${statuses[l.status]}</span><br><small>${l.checkedAt?escape(l.checkedAt):'Ikke kontrollert'}</small></td><td><div class="listing-actions"><button class="text-button" data-favorite="${l.id}" aria-label="${l.favorite?'Fjern favoritt':'Lagre favoritt'} ${escape(l.address)}">${l.favorite?'★ Favoritt':'☆ Favoritt'}</button><a class="text-link" href="${escape(l.url)}" target="_blank" rel="noopener">FINN ↗</a><button class="text-button" data-edit-listing="${l.id}">Rediger</button><button class="text-button" data-locate-listing="${l.id}">Vis på kart</button><button class="button light" data-listing-project="${l.id}" ${['solgt','trukket'].includes(l.status)?'disabled':''}>Vurder prosjekt</button></div></td></tr>`).join('');
  $('#listing-empty').hidden=rows.length>0;
  if(listingMap){layers.clearLayers();for(const l of rows.filter(l=>l.lat!==null&&l.lng!==null)){
    const marker=L.circleMarker([l.lat,l.lng],{radius:8,color:l.status==='solgt'?'#b28b63':'#284f3f',fillOpacity:.8}).addTo(layers);
    const popup=document.createElement('div');const strong=document.createElement('strong');strong.textContent=l.address;popup.append(strong,document.createElement('br'),document.createTextNode(`${kr(total(l))} · ${statuses[l.status]}`),document.createElement('br'));const link=document.createElement('a');link.href=l.url;link.textContent='Åpne FINN ↗';link.target='_blank';link.rel='noopener';popup.append(link);marker.bindPopup(popup);
  }}
  const placed=rows.filter(l=>l.lat!==null&&l.lng!==null).length;$('#listing-map-count').textContent=`${placed} av ${rows.length} kandidater har kartposisjon`;
 }
 function activate(){
  const element=$('#listing-map');
  if(!element.clientWidth||!element.clientHeight)return;
  if(!window.L){$('#listing-map-error').textContent='Kartbiblioteket kunne ikke lastes. Prøv å laste kartet på nytt.';$('#listing-map-error').hidden=false;$('#retry-listing-map').hidden=false;return;}
  if(!listingMap&&window.L){listingMap=L.map('listing-map',{scrollWheelZoom:false}).setView([63.40,10.40],11);const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'origin',attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(listingMap);layers=L.layerGroup().addTo(listingMap);
   let failures=0;tiles.on('tileerror',()=>{if(++failures>=3){$('#listing-map-error').textContent='Bakgrunnskartet kunne ikke lastes. Kandidatlisten er fortsatt tilgjengelig.';$('#listing-map-error').hidden=false;$('#retry-listing-map').hidden=false;}});tiles.on('tileload',()=>{failures=0;$('#listing-map-error').hidden=true;$('#retry-listing-map').hidden=true;});
   $('#retry-listing-map').onclick=()=>{activate();tiles.redraw();};
   if(window.ResizeObserver)new ResizeObserver(()=>{if(element.clientWidth&&element.clientHeight)listingMap.invalidateSize({animate:false});}).observe(element);
   render();}
  if(listingMap)setTimeout(()=>listingMap.invalidateSize(),50);
 }
 function edit(l=null){editing=l;const form=$('#listing-form');form.reset();if(l)for(const [key,value]of Object.entries(l)){const field=form.elements.namedItem(key);if(field){if(field.type==='checkbox')field.checked=!!value;else field.value=value??'';}}$('#listing-dialog').showModal();}
 async function locate(l){
  if(l.lat!==null&&l.lng!==null)return l;
  const response=await apiFetch('/api/addresses?'+new URLSearchParams({q:l.address}),{signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Adressesøket feilet.');
  const normalize=s=>s.normalize('NFC').replace(/\s/g,'').toLocaleLowerCase('nb');const exact=(data.adresser||[]).filter(a=>normalize(a.adressetekst)===normalize(l.address));
  if(exact.length!==1)throw new Error('Fant ikke én entydig adresse i Trondheim. Kontroller adressen under Rediger.');
  const p=exact[0].representasjonspunkt;const row={...l,lat:p.lat,lng:p.lon};return await save([row])?row:null;
 }
 $('#retry-listing-map').onclick=()=>{if(!window.L)location.reload();else activate();};
 window.addEventListener('load',()=>{if(location.hash==='#annonser'||!location.hash)activate();});
 $('#add-listing').onclick=()=>edit();$('#close-listing').onclick=()=>$('#listing-dialog').close();
 $('#listing-form').addEventListener('submit',async e=>{e.preventDefault();try{const form=$('#listing-form'),values=Object.fromEntries(new FormData(form));const same=editing?.address===values.address;const row=validateListing({...values,checkedAt:values.checkedAt||null,renovation:form.elements.renovation.checked,favorite:editing?.favorite||false,lat:same?editing.lat:null,lng:same?editing.lng:null});if(await save([row])){$('#listing-dialog').close();render();toast('Annonsen er lagret på nett.');}}catch(error){toast(error.message,true);}});
 $('#listing-table').addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  const id=button.dataset.favorite||button.dataset.editListing||button.dataset.locateListing||button.dataset.listingProject,l=all().find(l=>l.id===id);if(!l)return;
  try{
   if(button.dataset.favorite){if(await save([{...l,favorite:!l.favorite}]))render();}
   else if(button.dataset.editListing)edit(l);
   else {button.disabled=true;const placed=await locate(l);if(!placed)return;render();if(button.dataset.locateListing){activate();listingMap?.setView([placed.lat,placed.lng],16);$('#listing-map').scrollIntoView({behavior:'smooth',block:'center'});}
   else openProject(null,{name:l.address,address:l.address,area:l.area,lat:placed.lat,lng:placed.lng,purchase:l.price,debt:l.debt,resale:l.price,ownership:l.ownership,monthly:l.monthly,stampBase:l.ownership==='selveier'?l.price:0,buyFees:l.ownership==='selveier'?Math.max(0,l.fees-l.price*.025):l.fees,renovation:0,notes:`FINN-kandidat: ${l.url}\n${l.notes}\nPrisantydning er ikke oppnådd pris. Forventet salg er satt lik prisantydning; oppussingsbudsjett er 0. Vurder og erstatt alle økonomiske forutsetninger. Kontroller omkostninger og fellesgjeld før bruk.`});}
  }catch(error){toast(error.message,true);}finally{button.disabled=false;}
 });
 ['listing-search','listing-status','listing-kind','listing-sort'].forEach(id=>$('#'+id).addEventListener(id==='listing-search'?'input':'change',render));
 $('#paste-listings').onclick=()=>{$('#listing-import-text').value='';$('#listing-import-dialog').showModal();};$('#close-listing-import').onclick=()=>$('#listing-import-dialog').close();
 $('#listing-import-form').addEventListener('submit',async e=>{e.preventDefault();try{const rows=JSON.parse($('#listing-import-text').value);if(!Array.isArray(rows)||!rows.length||rows.length>5000)throw new Error('Lim inn en JSON-liste med 1–5 000 annonser.');const listings=rows.map(validateListing);if(new Set(listings.map(l=>l.id)).size!==listings.length)throw new Error('Samme FINN-kode forekommer flere ganger i innlimingen.');if(await save(listings)){$('#listing-import-dialog').close();render();toast('Annonsene er lagret på nett.');}}catch(error){toast(error.message,true);}});
 fetch(new URL('./data/listings.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{supplied=data.listings.map(validateListing);$('#listing-coverage').textContent=`Datadekning: ${data.coverage} Grunnutvalget ble kontrollert ${data.checkedAt}. Dine egne registreringer vises i tillegg.`;}).catch(()=>{$('#listing-coverage').textContent='Grunnutvalget kunne ikke lastes. Dine lagrede annonser vises fortsatt. Dette er ikke en fullstendig FINN-oversikt.';}).finally(()=>{loaded=true;render();if(location.hash==='#annonser'||!location.hash)activate();});
 return {render,activate};
}
