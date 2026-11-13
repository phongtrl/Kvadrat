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
