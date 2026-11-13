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
 assert.match(markers[0].options.icon.html,/price-marker.*Adresse/);assert.equal(markers[0].options.title,'Adresse');assert.equal(markers[0].options.keyboard,true);assert.equal(markers[0].popup.children[0].textContent,'Adresse');
 assert.ok(markers[0].popup.children.some(n=>n.textContent?.includes('Estimert fortjeneste før skatt')));
 const actions=markers[0].popup.children.filter(n=>n.type==='button');assert.equal(actions.length,2);actions[0].onclick();assert.equal(opened,'p1');
 element('#property-filter').value='historisk';ui.render();assert.equal(markers.length,1);assert.deepEqual(markers[0].point,[64.015,11.495]);
});
