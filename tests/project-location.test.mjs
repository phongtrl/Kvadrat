import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectLocation,validProjectPoint} from '../project-location.js';
import {validateProject} from '../core.js';
test('existing project can be relocated by map, drag or address selection before saving',async t=>{
 const previous={window:globalThis.window,document:globalThis.document,L:globalThis.L};t.after(()=>Object.assign(globalThis,previous));
 const node=()=>({value:'',children:[],events:{},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},addEventListener(name,callback){this.events[name]=callback;}});
 const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
 const fields={address:{...node(),value:'Eksisterende adresse'},lat:{...node(),value:'63.43'},lng:{...node(),value:'10.4'},purchase:{value:'3000000'}};
 element('#project-form').elements={namedItem:name=>fields[name]};element('#project-dialog').open=true;
 const map={events:{},setView(){return this;},invalidateSize(){},on(name,callback){this.events[name]=callback;}};
 let markerPoint,drag;const marker={setLatLng(p){markerPoint={lat:p[0],lng:p[1]};},getLatLng(){return markerPoint;},on(_,callback){drag=callback;},addTo(){return this;}};
 const L={map:()=>map,tileLayer:()=>({addTo(){return this;},on(){}}),marker:point=>{markerPoint={lat:point[0],lng:point[1]};return marker;}};
 Object.assign(globalThis,{window:{L},L,document:{querySelector:element,createElement:node}});
 let url;const ui=createProjectLocation({fetcher:async path=>{url=path;return Response.json({adresser:[{adressetekst:'Kongens gate 10',poststed:'STEINKJER',representasjonspunkt:{lat:64.015,lon:11.495}}]});}});
 ui.activate();map.events.click({latlng:{lat:64.01,lng:11.49}});assert.equal(fields.lat.value,'64.010000');assert.equal(fields.address.value,'Eksisterende adresse');
 markerPoint={lat:64.02,lng:11.5};drag();assert.equal(fields.lng.value,'11.500000');assert.equal(fields.purchase.value,'3000000');
 element('#project-location-search').value='Kongens gate Steinkjer';await element('#project-location-search-button').onclick();assert.match(url,/scope=trondelag/);element('#project-location-results').children[0].onclick();assert.equal(fields.address.value,'Kongens gate 10, STEINKJER');assert.equal(fields.lat.value,'64.015000');
 map.events.click({latlng:{lat:70,lng:10}});assert.equal(fields.lat.value,'64.015000');
});
test('relocated projects validate across Trøndelag and preserve project economics',()=>{
 const project={id:'p1',name:'Test',address:'Steinkjer',status:'Kjøpt',ownership:'selveier',area:65,lat:64.015,lng:11.495,purchase:3000000,debt:0,resale:4100000,renovation:350000,contingency:15,buyFees:15000,saleFees:100000,monthly:3500,months:6,equity:900000,interest:6.5,stampBase:3000000,expenses:[],tasks:[],notes:'Behold'};
 const result=validateProject(project);assert.equal(result.lat,64.015);assert.equal(result.purchase,3000000);assert.equal(result.notes,'Behold');
 assert.ok(validProjectPoint(64.015,11.495));assert.equal(validProjectPoint(NaN,10),false);assert.throws(()=>validateProject({...project,lat:70}));
});
