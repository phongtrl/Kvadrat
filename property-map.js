import {apiFetch} from './api-client.js';
import {validateProperty} from './core.js';
export function createPropertyMap({getState,commit,toast,escape}){
 const $=s=>document.querySelector(s), labels={potensiell:'Potensiell',aktiv:'Aktiv oppussing',historisk:'Historisk / ferdig oppusset'}, colors={potensiell:'#284f3f',aktiv:'#be722e',historisk:'#356aa0'};
 let map,layers,editing=null;
 const rows=()=> (getState().properties||[]).filter(p=>!$('#property-filter').value||p.stage===$('#property-filter').value);
 function edit(p=null,point=null){editing=p;const form=$('#property-form');form.reset();$('#property-address-results').replaceChildren();if(p)for(const [key,value]of Object.entries(p)){if(form.elements.namedItem(key))form.elements.namedItem(key).value=value;}if(point){form.elements.lat.value=point.lat.toFixed(6);form.elements.lng.value=point.lng.toFixed(6);}$('#property-dialog').showModal();}
 function render(){
  const list=rows();
  $('#property-list').innerHTML=list.length?list.map(p=>`<article class="property-row"><div><strong>${escape(p.address)}</strong><p>${labels[p.stage]}${p.completedAt?' · Ferdig '+escape(p.completedAt):''}</p><p class="property-notes">${escape(p.notes)}</p></div><div><button class="button light" data-property-edit="${escape(p.id)}">Rediger</button><button class="text-button" data-property-show="${escape(p.id)}">Vis på kart</button></div></article>`).join(''):'<p>Ingen boliger i dette utvalget. Klikk i kartet eller velg «Legg til bolig».</p>';
  if(layers){layers.clearLayers();for(const p of list){const marker=L.circleMarker([p.lat,p.lng],{radius:9,color:colors[p.stage],fillColor:colors[p.stage],fillOpacity:.85}).addTo(layers);const popup=document.createElement('div'),title=document.createElement('strong'),button=document.createElement('button');title.textContent=p.address;button.textContent='Rediger bolig';button.type='button';button.onclick=()=>edit(p);popup.append(title,document.createElement('br'),document.createTextNode(labels[p.stage]),document.createElement('br'),button);marker.bindPopup(popup);}}
 }
 function activate(){
  const element=$('#property-map');if(!element.clientWidth||!element.clientHeight)return;
  if(!window.L){$('#property-map-error').hidden=false;return;}
  if(!map){map=L.map('property-map',{scrollWheelZoom:false}).setView([63.43,10.4],10);layers=L.layerGroup().addTo(map);
   const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'origin',attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
   tiles.on('tileerror',()=>$('#property-map-error').hidden=false);tiles.on('tileload',()=>$('#property-map-error').hidden=true);
   map.on('click',e=>{if(e.latlng.lat<62||e.latlng.lat>66||e.latlng.lng<8||e.latlng.lng>15){toast('Velg et sted i Trøndelag-området.',true);return;}edit(null,e.latlng);});
   if(window.ResizeObserver)new ResizeObserver(()=>{if(element.clientWidth&&element.clientHeight)map.invalidateSize({animate:false});}).observe(element);
  }
  map.invalidateSize({animate:false});render();
 }
 $('#property-address-button').onclick=async()=>{
  const query=$('#property-address-search').value.trim(),results=$('#property-address-results'),button=$('#property-address-button');
  if(query.length<3){results.textContent='Skriv minst tre tegn.';return;}button.disabled=true;results.textContent='Søker …';
  try{const response=await apiFetch('/api/addresses?scope=trondelag&q='+encodeURIComponent(query),{signal:AbortSignal.timeout(12000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Adressesøket feilet.');results.replaceChildren();
   for(const address of data.adresser||[]){const choice=document.createElement('button');choice.type='button';choice.className='button light';choice.textContent=`${address.adressetekst}, ${address.poststed||address.kommunenavn}`;choice.onclick=()=>{const form=$('#property-form');form.elements.address.value=choice.textContent;form.elements.lat.value=address.representasjonspunkt.lat;form.elements.lng.value=address.representasjonspunkt.lon;results.textContent='Adresse valgt. Kontroller opplysningene og lagre boligen.';};results.append(choice);}
   if(!results.childNodes.length)results.textContent='Ingen treff i Trøndelag. Prøv gateadresse og sted, eller velg plassering i kartet.';
  }catch(e){results.textContent=e.message;}finally{button.disabled=false;}
 };
 $('#add-property').onclick=()=>edit();$('#close-property').onclick=()=>$('#property-dialog').close();$('#property-filter').onchange=render;
 $('#property-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('[type="submit"]');button.disabled=true;try{const row=validateProperty({...Object.fromEntries(new FormData(e.target)),id:editing?.id||crypto.randomUUID()});const records=[...(getState().properties||[])];const i=records.findIndex(p=>p.id===row.id);if(i<0)records.push(row);else records[i]=row;if(await commit({...getState(),properties:records})){$('#property-dialog').close();render();map?.setView([row.lat,row.lng],15);toast('Boligen er lagret på nett.');}}catch(e){toast(e.message,true);}finally{button.disabled=false;}});
 $('#property-list').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;const row=(getState().properties||[]).find(p=>p.id===(button.dataset.propertyEdit||button.dataset.propertyShow));if(!row)return;if(button.dataset.propertyEdit)edit(row);else{activate();map?.setView([row.lat,row.lng],16);$('#property-map').scrollIntoView({behavior:'smooth',block:'center'});}});
 return {render,activate};
}
