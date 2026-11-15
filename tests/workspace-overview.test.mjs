import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceSummary} from '../workspace-overview.js';
const project={id:'one',name:'Test',address:'Testadresse',status:'Under oppussing',ownership:'selveier',area:65,lat:63.43,lng:10.4,purchase:3000000,debt:0,resale:4100000,renovation:350000,contingency:15,buyFees:15000,saleFees:100000,monthly:3500,months:6,equity:900000,interest:6.5,stampBase:3000000,expenses:[],tasks:[{id:'t',description:'Innhent tilbud',done:false}]};
test('overview separates active investments from considered and sold projects and surfaces losses first',()=>{
 const state={projects:[project,{...project,id:'two',status:'Vurderes',resale:1000000},{...project,id:'three',status:'Solgt'}],properties:[{id:'point'}]};
 const result=workspaceSummary(state);assert.equal(result.owned,1);assert.equal(result.considering,1);assert.equal(result.points,1);assert.equal(result.tasks,1);assert.equal(result.actions.length,2);assert.equal(result.actions[0].id,'two');assert.equal(result.actions[0].priority,0);assert.ok(result.investment>3000000);
 const empty=workspaceSummary({});assert.equal(empty.owned,0);assert.equal(empty.profit,0);assert.deepEqual(empty.actions,[]);
});
