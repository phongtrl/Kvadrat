import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBackup,validateProperty} from '../core.js';
const property={id:'steinkjer-1',address:'Eksempelregistrering i Steinkjer',lat:64.015,lng:11.495,stage:'potensiell',notes:'Vurder oppussing',completedAt:''};
test('properties throughout Trøndelag survive workspace validation and lifecycle edits',()=>{
 for(const stage of ['potensiell','aktiv','historisk']){
 const workspace=validateBackup({schemaVersion:1,sales:[],projects:[],properties:[{...property,stage}]});
 assert.equal(workspace.properties[0].stage,stage);assert.equal(workspace.properties[0].lat,64.015);
 }
 assert.throws(()=>validateProperty({...property,stage:'ukjent'}));
 assert.throws(()=>validateProperty({...property,completedAt:'2026-02-30'}));
 assert.throws(()=>validateProperty({...property,lat:70}));
 assert.throws(()=>validateBackup({schemaVersion:1,sales:[],projects:[],properties:[property,property]}));
});
test('combined map includes projects and properties, shared IDs and all lifecycle states',async()=>{
 const {propertyMapRows}=await import('../property-map.js');
 const state={properties:[property],projects:['Vurderes','Kjøpt','Under oppussing','Til salgs','Solgt'].map((status,i)=>({id:i===0?property.id:String(i),name:'Prosjekt '+i,address:'Adresse '+i,status,lat:63.4,lng:10.4}))};
 const rows=propertyMapRows(state);assert.equal(rows.length,6);assert.equal(new Set(rows.map(r=>r.key)).size,6);
 assert.equal(propertyMapRows(state,'potensiell').length,2);assert.equal(propertyMapRows(state,'aktiv').length,3);assert.equal(propertyMapRows(state,'historisk').length,1);
 assert.equal(rows.find(r=>r.kind==='project').title,'Adresse 0');
 state.projects[0].status='Solgt';assert.equal(propertyMapRows(state,'historisk').length,2);
});
