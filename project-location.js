import {apiFetch} from './api-client.js';
export const validProjectPoint=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=62&&lat<=66&&lng>=8&&lng<=15;
export function createProjectLocation({fetcher=apiFetch}={}){
 const $=s=>document.querySelector(s),form=$('#project-form'),field=name=>form.elements.namedItem(name);
 let map,marker,sequence=0;
 const status=message=>$('#project-location-status').textContent=message;
 function point(){return {lat:field('lat').value.trim()?Number(field('lat').value):NaN,lng:field('lng').value.trim()?Number(field('lng').value):NaN};}
 function place(lat,lng,move=false){
  if(!validProjectPoint(lat,lng)){status('Velg en plassering i Trøndelag-området.');return false;}
  field('lat').value=lat.toFixed(6);field('lng').value=lng.toFixed(6);
  if(map){if(!marker){marker=L.marker([lat,lng],{draggable:true,title:'Prosjektets plassering · dra for å flytte'}).addTo(map);marker.on('dragend',()=>{const p=marker.getLatLng();if(!place(p.lat,p.lng))marker.setLatLng([Number(field('lat').value),Number(field('lng').value)]);});}else marker.setLatLng([lat,lng]);if(move)map.setView([lat,lng],16);}
  status('Plassering valgt. Trykk «Lagre prosjekt» for å lagre endringen på nett.');return true;
 }
 function activate(){
  sequence++;$('#project-location-search-button').disabled=false;$('#project-location-results').replaceChildren();$('#project-location-search').value=field('address').value;status('Søk etter adresse, klikk i kartet eller dra markøren. Endringer lagres sammen med prosjektet.');
  const element=$('#project-location-map');if(!window.L){status('Kartet kunne ikke lastes. Bruk adressesøk eller fyll inn koordinatene nedenfor.');return;}
  if(!map){map=L.map('project-location-map',{scrollWheelZoom:false}).setView([63.43,10.4],12);const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'origin',attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);tiles.on('tileerror',()=>status('Bakgrunnskartet er utilgjengelig. Adressesøk og koordinatfeltene kan fortsatt brukes.'));map.on('click',e=>place(e.latlng.lat,e.latlng.lng));if(window.ResizeObserver)new ResizeObserver(()=>{if(element.clientWidth&&element.clientHeight)map.invalidateSize({animate:false});}).observe(element);}
  const p=point();if(validProjectPoint(p.lat,p.lng)){place(p.lat,p.lng,true);status('Kontroller plasseringen. Søk etter adresse, klikk i kartet eller dra markøren for å flytte prosjektet.');}
  map.invalidateSize({animate:false});
 }
 $('#project-location-search-button').onclick=async()=>{
  const q=$('#project-location-search').value.trim(),results=$('#project-location-results'),button=$('#project-location-search-button'),started=++sequence;
  if(q.length<3){status('Skriv minst tre tegn, gjerne gateadresse og sted.');return;}
  results.replaceChildren();button.disabled=true;status('Søker i Kartverkets adresser …');
  try{const response=await fetcher('/api/addresses?scope=trondelag&q='+encodeURIComponent(q),{signal:AbortSignal.timeout(12000)});const data=await response.json();if(started!==sequence||!$('#project-dialog').open)return;if(!response.ok)throw new Error(data.error||'Adressesøket feilet.');
   const addresses=(data.adresser||[]).filter(a=>a.representasjonspunkt&&validProjectPoint(a.representasjonspunkt.lat,a.representasjonspunkt.lon));
   for(const a of addresses){const choice=document.createElement('button');choice.type='button';choice.className='location-result';choice.textContent=`${a.adressetekst}, ${a.poststed||a.kommunenavn}`;choice.onclick=()=>{if(started!==sequence)return;field('address').value=choice.textContent;place(a.representasjonspunkt.lat,a.representasjonspunkt.lon,true);results.replaceChildren();};results.append(choice);}
   status(addresses.length?'Velg riktig adresse fra treffene.':'Ingen treff. Prøv gateadresse og sted, eller velg et punkt i kartet.');
  }catch(e){if(started===sequence)status(e.message);}finally{if(started===sequence)button.disabled=false;}
 };
 $('#project-location-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#project-location-search-button').click();}});
 for(const name of ['lat','lng'])field(name).addEventListener('change',()=>{const p=point();if(validProjectPoint(p.lat,p.lng))place(p.lat,p.lng,true);});
 $('#project-dialog').addEventListener('close',()=>sequence++);
 return {activate};
}
