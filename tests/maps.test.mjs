import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createListingOverview} from '../listings.js';

test('listing map waits until visible, loads tiles with origin-only referrer, and follows size changes',t=>{
 const previous={window:globalThis.window,document:globalThis.document,L:globalThis.L,fetch:globalThis.fetch,ResizeObserver:globalThis.ResizeObserver};
 t.after(()=>Object.assign(globalThis,previous));
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{clientWidth:0,clientHeight:0,hidden:true,value:'',addEventListener(){}});return elements.get(id);};
 let created=0,invalidations=0,resize,options,tileEvents={};
 const map={setView(){return this;},invalidateSize(){invalidations++;}};
 const tiles={addTo(){return this;},on(name,callback){tileEvents[name]=callback;return this;},redraw(){}};
 const L={map(){created++;return map;},tileLayer(url,opts){options={url,...opts};return tiles;},layerGroup(){return{addTo(){return this;}};}};
 class Observer{constructor(callback){resize=callback;}observe(){}}
 Object.assign(globalThis,{document:{querySelector:element},window:{L,ResizeObserver:Observer,addEventListener(){}},L,ResizeObserver:Observer,fetch:()=>new Promise(()=>{})});
 const ui=createListingOverview({getState:()=>({}),commit(){},openProject(){},toast(){},escape:s=>s,kr:s=>s,num:s=>s,stat(){}});
 ui.activate();assert.equal(created,0,'must not initialize inside hidden signed-out shell');
 Object.assign(element('#listing-map'),{clientWidth:700,clientHeight:340});ui.activate();assert.equal(created,1);
 assert.equal(options.url,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');assert.equal(options.referrerPolicy,'origin');
 resize();assert.equal(invalidations,1);ui.activate();assert.equal(created,1,'page switches must reuse the existing map');
 tileEvents.tileerror();tileEvents.tileerror();tileEvents.tileerror();assert.equal(element('#listing-map-error').hidden,false);
 tileEvents.tileload();assert.equal(element('#listing-map-error').hidden,true);
});

test('property map fits project and property positions and keeps overlapping records accessible',async t=>{
 const {createPropertyMap}=await import('../property-map.js');
 const previous={window:globalThis.window,document:globalThis.document,L:globalThis.L};t.after(()=>Object.assign(globalThis,previous));
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{clientWidth:700,clientHeight:400,value:'',addEventListener(){}});return elements.get(id);};
 const node=()=>({children:[],append(...items){this.children.push(...items);}});
 let fitted,opened;const markers=[];
 const map={setView(){return this;},invalidateSize(){},on(){},fitBounds(points){fitted=points;}};
 const L={map:()=>map,layerGroup:()=>({addTo(){return this;},clearLayers(){markers.length=0;}}),tileLayer:()=>({addTo(){return this;},on(){return this;}}),divIcon:options=>options,marker:(point,options)=>{const marker={point,options,addTo(){markers.push(this);return this;},bindPopup(popup){this.popup=popup;return this;}};return marker;}};
 Object.assign(globalThis,{window:{L},L,document:{querySelector:element,createElement:node,createTextNode:text=>({text})}});
 const state={projects:[{id:'p1',name:'Prosjekt',address:'Adresse',status:'Kjøpt',lat:63.4,lng:10.4}],properties:[{id:'b1',address:'Boligpunkt',stage:'potensiell',lat:63.4,lng:10.4},{id:'b2',address:'Steinkjer',stage:'historisk',lat:64.015,lng:11.495}]};
 const ui=createPropertyMap({getState:()=>state,commit(){},toast(){},escape:s=>s,openProject:id=>opened=id});ui.activate();
 assert.equal(markers.length,2);assert.deepEqual(fitted,[[63.4,10.4],[63.4,10.4],[64.015,11.495]]);
 assert.match(markers[0].options.icon.html,/price-marker.*Adresse/);assert.equal(markers[0].options.title,'Adresse');assert.equal(markers[0].options.keyboard,true);const flatten=node=>[node,...(node.children||[]).flatMap(flatten)];const popupNodes=flatten(markers[0].popup);assert.ok(popupNodes.some(n=>n.textContent==='Adresse'));assert.ok(popupNodes.some(n=>n.className==='property-popup-address'));
 assert.ok(popupNodes.some(n=>n.textContent?.includes('Estimert fortjeneste før skatt')));
 const actions=popupNodes.filter(n=>n.type==='button');assert.equal(actions.length,4);actions[0].onclick();assert.equal(opened,'p1');
 element('#property-filter').value='historisk';ui.render();assert.equal(markers.length,1);assert.deepEqual(markers[0].point,[64.015,11.495]);
});

test('FINN show-on-map opens the chosen listing price popup even from a collapsed map',async t=>{
 const {readFileSync}=await import('node:fs');const listing=JSON.parse(readFileSync(new URL('../data/listings.json',import.meta.url))).listings[0];
 const previous={window:globalThis.window,document:globalThis.document,L:globalThis.L,fetch:globalThis.fetch,location:globalThis.location};t.after(()=>Object.assign(globalThis,previous));
 const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{value:'',clientWidth:700,clientHeight:340,events:{},addEventListener(name,fn){this.events[name]=fn;},scrollIntoView(){}});return elements.get(id);};
 const node=()=>({children:[],append(...items){this.children.push(...items);}});let lastMarker;
 const map={setView(){return this;},invalidateSize(){}};
 const L={map:()=>map,layerGroup:()=>({addTo(){return this;},clearLayers(){}}),tileLayer:()=>({addTo(){return this;},on(){return this;}}),circleMarker:()=>{const marker={opened:false,events:{},on(name,callback){this.events[name]=callback;return this;},bindTooltip(tooltip,options){this.tooltip=tooltip;this.tooltipOptions=options;return this;},addTo(){return this;},bindPopup(popup){this.popup=popup;return this;},openPopup(){this.opened=true;return this;}};lastMarker=marker;return marker;}};
 Object.assign(globalThis,{window:{L,addEventListener(){}},L,location:{hash:'#annonser'},fetch:async()=>Response.json({listings:[],coverage:'Test',checkedAt:'2026-11-13'}),document:{querySelector:element,createElement:node}});
 const ui=createListingOverview({getState:()=>({listings:[listing]}),commit(){throw new Error('No write needed for known coordinates');},openProject(){},toast:message=>assert.fail(message),escape:s=>s,kr:value=>`${value} kr`,num:String,stat:()=>''});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(lastMarker.tooltipOptions.permanent,true);assert.equal(lastMarker.tooltip.children[0].textContent,listing.address);assert.match(lastMarker.tooltip.children[1].textContent,/totalt/);lastMarker.events.mouseover();assert.equal(lastMarker.opened,true,'hover opens prices without a table action');
 element('#listing-map-disclosure').open=false;const button={dataset:{locateListing:listing.id}};
 await element('#listing-table').events.click({target:{closest:()=>button}});
 assert.equal(element('#listing-map-disclosure').open,true);assert.equal(lastMarker.opened,true);assert.equal(button.disabled,false);
 const flatten=node=>[node,...(node.children||[]).flatMap(flatten)];const text=flatten(lastMarker.popup).map(n=>n.textContent||'').join(' ');
 for(const value of ['Prisantydning','Fellesgjeld','Omkostninger','Totalpris inkl. omkostninger',`${listing.price} kr`,`${listing.price+listing.debt+listing.fees} kr`])assert.ok(text.includes(value),value);
 ui.render();assert.equal(lastMarker.opened,true,'rerender must retain the selected price popup');
});
